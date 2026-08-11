-- SN Haber — İkinci şema migration'ı
-- Anlamsal (embedding) benzerlik araması için pgvector tabanlı RPC
-- fonksiyonları. Bu fonksiyonlar iki amaçla kullanılır:
--   1. match_haberler_by_embedding — RSS ingest pipeline'ındaki mükerrer
--      haber tespiti (dedup) için; farklı kaynaklardan farklı kelimelerle
--      bildirilen AYNI olayı yakalar (bkz. lib/rss/dedup.ts).
--   2. match_haberler_for_rag — sağ alttaki floating AI chatbot'un RAG
--      (Bilgi Getirimi ile Zenginleştirilmiş Üretim) akışında, kullanıcı
--      sorusuna en ilgili güncel haberleri bulmak için (Aşama 3).
--
-- Bu dosya, supabase/migrations/0001_init.sql'in ÜZERİNE, ondan SONRA
-- uygulanmalıdır (haberler tablosu ve embedding sütunu 0001'de oluşturulur).

-- ============================================================
-- 1. match_haberler_by_embedding — Mükerrer haber tespiti (dedup)
-- ============================================================
-- Verilen embedding vektörüne pgvector kosinüs uzaklığı operatörü (<=>)
-- ile en yakın mevcut haberleri döner. Uzaklık 0'a ne kadar yakınsa,
-- haberler o kadar benzerdir (benzerlik = 1 - uzaklık).
--
-- RSS ingest pipeline'ı, yeni bir haberin embedding'ini bu fonksiyona
-- gönderir; dönen en yakın adayın benzerliği SIMILARITY_THRESHOLD
-- (lib/rss/dedup.ts içinde tanımlı, varsayılan 0.92) üzerindeyse, yeni
-- haber mükerrer kabul edilip Supabase'e yazılmaz.

create or replace function public.match_haberler_by_embedding(
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  slug text,
  distance float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    h.id,
    h.title,
    h.slug,
    (h.embedding <=> query_embedding) as distance
  from public.haberler h
  where h.embedding is not null
  order by h.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_haberler_by_embedding(vector, int) is
  'RSS ingest pipeline''ının mükerrer haber tespiti (dedup) için kullandığı pgvector kosinüs benzerliği araması. En yakın adayları uzaklığa göre artan sırada döner.';

-- ============================================================
-- 2. match_haberler_for_rag — RAG chatbot bağlam getirimi
-- ============================================================
-- Sağ alttaki floating AI chatbot, kullanıcı sorusunun embedding'ini bu
-- fonksiyona göndererek en ilgili GÜNCEL haberleri bulur ve bunları
-- Groq/Gemini'ye bağlam (context) olarak verir. Sadece son 7 gün
-- içinde yayınlanmış haberler dikkate alınır — RAG'in amacı "güncel
-- haberleri sorgulamak" olduğundan, eski/arşiv haberler bu aramaya
-- dahil edilmez (chatbot'un güncel olay sorularına daha isabetli yanıt
-- vermesini sağlar).

create or replace function public.match_haberler_for_rag(
  query_embedding vector(768),
  match_count int default 8,
  gun_araligi int default 7
)
returns table (
  id uuid,
  title text,
  slug text,
  summary text,
  content text,
  category haber_kategori,
  published_at timestamptz,
  distance float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    h.id,
    h.title,
    h.slug,
    h.summary,
    h.content,
    h.category,
    h.published_at,
    (h.embedding <=> query_embedding) as distance
  from public.haberler h
  where h.embedding is not null
    and h.published_at >= (now() - (gun_araligi || ' days')::interval)
  order by h.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_haberler_for_rag(vector, int, int) is
  'RAG tabanlı floating AI chatbot''un, kullanıcı sorusuna en ilgili GÜNCEL (varsayılan son 7 gün) haberleri bulmak için kullandığı pgvector kosinüs benzerliği araması.';

-- ============================================================
-- 3. Yetkilendirme (Grants)
-- ============================================================
-- Her iki fonksiyon da SECURITY DEFINER ile tanımlandığı için, çağıran
-- rolün haberler tablosuna doğrudan erişimi olmasa bile fonksiyon
-- kendi tanımlayıcısının (postgres/owner) yetkileriyle çalışır. Buna
-- rağmen, fonksiyonların hangi rollerce ÇAĞRILABİLECEĞİ açıkça
-- tanımlanmalıdır.

grant execute on function public.match_haberler_by_embedding(vector, int)
  to anon, authenticated, service_role;

grant execute on function public.match_haberler_for_rag(vector, int, int)
  to anon, authenticated, service_role;