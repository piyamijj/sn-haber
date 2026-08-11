-- ============================================================
-- 0004_burc_yorumlari.sql
-- ============================================================
-- Amaç: Ana sayfaya eklenecek "Günlük Burç Yorumu" widget'ı için
-- gereken tabloyu oluşturur.
--
-- Her gün, günde 1 kez çalışan bir cron job (bkz. app/api/cron/burc-yorumu)
-- Gemini ile 12 burcun HER biri için 2-3 cümlelik kısa bir günlük yorum
-- üretir ve bu tabloya yazar. Widget bileşeni bu tablodan BUGÜNÜN
-- yorumlarını okur — sayfa her açıldığında AI çağrısı yapılmaz, önceden
-- üretilmiş ve cache'lenmiş içerik gösterilir (RSS ingest pipeline'ında
-- kategori-özel feed mantığıyla aynı prensip: pahalı AI çağrısını bir
-- kez yap, sonucu sakla, defalarca oku).
--
-- (burc, yorum_tarihi) üzerindeki UNIQUE kısıtı, cron'un günde birden
-- fazla kez tetiklenmesi durumunda (örn. manuel test, cron-job.org'un
-- yeniden denemesi) aynı gün+burç için mükerrer satır oluşmasını
-- önler; upsert (ON CONFLICT) ile güvenle üzerine yazılabilir.
-- ============================================================

CREATE TABLE IF NOT EXISTS burc_yorumlari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  burc text NOT NULL CHECK (
    burc IN (
      'koc', 'boga', 'ikizler', 'yengec', 'aslan', 'basak',
      'terazi', 'akrep', 'yay', 'oglak', 'kova', 'balik'
    )
  ),
  yorum_metni text NOT NULL,
  yorum_tarihi date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (burc, yorum_tarihi)
);

CREATE INDEX IF NOT EXISTS idx_burc_yorumlari_tarih
  ON burc_yorumlari (yorum_tarihi);