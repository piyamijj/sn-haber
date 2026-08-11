-- ============================================================
-- 0003_kaynak_kategori.sql
-- ============================================================
-- Amaç: Kategori dağılımı sorununun köküne inen bir düzeltme.
--
-- Önceki durumda TÜM haberlerin kategorisi, her RSS öğesi için ayrı ayrı
-- çalışan bir Gemini API çağrısıyla (analyzeArticle) belirleniyordu. Bu
-- çağrı canlı ortamda güvenilmez çıktı (model değişikliği + kota limiti
-- nedeniyle sürekli "gundem" fallback'ine düşüyordu) ve zaten kavramsal
-- olarak gereksiz bir maliyetti: birçok RSS kaynağının KENDİ kategoriye
-- özel feed'i (örn. bir haber sitesinin /spor, /ekonomi, /teknoloji RSS
-- adresleri) zaten mevcut ve kategori bilgisi kaynağın kendisinden
-- %100 doğru şekilde biliniyor.
--
-- Bu migration, "kaynaklar" tablosuna iki yeni kolon ekler:
--   1. sabit_kategori: Bu RSS feed'inin bilinen/sabit kategorisi. Dolu
--      olduğunda, ingest pipeline bu değeri doğrudan kullanır ve o öğe
--      için Gemini kategorizasyon çağrısını TAMAMEN ATLAR (daha hızlı,
--      daha doğru, daha az API çağrısı). NULL ise (örn. bir kaynağın
--      genel/karma "anasayfa" feed'i), pipeline eskisi gibi Gemini'ye
--      danışır — AI kategorizasyonu artık ANA yöntem değil, YEDEK
--      yöntemdir.
--   2. goruntu_adi: Haber kartlarında/detay sayfasında gösterilecek
--      marka adı (örn. "Hürriyet"). Artık aynı markanın birden fazla
--      kaynaklar satırı olacak (Hürriyet - Ekonomi, Hürriyet - Spor,
--      Hürriyet - Teknoloji, ...) çünkü her kategoriye özel feed ayrı
--      bir satır olarak eklenir ve "isim" kolonu (rss_url ile birlikte
--      pipeline'ın kaynak eşleştirmesinde kullandığı iç anahtar) satır
--      başına benzersiz olmalıdır. goruntu_adi ise kullanıcıya gösterilen
--      isimdir ve bilerek tekrar edebilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Yeni kolonlar
-- ------------------------------------------------------------
alter table public.kaynaklar
  add column if not exists sabit_kategori haber_kategori,
  add column if not exists goruntu_adi text;

comment on column public.kaynaklar.sabit_kategori is
  'Bu RSS feed adresinin bilinen/sabit kategorisi (örn. bir kaynağın kendi spor feed''i için ''spor''). Dolu olduğunda ingest pipeline Gemini kategorizasyon çağrısını atlayıp bu değeri doğrudan kullanır. NULL ise kategori Gemini analiz çağrısıyla (yedek yöntem) belirlenir.';

comment on column public.kaynaklar.goruntu_adi is
  'Haber kartlarında/detay sayfasında gösterilecek marka adı (örn. "Hürriyet"). "isim" kolonu satır başına benzersiz olmak zorundadır (aynı markanın kategoriye özel birden fazla feed''i olabilir); goruntu_adi ise kasıtlı olarak tekrar edebilir.';

-- ------------------------------------------------------------
-- 2. Geriye dönük doldurma (backfill)
-- ------------------------------------------------------------
-- Mevcut 8 kaynak satırı için goruntu_adi henüz NULL olacağından,
-- bunları şimdilik kendi "isim" değerleriyle doldurur — böylece bu
-- migration çalıştıktan sonra hiçbir mevcut davranış bozulmaz. Bu
-- satırların sabit_kategori değeri kasıtlı olarak NULL bırakılır
-- (hepsi genel/karma "anasayfa" tipi feed'lerdir); kategoriye özel
-- yeni feed satırları ayrı bir INSERT ile eklenecektir.
update public.kaynaklar
set goruntu_adi = isim
where goruntu_adi is null;

-- ------------------------------------------------------------
-- 3. İndeks
-- ------------------------------------------------------------
-- Pipeline, aktif kaynakları çekerken sabit_kategori'si dolu olanları
-- ayırt edecek şekilde filtreleme/gruplama yapabilir; bu indeks o
-- sorguları hızlandırır.
create index if not exists idx_kaynaklar_sabit_kategori
  on public.kaynaklar (sabit_kategori)
  where sabit_kategori is not null;

-- ------------------------------------------------------------
-- 4. Kategoriye özel yeni RSS kaynak satırları
-- ------------------------------------------------------------
-- Her satır, canlı ortamda tek tek test edilip geçerli RSS XML döndürdüğü
-- ve içeriğinin gerçekten o kategoriye ait olduğu doğrulanmış bir feed
-- adresidir. "isim" kolonu benzersiz olmak zorunda olduğundan
-- "<Marka> - <Kategori>" biçiminde tutulur; "goruntu_adi" ise sadece
-- marka adını taşır (kullanıcıya böyle gösterilir).
insert into public.kaynaklar (isim, rss_url, site_url, goruntu_adi, sabit_kategori, aktif)
values
  -- Anadolu Ajansı
  ('Anadolu Ajansı - Ekonomi', 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'ekonomi', true),
  ('Anadolu Ajansı - Spor', 'https://www.aa.com.tr/tr/rss/default?cat=spor', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'spor', true),
  ('Anadolu Ajansı - Sağlık', 'https://www.aa.com.tr/tr/rss/default?cat=saglik', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'saglik', true),
  ('Anadolu Ajansı - Yaşam', 'https://www.aa.com.tr/tr/rss/default?cat=yasam', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'yasam', true),
  ('Anadolu Ajansı - Dünya', 'https://www.aa.com.tr/tr/rss/default?cat=dunya', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'dunya', true),
  ('Anadolu Ajansı - Bilim Teknoloji', 'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'teknoloji', true),
  ('Anadolu Ajansı - Kültür Sanat', 'https://www.aa.com.tr/tr/rss/default?cat=kultur', 'https://www.aa.com.tr', 'Anadolu Ajansı', 'kultur-sanat', true),

  -- TRT Haber
  ('TRT Haber - Ekonomi', 'https://www.trthaber.com/ekonomi_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'ekonomi', true),
  ('TRT Haber - Spor', 'https://www.trthaber.com/spor_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'spor', true),
  ('TRT Haber - Sağlık', 'https://www.trthaber.com/saglik_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'saglik', true),
  ('TRT Haber - Dünya', 'https://www.trthaber.com/dunya_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'dunya', true),
  ('TRT Haber - Yaşam', 'https://www.trthaber.com/yasam_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'yasam', true),
  ('TRT Haber - Kültür Sanat', 'https://www.trthaber.com/kultur_sanat_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'kultur-sanat', true),
  ('TRT Haber - Bilim Teknoloji', 'https://www.trthaber.com/bilim_teknoloji_articles.rss', 'https://www.trthaber.com', 'TRT Haber', 'teknoloji', true),

  -- NTV
  ('NTV - Ekonomi', 'https://www.ntv.com.tr/ekonomi.rss', 'https://www.ntv.com.tr', 'NTV', 'ekonomi', true),
  ('NTV - Spor', 'https://www.ntv.com.tr/sporskor.rss', 'https://www.ntv.com.tr', 'NTV', 'spor', true),
  ('NTV - Teknoloji', 'https://www.ntv.com.tr/teknoloji.rss', 'https://www.ntv.com.tr', 'NTV', 'teknoloji', true),
  ('NTV - Sağlık', 'https://www.ntv.com.tr/saglik.rss', 'https://www.ntv.com.tr', 'NTV', 'saglik', true),
  ('NTV - Dünya', 'https://www.ntv.com.tr/dunya.rss', 'https://www.ntv.com.tr', 'NTV', 'dunya', true),
  ('NTV - Yaşam', 'https://www.ntv.com.tr/yasam.rss', 'https://www.ntv.com.tr', 'NTV', 'yasam', true),

  -- Hürriyet
  ('Hürriyet - Gündem', 'https://www.hurriyet.com.tr/rss/gundem', 'https://www.hurriyet.com.tr', 'Hürriyet', 'gundem', true),
  ('Hürriyet - Ekonomi', 'https://www.hurriyet.com.tr/rss/ekonomi', 'https://www.hurriyet.com.tr', 'Hürriyet', 'ekonomi', true),
  ('Hürriyet - Magazin', 'https://www.hurriyet.com.tr/rss/magazin', 'https://www.hurriyet.com.tr', 'Hürriyet', 'magazin', true),
  ('Hürriyet - Spor', 'https://www.hurriyet.com.tr/rss/spor', 'https://www.hurriyet.com.tr', 'Hürriyet', 'spor', true),
  ('Hürriyet - Dünya', 'https://www.hurriyet.com.tr/rss/dunya', 'https://www.hurriyet.com.tr', 'Hürriyet', 'dunya', true),
  ('Hürriyet - Teknoloji', 'https://www.hurriyet.com.tr/rss/teknoloji', 'https://www.hurriyet.com.tr', 'Hürriyet', 'teknoloji', true),
  ('Hürriyet - Yaşam', 'https://www.hurriyet.com.tr/rss/yasam', 'https://www.hurriyet.com.tr', 'Hürriyet', 'yasam', true),

  -- Sözcü
  ('Sözcü - Gündem', 'https://www.sozcu.com.tr/feeds-rss-category-gundem', 'https://www.sozcu.com.tr', 'Sözcü', 'gundem', true),
  ('Sözcü - Ekonomi', 'https://www.sozcu.com.tr/feeds-rss-category-ekonomi', 'https://www.sozcu.com.tr', 'Sözcü', 'ekonomi', true),
  ('Sözcü - Spor', 'https://www.sozcu.com.tr/feeds-rss-category-spor', 'https://www.sozcu.com.tr', 'Sözcü', 'spor', true),
  ('Sözcü - Bilim Teknoloji', 'https://www.sozcu.com.tr/feeds-rss-category-bilim-teknoloji', 'https://www.sozcu.com.tr', 'Sözcü', 'teknoloji', true),
  ('Sözcü - Sağlık', 'https://www.sozcu.com.tr/feeds-rss-category-saglik', 'https://www.sozcu.com.tr', 'Sözcü', 'saglik', true),
  ('Sözcü - Dünya', 'https://www.sozcu.com.tr/feeds-rss-category-dunya', 'https://www.sozcu.com.tr', 'Sözcü', 'dunya', true),
  ('Sözcü - Yaşam', 'https://www.sozcu.com.tr/feeds-rss-category-yasam', 'https://www.sozcu.com.tr', 'Sözcü', 'yasam', true),
  ('Sözcü - Kültür Sanat', 'https://www.sozcu.com.tr/feeds-rss-category-kultur-sanat', 'https://www.sozcu.com.tr', 'Sözcü', 'kultur-sanat', true),
  ('Sözcü - Magazin', 'https://www.sozcu.com.tr/feeds-rss-category-magazin', 'https://www.sozcu.com.tr', 'Sözcü', 'magazin', true),

  -- Cumhuriyet
  ('Cumhuriyet - Türkiye', 'https://www.cumhuriyet.com.tr/rss/turkiye', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'gundem', true),
  ('Cumhuriyet - Ekonomi', 'https://www.cumhuriyet.com.tr/rss/ekonomi', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'ekonomi', true),
  ('Cumhuriyet - Spor', 'https://www.cumhuriyet.com.tr/rss/spor', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'spor', true),
  ('Cumhuriyet - Dünya', 'https://www.cumhuriyet.com.tr/rss/dunya', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'dunya', true),
  ('Cumhuriyet - Yaşam', 'https://www.cumhuriyet.com.tr/rss/yasam', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'yasam', true),
  ('Cumhuriyet - Sağlık', 'https://www.cumhuriyet.com.tr/rss/saglik', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'saglik', true),
  ('Cumhuriyet - Kültür Sanat', 'https://www.cumhuriyet.com.tr/rss/kultur-sanat', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'kultur-sanat', true),
  ('Cumhuriyet - Magazin', 'https://www.cumhuriyet.com.tr/rss/magazin', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'magazin', true),
  ('Cumhuriyet - Bilim Teknoloji', 'https://www.cumhuriyet.com.tr/rss/bilim-teknoloji', 'https://www.cumhuriyet.com.tr', 'Cumhuriyet', 'teknoloji', true),

  -- Habertürk
  ('Habertürk - Gündem', 'https://www.haberturk.com/rss/kategori/gundem.xml', 'https://www.haberturk.com', 'Habertürk', 'gundem', true),
  ('Habertürk - Ekonomi', 'https://www.haberturk.com/rss/kategori/ekonomi.xml', 'https://www.haberturk.com', 'Habertürk', 'ekonomi', true),
  ('Habertürk - Spor', 'https://www.haberturk.com/rss/kategori/spor.xml', 'https://www.haberturk.com', 'Habertürk', 'spor', true),
  ('Habertürk - Teknoloji', 'https://www.haberturk.com/rss/kategori/teknoloji.xml', 'https://www.haberturk.com', 'Habertürk', 'teknoloji', true),
  ('Habertürk - Sağlık', 'https://www.haberturk.com/rss/kategori/saglik.xml', 'https://www.haberturk.com', 'Habertürk', 'saglik', true),
  ('Habertürk - Dünya', 'https://www.haberturk.com/rss/kategori/dunya.xml', 'https://www.haberturk.com', 'Habertürk', 'dunya', true),
  ('Habertürk - Yaşam', 'https://www.haberturk.com/rss/kategori/yasam.xml', 'https://www.haberturk.com', 'Habertürk', 'yasam', true),
  ('Habertürk - Kültür Sanat', 'https://www.haberturk.com/rss/kategori/kultur-sanat.xml', 'https://www.haberturk.com', 'Habertürk', 'kultur-sanat', true),
  ('Habertürk - Magazin', 'https://www.haberturk.com/rss/kategori/magazin.xml', 'https://www.haberturk.com', 'Habertürk', 'magazin', true)
on conflict (rss_url) do nothing;

-- Not: BBC Türkçe'nin kategoriye özel feed'i tespit edilemedi (tüm konu
-- URL'leri ana feed ile birebir aynı içeriği döndürüyor) — mevcut genel
-- feed'i "sabit_kategori" olmadan (NULL) kalır, kategorisi Gemini analiz
-- çağrısıyla (yedek yöntem) belirlenmeye devam eder.