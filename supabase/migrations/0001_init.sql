-- SN Haber — İlk şema migration'ı
-- AI destekli haber platformu için çekirdek veritabanı yapısı.
-- Bu dosya Supabase SQL editöründe veya `supabase db push` ile uygulanır.

-- ============================================================
-- 1. Uzantılar (Extensions)
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================
-- 2. Enum tipleri
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'haber_kategori') then
    create type haber_kategori as enum (
      'gundem',
      'ekonomi',
      'dunya',
      'spor',
      'teknoloji',
      'saglik',
      'kultur-sanat',
      'magazin',
      'bilim',
      'yasam'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_dogrulama_durumu') then
    create type ai_dogrulama_durumu as enum (
      'beklemede',
      'dogrulandi',
      'suphe',
      'reddedildi'
    );
  end if;
end$$;

-- ============================================================
-- 3. kaynaklar (RSS kaynakları) tablosu
-- ============================================================
create table if not exists public.kaynaklar (
  id uuid primary key default uuid_generate_v4(),
  isim text not null,
  rss_url text not null unique,
  site_url text,
  aktif boolean not null default true,
  son_cekim_zamani timestamptz,
  son_cekim_durumu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kaynaklar is 'Türkiye''nin majör RSS haber kaynaklarının listesi ve çekim durumu.';

-- ============================================================
-- 4. haberler (articles) tablosu
-- ============================================================
create table if not exists public.haberler (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  ai_quick_summary text[] not null default array[]::text[],
  content text not null default '',
  category haber_kategori not null default 'gundem',
  tags text[] not null default array[]::text[],
  source_name text not null,
  source_url text not null,
  image_url text,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reading_time_minutes integer not null default 1,
  is_flash boolean not null default false,
  ai_verification_status ai_dogrulama_durumu not null default 'beklemede',
  ai_verification_note text,
  -- İçerik hash'i: mükerrer haber tespiti için hızlı, tam eşleşme kontrolü (sha256).
  content_hash text not null unique,
  -- Anlamsal (embedding) mükerrer tespiti ve RAG chatbot bağlamı için.
  -- Gemini text-embedding-004 modeli 768 boyutlu vektör üretir.
  embedding vector(768),
  kaynak_id uuid references public.kaynaklar(id) on delete set null,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.haberler is 'AI ile işlenmiş, yayınlanmış haber makaleleri. Mükerrer engelleme content_hash (tam eşleşme) ve embedding (anlamsal benzerlik) ile yapılır.';
comment on column public.haberler.content_hash is 'Başlık+özet normalize edilip sha256 ile hashlenir; RSS ingest pipeline''ında hızlı dedup kontrolü için kullanılır.';
comment on column public.haberler.embedding is 'Gemini embedding modeli çıktısı; kosinüs benzerliği ile anlamsal mükerrer tespiti ve RAG sorgu bağlamı için kullanılır.';

-- ============================================================
-- 5. İndeksler
-- ============================================================
create index if not exists idx_haberler_category on public.haberler (category);
create index if not exists idx_haberler_published_at on public.haberler (published_at desc);
create index if not exists idx_haberler_category_published_at on public.haberler (category, published_at desc);
create index if not exists idx_haberler_is_flash on public.haberler (is_flash) where is_flash = true;
create index if not exists idx_haberler_slug on public.haberler (slug);
create index if not exists idx_kaynaklar_aktif on public.kaynaklar (aktif) where aktif = true;

-- Vektör benzerlik araması için HNSW indeksi (pgvector >= 0.5.0).
create index if not exists idx_haberler_embedding_hnsw
  on public.haberler
  using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- 6. updated_at otomatik güncelleme tetikleyicisi
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_haberler_updated_at on public.haberler;
create trigger trg_haberler_updated_at
  before update on public.haberler
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_kaynaklar_updated_at on public.kaynaklar;
create trigger trg_kaynaklar_updated_at
  before update on public.kaynaklar
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================
alter table public.haberler enable row level security;
alter table public.kaynaklar enable row level security;

-- Herkes yayınlanmış haberleri okuyabilir (anon + authenticated).
drop policy if exists "haberler_public_read" on public.haberler;
create policy "haberler_public_read"
  on public.haberler
  for select
  to anon, authenticated
  using (true);

-- Yazma/güncelleme/silme işlemleri sadece service_role ile yapılabilir
-- (RSS ingest pipeline, Vercel Cron Job, admin araçları). Anon/authenticated
-- rolleri için ayrıca insert/update/delete policy TANIMLANMAZ; bu da
-- varsayılan olarak bu işlemleri engeller.
drop policy if exists "haberler_service_all" on public.haberler;
create policy "haberler_service_all"
  on public.haberler
  for all
  to service_role
  using (true)
  with check (true);

-- Kaynaklar tablosu da aynı mantıkla korunur; herkes okuyabilir,
-- sadece service_role yazabilir.
drop policy if exists "kaynaklar_public_read" on public.kaynaklar;
create policy "kaynaklar_public_read"
  on public.kaynaklar
  for select
  to anon, authenticated
  using (true);

drop policy if exists "kaynaklar_service_all" on public.kaynaklar;
create policy "kaynaklar_service_all"
  on public.kaynaklar
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- 8. Görüntülenme sayısını artıran yardımcı fonksiyon (RPC)
-- ============================================================
create or replace function public.increment_view_count(haber_id uuid)
returns void as $$
begin
  update public.haberler
  set view_count = view_count + 1
  where id = haber_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 9. Başlangıç RSS kaynakları (Türkiye'nin majör haber kaynakları)
-- ============================================================
insert into public.kaynaklar (isim, rss_url, site_url, aktif)
values
  ('Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=guncel', 'https://www.aa.com.tr', true),
  ('TRT Haber', 'https://www.trthaber.com/manşet_articles.rss', 'https://www.trthaber.com', true),
  ('NTV', 'https://www.ntv.com.tr/gundem.rss', 'https://www.ntv.com.tr', true),
  ('Hürriyet', 'https://www.hurriyet.com.tr/rss/anasayfa', 'https://www.hurriyet.com.tr', true),
  ('Sözcü', 'https://www.sozcu.com.tr/feed', 'https://www.sozcu.com.tr', true),
  ('Cumhuriyet', 'https://www.cumhuriyet.com.tr/rss/anasayfa.xml', 'https://www.cumhuriyet.com.tr', true),
  ('Habertürk', 'https://www.haberturk.com/rss', 'https://www.haberturk.com', true),
  ('BBC Türkçe', 'https://feeds.bbci.co.uk/turkce/rss.xml', 'https://www.bbc.com/turkce', true)
on conflict (rss_url) do nothing;