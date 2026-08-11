import { NextRequest, NextResponse } from 'next/server';

import { runRssIngestPipeline } from '@/lib/rss/ingest-pipeline';

/**
 * GET /api/cron/rss-ingest
 *
 * Vercel Cron Job hedefi — vercel.json içindeki tanıma göre her 10
 * dakikada bir ("*\/10 * * * *") otomatik olarak çağrılır.
 *
 * Kimlik doğrulama:
 * Vercel Cron Job'lar bu uç noktayı çağırırken Authorization header'ında
 * "Bearer <CRON_SECRET>" değerini gönderir. Bu değer, Vercel proje
 * ortam değişkenlerinde tanımlı CRON_SECRET ile eşleşmelidir; eşleşmezse
 * istek yetkisiz (401) olarak reddedilir. Bu, uç noktanın dışarıdan
 * rastgele tetiklenmesini önler.
 *
 * Bu route, gerçek RSS çekme + mükerrer haber engelleme (dedup) + AI
 * işleme pipeline'ını (lib/rss/ingest-pipeline.ts) çalıştırır:
 *   1. Supabase "kaynaklar" tablosundan aktif RSS kaynaklarını okur.
 *   2. Her kaynağın RSS beslemesini paralel olarak çeker.
 *   3. Her öğe için içerik hash'i + Redis ön kontrolü ile hızlı mükerrer
 *      tespiti yapar.
 *   4. Mükerrer olmayan öğeleri Groq (hızlı özet) ve Gemini (detaylı
 *      analiz + embedding) ile işler.
 *   5. Embedding tabanlı anlamsal mükerrer kontrolü yapar.
 *   6. Mükerrer olmayan haberleri Supabase "haberler" tablosuna ekler.
 *   7. Kaynakların son çekim zamanı/durumunu günceller.
 *
 * AI işleme (Groq/Gemini) çağrıları ve çoklu RSS beslemesi çekimi zaman
 * alabileceğinden, bu route'un maksimum çalışma süresi 120 saniyeye
 * çıkarılmıştır ve hiçbir zaman statik olarak cache'lenmemesi için
 * dynamic="force-dynamic" olarak işaretlenmiştir.
 */

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      {
        hata:
          'CRON_SECRET ortam değişkeni tanımlı değil. Vercel proje ayarlarından ' +
          'bu değişkeni ekleyin.',
      },
      { status: 500 },
    );
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { hata: 'Yetkisiz istek: geçersiz veya eksik CRON_SECRET.' },
      { status: 401 },
    );
  }

  try {
    const summary = await runRssIngestPipeline();
    return NextResponse.json(summary);
  } catch (error) {
    const detay = error instanceof Error ? error.message : 'bilinmeyen hata';
    return NextResponse.json(
      {
        durum: 'hata',
        mesaj: `RSS ingest pipeline çalıştırılırken beklenmeyen bir hata oluştu: ${detay}`,
        islenenKaynakSayisi: 0,
        cekilenOgeSayisi: 0,
        eklenenHaberSayisi: 0,
        atlananMukerrerHashSayisi: 0,
        atlananMukerrerAnlamsalSayisi: 0,
        hataSayisi: 1,
        kaynakSonuclari: [],
      },
      { status: 500 },
    );
  }
}