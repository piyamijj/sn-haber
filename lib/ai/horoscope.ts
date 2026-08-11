import { getGeminiClient } from '@/lib/ai/gemini';
import { ZODIAC_SIGN_ORDER, ZODIAC_SIGN_LABELS_TR, type ZodiacSign } from '@/types';

const GEMINI_HOROSCOPE_MODEL = 'gemini-flash-lite-latest';

const HOROSCOPE_SYSTEM_PROMPT = `Sen deneyimli bir astrologsun. Türkçe, günlük burç yorumları
yazıyorsun. Aşağıda listelenen 12 burcun HER biri için, o günün genel enerjisine dair 2-3
cümlelik, olumlu ve akıcı bir günlük yorum yaz. Yorumlar birbirinden farklı ve özgün olsun,
şablon gibi tekrar etmesin. Aşırı iddialı kesin tahminlerden (kesin tarih, kesin isim vb.)
kaçın, genel ilham verici bir ton kullan (aşk/ilişkiler, iş/kariyer, ruh hali gibi konulara
hafifçe dokunabilirsin).

SADECE şu JSON şemasında yanıt ver, başka hiçbir açıklama ekleme:
{
  "yorumlar": {
    "koc": "...",
    "boga": "...",
    "ikizler": "...",
    "yengec": "...",
    "aslan": "...",
    "basak": "...",
    "terazi": "...",
    "akrep": "...",
    "yay": "...",
    "oglak": "...",
    "kova": "...",
    "balik": "..."
  }
}`;

/**
 * Genel bir hata durumunda (API hatası, kota, ayrıştırma hatası) her burç
 * için gösterilecek güvenli, jenerik bir yedek metin üretir. Widget'ın
 * boş/kırık görünmesindense nötr ama makul bir mesaj göstermesi tercih
 * edilir.
 */
function buildFallbackHoroscopes(): Record<ZodiacSign, string> {
  const fallback: Partial<Record<ZodiacSign, string>> = {};

  for (const sign of ZODIAC_SIGN_ORDER) {
    fallback[sign] =
      `${ZODIAC_SIGN_LABELS_TR[sign]} burcu için bugün dengeli ve sakin bir gün seni ` +
      'bekliyor. Kendine ve çevrene karşı sabırlı olman, gün içinde karşına çıkacak ' +
      'fırsatları daha iyi değerlendirmeni sağlayacak.';
  }

  return fallback as Record<ZodiacSign, string>;
}

/**
 * Gemini'nin JSON yanıtını ayrıştırır ve 12 burcun tamamının dolu
 * olduğunu doğrular. Herhangi bir burç eksik/boşsa o burç için fallback
 * metni kullanılır (kısmi başarı, tam başarısızlık değil).
 */
function parseHoroscopeResponse(rawResponse: string): Record<ZodiacSign, string> {
  const fallback = buildFallbackHoroscopes();

  try {
    const parsed = JSON.parse(rawResponse) as { yorumlar?: Record<string, unknown> };
    const yorumlar = parsed.yorumlar;

    if (!yorumlar || typeof yorumlar !== 'object') {
      return fallback;
    }

    const result: Partial<Record<ZodiacSign, string>> = {};

    for (const sign of ZODIAC_SIGN_ORDER) {
      const value = yorumlar[sign];
      result[sign] =
        typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback[sign];
    }

    return result as Record<ZodiacSign, string>;
  } catch {
    return fallback;
  }
}

/**
 * 12 burcun tamamı için günlük yorum metnini TEK bir Gemini API çağrısında
 * üretir (12 ayrı çağrı yerine) — hem daha hızlı hem de günlük kota
 * kullanımını minimumda tutar (günde sadece 1 çağrı, cron tarafından
 * tetiklenir). API çağrısı veya JSON ayrıştırması başarısız olursa bu
 * fonksiyon HİÇBİR ZAMAN hata fırlatmaz; her burç için güvenli bir
 * yedek metinle doldurulmuş bir sonuç döner (bkz. lib/ai/gemini.ts
 * analyzeArticle ile aynı "asla throw etme" prensibi).
 */
export async function generateDailyHoroscopes(): Promise<Record<ZodiacSign, string>> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: GEMINI_HOROSCOPE_MODEL });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: HOROSCOPE_SYSTEM_PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    const rawResponse = result.response.text();

    if (!rawResponse) {
      return buildFallbackHoroscopes();
    }

    return parseHoroscopeResponse(rawResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'bilinmeyen hata';
    console.error(`[Gemini] Günlük burç yorumları üretilirken hata oluştu: ${errorMessage}`);
    return buildFallbackHoroscopes();
  }
}