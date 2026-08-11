import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ZODIAC_SIGN_ORDER, type HoroscopeReading, type ZodiacSign } from '@/types';

/** Supabase "burc_yorumlari" tablosundaki ham satır biçimi (snake_case). */
interface BurcYorumuRow {
  burc: ZodiacSign;
  yorum_metni: string;
  yorum_tarihi: string;
}

/** Europe/Istanbul saat diliminde bugünün tarihini YYYY-MM-DD biçiminde döndürür. */
function getIstanbulTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Bugünün 12 burç yorumunu, sabit burç sırasına (Koç → Balık) göre
 * sıralanmış olarak döndürür. Cron henüz o gün için çalışmamışsa
 * (örn. deploy sonrası ilk gün, ya da cron gecikmesi) boş bir dizi
 * döner — widget bileşeni bu durumda kendini gizler, hata göstermez.
 */
export async function getTodaysHoroscopes(): Promise<HoroscopeReading[]> {
  try {
    const supabase = getSupabaseServerClient();
    const todayDateString = getIstanbulTodayDateString();

    const { data, error } = await supabase
      .from('burc_yorumlari')
      .select('burc, yorum_metni, yorum_tarihi')
      .eq('yorum_tarihi', todayDateString);

    if (error || !data) {
      return [];
    }

    const rowsBySign = new Map<ZodiacSign, BurcYorumuRow>(
      (data as BurcYorumuRow[]).map((row) => [row.burc, row]),
    );

    const orderedReadings: HoroscopeReading[] = [];
    for (const sign of ZODIAC_SIGN_ORDER) {
      const row = rowsBySign.get(sign);
      if (row) {
        orderedReadings.push({
          sign: row.burc,
          commentText: row.yorum_metni,
          readingDate: row.yorum_tarihi,
        });
      }
    }

    return orderedReadings;
  } catch {
    return [];
  }
}