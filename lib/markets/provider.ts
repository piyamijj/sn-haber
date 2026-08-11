import type { MarketQuote, MarketSymbol } from '@/types';
import { getCachedMarketQuotes, cacheMarketQuotes } from '@/lib/redis/client';

/**
 * Piyasa ticker'ında gösterilecek enstrümanların statik meta bilgisi
 * (sembol -> görünen etiket). Gerçek fiyat/değişim verisi sağlayıcıdan
 * gelir; burada yalnızca hangi enstrümanların gösterileceği tanımlanır.
 */
const MARKET_SYMBOLS: { symbol: MarketSymbol; label: string }[] = [
  { symbol: 'USDTRY', label: 'Dolar' },
  { symbol: 'EURTRY', label: 'Euro' },
  { symbol: 'XAUTRY', label: 'Altın' },
  { symbol: 'BTCUSD', label: 'BTC' },
  { symbol: 'BIST100', label: 'BIST100' },
];

/**
 * Sağlayıcıdan veri çekilemediği durumlarda kullanılan, açıkça
 * "yer tutucu" olarak işaretlenmiş varsayılan kotasyonlar. Bu değerler
 * gerçek piyasa verisi DEĞİLDİR; sadece ticker'ın boş/kırık görünmemesi
 * için bir görsel iskelet sağlar.
 *
 * TODO (Aşama 2/3): Bu fonksiyonun içini gerçek veri sağlayıcılarına
 * (TRY paritesi için TCMB/ExchangeRate-API benzeri bir kaynak, BTC için
 * bir kripto ticker API'si, BIST100 için bir borsa veri sağlayıcısı)
 * bağlayacak şekilde güncelle. Bu fonksiyonun imzası ve döndürdüğü
 * MarketQuote[] biçimi değişmeyecek şekilde tasarlandı — böylece
 * gerçek entegrasyon tek fonksiyonluk bir değişiklikle yapılabilir.
 */
function getPlaceholderQuotes(): MarketQuote[] {
  const now = new Date().toISOString();

  const placeholderValues: Record<MarketSymbol, { price: number; changePercent: number }> = {
    USDTRY: { price: 33.5, changePercent: 0.12 },
    EURTRY: { price: 36.2, changePercent: -0.08 },
    XAUTRY: { price: 2450.75, changePercent: 0.35 },
    BTCUSD: { price: 62000, changePercent: 1.4 },
    BIST100: { price: 9850.4, changePercent: -0.22 },
  };

  return MARKET_SYMBOLS.map(({ symbol, label }) => {
    const values = placeholderValues[symbol];
    const direction = values.changePercent > 0 ? 'up' : values.changePercent < 0 ? 'down' : 'flat';

    return {
      symbol,
      label,
      price: values.price,
      changePercent: values.changePercent,
      direction,
      updatedAt: now,
    };
  });
}

/**
 * Gerçek piyasa verisi sağlayıcılarından canlı kotasyonları çeker.
 *
 * Şu anki (Aşama 1 iskelet) davranış:
 * 1. Önce Redis cache'ine bakar (varsa, dış API'ye gitmeden onu döner).
 * 2. Cache boşsa, açıkça "yer tutucu" olarak işaretlenmiş varsayılan
 *    değerleri döner ve bunları kısa süreliğine cache'ler — böylece
 *    ticker bileşeni gerçek veri sağlayıcıları bağlanana kadar
 *    hatasız ve tutarlı bir şekilde render edilebilir.
 *
 * TODO (Aşama 2/3): Adım 2'de gerçek FX/emtia/kripto/BIST veri
 * sağlayıcılarına HTTP çağrıları eklenecek ve getPlaceholderQuotes()
 * çağrısı kaldırılacaktır.
 */
export async function fetchLiveMarketQuotes(): Promise<MarketQuote[]> {
  try {
    const cached = await getCachedMarketQuotes();
    if (cached && cached.length > 0) {
      return cached;
    }
  } catch {
    // Redis erişilemez durumdaysa sessizce yer tutucu değerlere düş.
  }

  const placeholderQuotes = getPlaceholderQuotes();

  try {
    await cacheMarketQuotes(placeholderQuotes);
  } catch {
    // Cache yazımı başarısız olsa da ticker'ın çalışmasını engellemez.
  }

  return placeholderQuotes;
}