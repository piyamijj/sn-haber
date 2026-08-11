/**
 * SN Haber — Paylaşılan tip tanımları
 * Bu dosya, uygulama genelinde (bileşenler, API route'ları, veri erişim
 * katmanı) kullanılan çekirdek TypeScript tiplerini içerir.
 */

/** Haber kategorileri — Supabase "haberler" tablosundaki "category" alanıyla eşleşir. */
export type NewsCategory =
  | 'gundem'
  | 'ekonomi'
  | 'dunya'
  | 'spor'
  | 'teknoloji'
  | 'saglik'
  | 'kultur-sanat'
  | 'magazin'
  | 'bilim'
  | 'yasam';

export const NEWS_CATEGORY_LABELS_TR: Record<NewsCategory, string> = {
  gundem: 'Gündem',
  ekonomi: 'Ekonomi',
  dunya: 'Dünya',
  spor: 'Spor',
  teknoloji: 'Teknoloji',
  saglik: 'Sağlık',
  'kultur-sanat': 'Kültür & Sanat',
  magazin: 'Magazin',
  bilim: 'Bilim',
  yasam: 'Yaşam',
};

/** AI doğrulama/kategorizasyon durumu (Gemini Flash tarafından üretilir). */
export type AiVerificationStatus = 'beklemede' | 'dogrulandi' | 'suphe' | 'reddedildi';

/**
 * Supabase "haberler" tablosundaki bir haber kaydının uygulama içi karşılığı.
 */
export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Groq/Gemini tarafından üretilen 3 maddelik "Hızlı Özet" listesi. */
  aiQuickSummary: string[];
  content: string;
  category: NewsCategory;
  tags: string[];
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  isFlash: boolean;
  aiVerificationStatus: AiVerificationStatus;
  /** Mükerrer haber tespiti için içerik hash'i veya embedding referansı. */
  contentHash: string;
  embeddingId: string | null;
  viewCount: number;
}

/** Ana sayfa/kategori akışında kullanılan hafif liste öğesi biçimi. */
export type NewsArticleListItem = Pick<
  NewsArticle,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'category'
  | 'sourceName'
  | 'imageUrl'
  | 'publishedAt'
  | 'readingTimeMinutes'
  | 'isFlash'
>;

/** Sayfalanmış haber listesi API yanıtı — infinite-scroll için kullanılır. */
export interface PaginatedNewsResponse {
  items: NewsArticleListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Üstte kayan son dakika (flash) haber bandı öğesi. */
export interface FlashNewsItem {
  id: string;
  slug: string;
  title: string;
  publishedAt: string;
}

/** Piyasa ticker'ında gösterilen enstrüman sembolleri. */
export type MarketSymbol =
  | 'USDTRY'
  | 'EURTRY'
  | 'GBPTRY'
  | 'XAUTRY'
  | 'XAGTRY'
  | 'BTCUSD'
  | 'ETHUSD'
  | 'BIST100';

export type MarketDirection = 'up' | 'down' | 'flat';

/** Canlı piyasa ticker'ı için tekil kotasyon (Dolar, Euro, Altın, BTC, BIST100). */
export interface MarketQuote {
  symbol: MarketSymbol;
  label: string;
  price: number;
  changePercent: number;
  direction: MarketDirection;
  updatedAt: string;
}

/** RAG tabanlı floating AI chatbot'ta kullanılan sohbet mesajı. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Yanıt üretiminde referans alınan haber kaynakları (RAG bağlamı). */
  citedArticles?: Pick<NewsArticle, 'id' | 'slug' | 'title'>[];
  createdAt: string;
}

/** RSS ingest pipeline'ının bir kaynaktan çektiği ham öğe. */
export interface RssFeedItem {
  sourceName: string;
  sourceUrl: string;
  title: string;
  link: string;
  contentSnippet: string;
  isoDate: string | null;
  imageUrl: string | null;
}

/** Groq hızlı işleme aşamasının çıktısı (başlık/özet). */
export interface GroqQuickProcessResult {
  refinedTitle: string;
  summary: string;
  quickSummaryBullets: string[];
}

/** Gemini Flash detaylı analiz aşamasının çıktısı (doğrulama + kategorizasyon). */
export interface GeminiAnalysisResult {
  category: NewsCategory;
  tags: string[];
  verificationStatus: AiVerificationStatus;
  verificationNote: string;
  isFlashWorthy: boolean;
}

/** 12 burç işareti — Supabase "burc_yorumlari" tablosundaki "burc" alanıyla eşleşir. */
export type ZodiacSign =
  | 'koc'
  | 'boga'
  | 'ikizler'
  | 'yengec'
  | 'aslan'
  | 'basak'
  | 'terazi'
  | 'akrep'
  | 'yay'
  | 'oglak'
  | 'kova'
  | 'balik';

export const ZODIAC_SIGN_LABELS_TR: Record<ZodiacSign, string> = {
  koc: 'Koç',
  boga: 'Boğa',
  ikizler: 'İkizler',
  yengec: 'Yengeç',
  aslan: 'Aslan',
  basak: 'Başak',
  terazi: 'Terazi',
  akrep: 'Akrep',
  yay: 'Yay',
  oglak: 'Oğlak',
  kova: 'Kova',
  balik: 'Balık',
};

/** Her burcun tarih aralığı gösterimi (kullanıcı arayüzünde ipucu olarak gösterilir). */
export const ZODIAC_SIGN_DATE_RANGES_TR: Record<ZodiacSign, string> = {
  koc: '21 Mart - 19 Nisan',
  boga: '20 Nisan - 20 Mayıs',
  ikizler: '21 Mayıs - 20 Haziran',
  yengec: '21 Haziran - 22 Temmuz',
  aslan: '23 Temmuz - 22 Ağustos',
  basak: '23 Ağustos - 22 Eylül',
  terazi: '23 Eylül - 22 Ekim',
  akrep: '23 Ekim - 21 Kasım',
  yay: '22 Kasım - 21 Aralık',
  oglak: '22 Aralık - 19 Ocak',
  kova: '20 Ocak - 18 Şubat',
  balik: '19 Şubat - 20 Mart',
};

/** Sıralı burç listesi — UI'da tutarlı bir sırayla göstermek için kullanılır. */
export const ZODIAC_SIGN_ORDER: ZodiacSign[] = [
  'koc',
  'boga',
  'ikizler',
  'yengec',
  'aslan',
  'basak',
  'terazi',
  'akrep',
  'yay',
  'oglak',
  'kova',
  'balik',
];

/** Supabase "burc_yorumlari" tablosundaki bir günlük burç yorumu kaydı. */
export interface HoroscopeReading {
  sign: ZodiacSign;
  /** AI (Gemini) tarafından üretilen 2-3 cümlelik günlük yorum metni. */
  commentText: string;
  /** Yorumun ait olduğu takvim günü (YYYY-MM-DD, Europe/Istanbul). */
  readingDate: string;
}

/** Hava durumu widget'ının /api/weather uç noktasından döndürdüğü veri. */
export interface WeatherSnapshot {
  cityName: string;
  temperatureCelsius: number;
  /** Open-Meteo WMO hava kodu — ikon/etiket eşlemesi için kullanılır. */
  weatherCode: number;
  isDay: boolean;
}