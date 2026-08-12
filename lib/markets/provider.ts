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
  { symbol: 'GBPTRY', label: 'Sterlin' },
  { symbol: 'XAUTRY', label: 'Altın (gr)' },
  { symbol: 'XAGTRY', label: 'Gümüş (gr)' },
  { symbol: 'BTCUSD', label: 'BTC' },
  { symbol: 'ETHUSD', label: 'ETH' },
  { symbol: 'BIST100', label: 'BIST100' },
];

/** Bir troy ons kaç gramdır — emtia fiyatlarını gram bazına çevirmek için. */
const GRAMS_PER_TROY_OUNCE = 31.1034768;

/**
 * Her MarketSymbol için gerçek veri sağlayıcısındaki (Yahoo Finance'in
 * anahtar gerektirmeyen genel "chart" uç noktası) karşılık gelen ticker
 * sembolü. Bu uç nokta resmi bir API olmasa da yaygın şekilde anahtarsız
 * kullanılan, döviz/emtia/endeks/kripto verisini tek bir kaynaktan
 * tutarlı biçimde sağlayan bir servistir.
 */
const YAHOO_SYMBOL_MAP: Record<MarketSymbol, string> = {
  USDTRY: 'TRY=X',
  EURTRY: 'EURTRY=X',
  GBPTRY: 'GBPTRY=X',
  XAUTRY: 'GC=F',
  XAGTRY: 'SI=F',
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  BIST100: 'XU100.IS',
};

const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FETCH_TIMEOUT_MS = 6000;

interface YahooChartResult {
  regularMarketPrice: number;
  chartPreviousClose: number;
}

/**
 * Yahoo Finance'in anahtarsız chart uç noktasından tek bir sembol için
 * güncel fiyat ve önceki kapanış verisini çeker. Ağ hatası veya beklenmeyen
 * yanıt biçiminde null döner (çağıran taraf bunu zarifçe ele alır).
 */
async function fetchYahooQuote(yahooSymbol: string): Promise<YahooChartResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(
      `${YAHOO_CHART_BASE}${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SNHaberBot/1.0)' },
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (
      !meta ||
      typeof meta.regularMarketPrice !== 'number' ||
      typeof meta.chartPreviousClose !== 'number'
    ) {
      return null;
    }

    return {
      regularMarketPrice: meta.regularMarketPrice,
      chartPreviousClose: meta.chartPreviousClose,
    };
  } catch {
    return null;
  }
}

function buildQuote(
  symbol: MarketSymbol,
  label: string,
  price: number,
  previousClose: number,
): MarketQuote {
  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;
  const direction = changePercent > 0.001 ? 'up' : changePercent < -0.001 ? 'down' : 'flat';

  return {
    symbol,
    label,
    price,
    changePercent,
    direction,
    updatedAt: new Date().toISOString(),
  };
}

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
export function getPlaceholderQuotes(): MarketQuote[] {
  const now = new Date().toISOString();

  const placeholderValues: Record<MarketSymbol, { price: number; changePercent: number }> = {
    USDTRY: { price: 33.5, changePercent: 0.12 },
    EURTRY: { price: 36.2, changePercent: -0.08 },
    GBPTRY: { price: 42.8, changePercent: 0.05 },
    XAUTRY: { price: 2450.75, changePercent: 0.35 },
    XAGTRY: { price: 29.4, changePercent: 0.18 },
    BTCUSD: { price: 62000, changePercent: 1.4 },
    ETHUSD: { price: 2450, changePercent: 0.9 },
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
 * Gerçek piyasa verisi sağlayıcısından (Yahoo Finance'in anahtarsız chart
 * uç noktası) tüm enstrümanlar için canlı kotasyonları paralel olarak çeker.
 *
 * Davranış:
 * 1. Önce Redis cache'ine bakar; kısa süre önce (30sn içinde) yazılmış
 *    taze veri varsa dış API'ye gitmeden onu döner.
 * 2. Cache yoksa/eskiyse, USD/TRY kurunu da içeren tüm sembolleri paralel
 *    çeker; USD/TRY kuru, emtia (altın/gümüş, USD/ons) fiyatlarını
 *    TRY/gram'a çevirmek için kullanılır.
 * 3. Sağlayıcıdan hiçbir veri alınamazsa (ağ hatası vb.), ticker'ın boş/kırık
 *    görünmemesi için açıkça işaretlenmiş yer tutucu değerlere düşer.
 */
export async function fetchLiveMarketQuotes(): Promise<MarketQuote[]> {
  try {
    const cached = await getCachedMarketQuotes();
    if (cached && cached.length > 0) {
      return cached;
    }
  } catch {
    // Redis erişilemez durumdaysa sessizce canlı veri çekmeye devam et.
  }

  const liveQuotes = await fetchAllLiveQuotes();

  if (liveQuotes.length > 0) {
    try {
      await cacheMarketQuotes(liveQuotes);
    } catch {
      // Cache yazımı başarısız olsa da ticker'ın çalışmasını engellemez.
    }
    return liveQuotes;
  }

  // Sağlayıcıdan hiçbir veri alınamadıysa (ör. dış API tamamen erişilemez),
  // açıkça "yer tutucu" olarak işaretlenmiş varsayılan değerlere düş.
  return getPlaceholderQuotes();
}

/**
 * Yahoo Finance'ten tüm enstrümanları paralel olarak çeker ve MarketQuote[]
 * biçimine dönüştürür. USD/TRY kuru, altın/gümüş (USD/ons) fiyatlarını
 * TRY/gram'a çevirmek için ayrıca kullanılır.
 */
async function fetchAllLiveQuotes(): Promise<MarketQuote[]> {
  const symbolEntries = MARKET_SYMBOLS.map(({ symbol }) => symbol);

  const results = await Promise.all(
    symbolEntries.map((symbol) => fetchYahooQuote(YAHOO_SYMBOL_MAP[symbol])),
  );

  const resultBySymbol = new Map<MarketSymbol, YahooChartResult | null>();
  symbolEntries.forEach((symbol, index) => {
    resultBySymbol.set(symbol, results[index]);
  });

  const usdTry = resultBySymbol.get('USDTRY');

  const quotes: MarketQuote[] = [];

  for (const { symbol, label } of MARKET_SYMBOLS) {
    const result = resultBySymbol.get(symbol);
    if (!result) {
      continue;
    }

    // Altın ve gümüş, Yahoo'da USD/ons olarak gelir; TRY/gram'a çeviriyoruz.
    if (symbol === 'XAUTRY' || symbol === 'XAGTRY') {
      if (!usdTry) {
        continue;
      }
      const priceTryPerGram =
        (result.regularMarketPrice * usdTry.regularMarketPrice) / GRAMS_PER_TROY_OUNCE;
      const previousTryPerGram =
        (result.chartPreviousClose * usdTry.chartPreviousClose) / GRAMS_PER_TROY_OUNCE;
      quotes.push(buildQuote(symbol, label, priceTryPerGram, previousTryPerGram));
      continue;
    }

    quotes.push(
      buildQuote(symbol, label, result.regularMarketPrice, result.chartPreviousClose),
    );
  }

  return quotes;
}