import { NextRequest, NextResponse } from 'next/server';

import { generateDailyHoroscopes } from '@/lib/ai/horoscope';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { ZODIAC_SIGN_ORDER } from '@/types';

/**
 * GET /api/cron/burc-yorumu
 *
 * Günde 1 kez (örn. her gün 06:00'da) cron-job.org üzerinden tetiklenmesi
 * planlanan bir uç nokta — bu proje Vercel Cron Job kullanmadığından
 * (vercel.json yok), rss-ingest ile AYNI dış cron mekanizmasını kullanır.
 *
 * Kimlik doğrulama: app/api/cron/rss-ingest/route.ts ile birebir aynı
 * CRON_SECRET Bearer header kontrolü.
 *
 * Çalışma adımları:
 *   1. Europe/Istanbul takvim gününü hesaplar (YYYY-MM-DD).
 *   2. Gemini'den TEK bir çağrıyla 12 burcun tamamı için günlük yorum
 *      metnini alır (bkz. lib/ai/horoscope.ts — API hatası olsa da
 *      güvenli bir yedek metinle her zaman 12 burç döner, bu fonksiyon
 *      asla hata fırlatmaz).
 *   3. 12 satırı burc_yorumlari tablosuna upsert eder (burc, yorum_tarihi)
 *      üzerindeki UNIQUE kısıtı sayesinde günde birden fazla tetiklenirse
 *      bile mükerrer satır oluşmaz, üzerine güvenle yazılır.
 */
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/** Europe/Istanbul saat diliminde bugünün tarihini YYYY-MM-DD biçiminde döndürür. */
function getIstanbulTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' locale'i YYYY-MM-DD biçimini garanti eder.
  return formatter.format(new Date());
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
    const todayDateString = getIstanbulTodayDateString();
    const horoscopes = await generateDailyHoroscopes();

    const rows = ZODIAC_SIGN_ORDER.map((sign) => ({
      burc: sign,
      yorum_metni: horoscopes[sign],
      yorum_tarihi: todayDateString,
    }));

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('burc_yorumlari')
      .upsert(rows, { onConflict: 'burc,yorum_tarihi' });

    if (error) {
      return NextResponse.json(
        {
          durum: 'hata',
          mesaj: `Burç yorumları veritabanına yazılırken hata oluştu: ${error.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      durum: 'tamamlandi',
      mesaj: `${todayDateString} tarihi için 12 burcun günlük yorumu başarıyla üretildi ve kaydedildi.`,
      tarih: todayDateString,
      burcSayisi: rows.length,
    });
  } catch (error) {
    const detay = error instanceof Error ? error.message : 'bilinmeyen hata';
    return NextResponse.json(
      {
        durum: 'hata',
        mesaj: `Burç yorumu cron işlemi çalıştırılırken beklenmeyen bir hata oluştu: ${detay}`,
      },
      { status: 500 },
    );
  }
}