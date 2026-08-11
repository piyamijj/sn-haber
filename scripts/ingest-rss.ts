/**
 * SN Haber — Manuel RSS Ingest Tetikleme Script'i
 *
 * Bu script, Vercel Cron Job'a dağıtım yapmadan ÖNCE, RSS çekme +
 * mükerrer haber engelleme (dedup) + AI işleme pipeline'ını yerel
 * ortamda manuel olarak test etmek için kullanılır.
 *
 * Kullanım:
 *   npm run ingest
 *
 * Bu komut, .env.local dosyasındaki ortam değişkenlerini (Supabase,
 * Upstash Redis, Groq, Gemini anahtarları) otomatik olarak yükler
 * (Node.js'in yerleşik --env-file desteği veya tsx'in dotenv entegrasyonu
 * üzerinden) ve ardından gerçek ingest pipeline'ını çalıştırır.
 */

import { runRssIngestPipeline } from '../lib/rss/ingest-pipeline';

/**
 * Konsola, RSS ingest pipeline'ının Türkçe özetini okunaklı bir şekilde
 * yazdırır: genel durum, sayaçlar, kaynak bazlı sonuçlar ve toplam süre.
 */
function printSummary(
  summary: Awaited<ReturnType<typeof runRssIngestPipeline>>,
  durationMs: number,
): void {
  const durationSeconds = (durationMs / 1000).toFixed(1);

  console.log('');
  console.log('========================================');
  console.log('  SN Haber — RSS Ingest Pipeline Özeti');
  console.log('========================================');
  console.log('');
  console.log(`Durum            : ${summary.durum === 'tamamlandi' ? 'Tamamlandı ✅' : 'Hata ❌'}`);
  console.log(`Mesaj            : ${summary.mesaj}`);
  console.log(`Süre             : ${durationSeconds} saniye`);
  console.log('');
  console.log('--- Sayaçlar ---');
  console.log(`İşlenen kaynak sayısı              : ${summary.islenenKaynakSayisi}`);
  console.log(`Çekilen öğe sayısı                 : ${summary.cekilenOgeSayisi}`);
  console.log(`Eklenen yeni haber sayısı          : ${summary.eklenenHaberSayisi}`);
  console.log(`Atlanan mükerrer (hash) sayısı     : ${summary.atlananMukerrerHashSayisi}`);
  console.log(`Atlanan mükerrer (anlamsal) sayısı : ${summary.atlananMukerrerAnlamsalSayisi}`);
  console.log(`Hata sayısı                        : ${summary.hataSayisi}`);
  console.log('');

  if (summary.kaynakSonuclari.length > 0) {
    console.log('--- Kaynak Bazlı Sonuçlar ---');
    for (const kaynakSonucu of summary.kaynakSonuclari) {
      const durumSimgesi = kaynakSonucu.durum === 'basarili' ? '✓' : '✗';
      console.log(`${durumSimgesi} ${kaynakSonucu.isim}: ${kaynakSonucu.detay}`);
    }
    console.log('');
  }

  console.log('========================================');
  console.log('');
}

async function main(): Promise<void> {
  console.log('RSS ingest pipeline başlatılıyor...');

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingEnvVars.length > 0) {
    console.error('');
    console.error('HATA: Aşağıdaki gerekli ortam değişkenleri tanımlı değil:');
    for (const key of missingEnvVars) {
      console.error(`  - ${key}`);
    }
    console.error('');
    console.error(
      'Lütfen .env.local dosyanızın .env.local.example şablonuna göre doldurulduğundan emin olun.',
    );
    process.exitCode = 1;
    return;
  }

  const startTime = Date.now();

  try {
    const summary = await runRssIngestPipeline();
    const durationMs = Date.now() - startTime;

    printSummary(summary, durationMs);

    process.exitCode = summary.durum === 'hata' ? 1 : 0;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const detay = error instanceof Error ? error.message : 'bilinmeyen hata';

    console.error('');
    console.error(`Pipeline beklenmeyen bir hatayla sonlandı (${(durationMs / 1000).toFixed(1)} saniye sonra):`);
    console.error(detay);
    console.error('');

    process.exitCode = 1;
  }
}

main();