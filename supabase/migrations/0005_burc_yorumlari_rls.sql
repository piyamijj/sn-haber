-- ============================================================
-- 0005_burc_yorumlari_rls.sql
-- ============================================================
-- Amaç: 0004_burc_yorumlari.sql tabloyu oluştururken Row Level Security
-- politikalarını EKLEMEYİ UNUTTU — bu, projedeki diğer tüm tablolardan
-- (haberler, kaynaklar; bkz. 0001_init.sql bölüm 7) farklı bir davranıştı
-- ve canlı ortamda tespit edilen bir hataya yol açtı: ana sayfa (anon key
-- ile okuyan getSupabaseServerClient) burc_yorumlari tablosundan HİÇBİR
-- satır göremiyordu (boş dizi dönüyordu), oysa service_role ile (RSS
-- ingest/cron pipeline'ının kullandığı istemci) tüm 12 satır sorunsuz
-- görünüyordu. Widget bu yüzden veriler veritabanında dolu olsa da hiç
-- görünmüyordu.
--
-- Bu migration, haberler/kaynaklar tablolarıyla AYNI güvenlik modelini
-- uygular: herkes (anon + authenticated) okuyabilir, sadece service_role
-- yazabilir/güncelleyebilir/silebilir.
-- ============================================================

alter table public.burc_yorumlari enable row level security;

drop policy if exists "burc_yorumlari_public_read" on public.burc_yorumlari;
create policy "burc_yorumlari_public_read"
  on public.burc_yorumlari
  for select
  to anon, authenticated
  using (true);

drop policy if exists "burc_yorumlari_service_all" on public.burc_yorumlari;
create policy "burc_yorumlari_service_all"
  on public.burc_yorumlari
  for all
  to service_role
  using (true)
  with check (true);