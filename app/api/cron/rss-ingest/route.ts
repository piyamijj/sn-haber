import { NextRequest, NextResponse } from 'next/server';

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
 * AŞAMA 1 İSKELETİ:
 * Bu route şu anda gerçek RSS çekme/işleme pipeline'ını ÇALIŞTIRMAZ.
 * Aşama 2'de runRssIngestPipeline() fonksiyonunun içi şu adımları
 * uygulayacak şekilde doldurulacaktır:
 *
 *   1. Supabase "kaynaklar" tablosundan aktif (aktif = true) RSS
 *      kaynaklarının listesini çek.
 *   2. Her kaynağın RSS beslemesini (rss-parser ile) ayrıştır ve
 *      yeni/güncellenmiş haber öğelerini topla.
 *   3. Her öğe için içerik hash'i (başlık + özet normalize edilip
 *      sha256) hesapla; önce Redis'te (isContentHashSeen) hızlı bir
 *      ön kontrol yap, ardından Supabase'deki content_hash UNIQUE
 *      kısıtlamasıyla kesin mükerrer kontrolü yap. Ayrıca embedding
 *      tabanlı anlamsal benzerlik kontrolü (pgvector kosinüs benzerliği)
 *      ile farklı kaynaklardan gelen ama içerik olarak aynı haberleri
 *      de mükerrer say.
 *   4. Mükerrer olmayan her yeni haber için Groq (Llama-3) ile
 *      başlık/özet hızlı işleme, ardından Gemini Flash ile detaylı
 *      analiz, doğrulama, kategorizasyon ve embedding üretimi yap.
 *   5. İşlenen haberi Supabase "haberler" tablosuna ekle; başarılı
 *      eklemeden sonra içerik hash'ini Redis'te "görüldü" olarak
 *      işaretle (markContentHashSeen).
 *   6. Kaynağın "son_cekim_zamani" ve "son_cekim_durumu" alanlarını
 *      güncelle.
 *
 * Bu fonksiyonun imzası ve döndürdüğü özet sonuç biçimi sabit tutulacak
 * şekilde tasarlandı — böylece Aşama 2 çalışması bu route'u yeniden
 * yapılandırmadan, tek fonksiyonluk izole bir değişiklik olarak
 * eklenebilecektir.
 */

interface RssIngestSummary {
  durum: 'beklemede' | 'tamamlandi' | 'hata';
  mesaj: string;
  islenenKaynakSayisi: number;
  eklenenHaberSayisi: number;
  atlananMukerrerSayisi: number;
}

/**
 * RSS ingest + dedup + AI işleme pipeline'ının çekirdek fonksiyonu.
 *
 * AŞAMA 1: Henüz uygulanmadı — sadece bekleyen durumu bildiren bir
 * özet döner. Gerçek RSS çekme, dedup ve AI işleme mantığı burada
 * YOKTUR.
 *
 * TODO (Aşama 2): Yukarıdaki 6 adımı uygulayan gerçek pipeline mantığını
 * buraya ekle (Supabase "kaynaklar" okuma, rss-parser ile besleme
 * ayrıştırma, Redis + content_hash ile dedup, Groq/Gemini işleme,
 * Supabase "haberler" tablosuna yazma).
 */
async function runRssIngestPipeline(): Promise<RssIngestSummary> {
  return {
    durum: 'beklemede',
    mesaj:
      'RSS çekme ve mükerrer haber engelleme (dedup) pipeline\'ı henüz uygulanmadı. ' +
      'Bu işlev Aşama 2\'de eklenecek: aktif RSS kaynaklarının çekilmesi, ' +
      'içerik hash\'i ve embedding tabanlı mükerrer kontrolü, Groq/Gemini ile ' +
      'başlık/özet/analiz/kategorizasyon işleme ve sonuçların Supabase ' +
      '"haberler" tablosuna yazılması.',
    islenenKaynakSayisi: 0,
    eklenenHaberSayisi: 0,
    atlananMukerrerSayisi: 0,
  };
}

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
  } catch {
    return NextResponse.json(
      {
        durum: 'hata',
        mesaj: 'RSS ingest pipeline çalıştırılırken beklenmeyen bir hata oluştu.',
        islenenKaynakSayisi: 0,
        eklenenHaberSayisi: 0,
        atlananMukerrerSayisi: 0,
      },
      { status: 500 },
    );
  }
}