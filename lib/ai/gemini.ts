import { GoogleGenerativeAI } from '@google/generative-ai';

import type { GeminiAnalysisResult, NewsCategory, AiVerificationStatus } from '@/types';

/**
 * Gemini API anahtarları — kota/hız sınırı hatası alındığında otomatik
 * olarak bir sonrakine geçmek için bir LİSTE olarak tutulur (basit
 * round-robin/fallback mekanizması).
 *
 * GEMINI_API_KEY: birincil anahtar (standart "AIzaSy..." formatı).
 * GEMINI_API_KEY_2: isteğe bağlı ikincil anahtar. Tanımlıysa, birincil
 * anahtarla yapılan bir çağrı kota/hız sınırı hatası (429 RESOURCE_EXHAUSTED
 * veya benzeri) döndürdüğünde otomatik olarak buna geçilir. Google'ın
 * standart "AIzaSy..." öneki DIŞINDA bir biçimde olsa da (örn. AI Studio'dan
 * alınan farklı biçimli bir anahtar), canlı ortamda ?key= sorgu parametresi
 * olarak GERÇEKTEN geçerli bir kimlik doğrulaması olduğu doğrulandığından
 * (curl ile generateContent çağrısı 200 döndürdü) kabul edilir — format
 * kontrolü yapılmaz, sadece API'nin kendisinin kabul edip etmediğine bakılır.
 */
const geminiClients = new Map<string, GoogleGenerativeAI>();
let activeKeyIndex = 0;

function getGeminiApiKeys(): string[] {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(
    (key): key is string => Boolean(key && key.trim().length > 0),
  );

  if (keys.length === 0) {
    throw new Error(
      'Gemini istemcisi başlatılamadı: GEMINI_API_KEY ortam değişkeni tanımlı olmalı.',
    );
  }

  return keys;
}

/**
 * Gemini istemcisini döndürür. Birden fazla anahtar tanımlıysa, en son
 * kota/hız sınırı hatası alınan anahtarı atlayıp bir sonrakini kullanır
 * (bkz. markCurrentGeminiKeyAsExhausted). Gemini Flash, detaylı analiz,
 * doğrulama, kategorizasyon ve embedding üretimi için kullanılır.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  const keys = getGeminiApiKeys();
  const currentKey = keys[activeKeyIndex % keys.length];

  const cachedClient = geminiClients.get(currentKey);
  if (cachedClient) {
    return cachedClient;
  }

  const client = new GoogleGenerativeAI(currentKey);
  geminiClients.set(currentKey, client);
  return client;
}

/**
 * Bir Gemini çağrısı kota/hız sınırı hatasıyla (429, RESOURCE_EXHAUSTED,
 * "quota" içeren mesajlar) başarısız olduğunda çağrılır. Bir sonraki
 * getGeminiClient() çağrısının SIRADAKI anahtara geçmesini sağlar.
 * Tanımlı sadece 1 anahtar varsa hiçbir etkisi olmaz (döngü kendi
 * üzerinde döner).
 */
export function markCurrentGeminiKeyAsExhausted(): void {
  const keys = getGeminiApiKeys();
  if (keys.length > 1) {
    activeKeyIndex = (activeKeyIndex + 1) % keys.length;
  }
}

/**
 * Verilen hatanın Gemini'nin kota/hız sınırı hatası olup olmadığını
 * tespit eder (429 durum kodu, "RESOURCE_EXHAUSTED" veya "quota" içeren
 * mesajlar). Bu tespit edildiğinde çağıran taraf markCurrentGeminiKeyAsExhausted
 * çağırıp isterse aynı isteği bir sonraki anahtarla tekrar deneyebilir.
 */
export function isGeminiQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota')
  );
}

// Not: 'gemini-1.5-flash' ve 'text-embedding-004' Google tarafından bu hesap
// için artık sunulmuyor (canlı doğrulamada 404 döndü). Güncel model listesi
// (ListModels) kontrol edilerek şu isimlerle değiştirildi:
//
// KRİTİK DÜZELTME: 'gemini-flash-latest' (gemini-3.6-flash) bir "thinking"
// modeli — her çağrıda ~500 token'ı gizli iç muhakemeye (thoughtsTokenCount)
// harcıyor ve free tier kotası çok düşük (günde 20 istek/model). Bu ikisi
// birlikte, canlı ortamda her haberin analiz çağrısının ya JSON'u kesik
// döndürmesine ya da kota hatası almasına, ikisinde de sessizce "gundem"
// fallback kategorisine düşülmesine yol açtı (68 haberin TÜMÜ gundem'e
// düşmüştü). 'gemini-flash-lite-latest' (gemini-3.5-flash-lite) thinking
// harcamıyor, aynı JSON şemasını güvenilir şekilde üretiyor ve kotası bu
// kullanım için yeterli — canlı doğrulamada teyit edildi.
const GEMINI_ANALYSIS_MODEL = 'gemini-flash-lite-latest';
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

const VALID_CATEGORIES: NewsCategory[] = [
  'gundem',
  'ekonomi',
  'dunya',
  'spor',
  'teknoloji',
  'saglik',
  'kultur-sanat',
  'magazin',
  'bilim',
  'yasam',
];

const VALID_VERIFICATION_STATUSES: AiVerificationStatus[] = [
  'beklemede',
  'dogrulandi',
  'suphe',
  'reddedildi',
];

const ANALYSIS_SYSTEM_PROMPT = `Sen SN Haber platformu için çalışan, deneyimli bir haber analisti ve
doğrulama uzmanı yapay zekasısın. Sana bir haberin başlığı ve içeriği
verilecek. Görevin:

1. Haberi şu kategorilerden BİRİNE ata (başka bir değer kullanma):
   gundem, ekonomi, dunya, spor, teknoloji, saglik, kultur-sanat, magazin,
   bilim, yasam.
2. Haberle ilgili 3 ile 6 arasında, kısa ve öz Türkçe etiket (tag) çıkar.
3. Haberin doğrulama durumunu değerlendir ve şu değerlerden BİRİNİ seç:
   - "dogrulandi": içerik tutarlı, somut olgulara dayanıyor, güvenilir görünüyor.
   - "suphe": içerikte belirsizlik, doğrulanmamış iddia veya çelişki var.
   - "reddedildi": içerik açıkça yanlış, tutarsız, tamamen spekülatif veya
     haber niteliği taşımıyor.
   - "beklemede": içerik yetersiz/kısa olduğu için net bir değerlendirme
     yapılamıyor.
   Seçimini 1 kısa Türkçe cümleyle (verificationNote) açıkla.
4. Bu haberin "son dakika" (flash/breaking) niteliğinde olup olmadığına
   karar ver (isFlashWorthy: true/false). Aşağıdaki türden bir olayı
   bildiren HER haberi isFlashWorthy: true olarak işaretle (bunlar
   otomatik olarak son dakika sayılır, ayrıca "önemlilik" tartışmasına
   girmene gerek yok):
   - Ölüm, cinayet, intihar veya şüpheli/cansız beden bulunması,
   - Trafik kazası, patlama, yangın, doğal afet (deprem, sel vb.),
   - Tutuklama, gözaltı, operasyon, terör olayı veya güvenlik müdahalesi,
   - Resmi bir kurum/yetkilinin YENİ bir karar, açıklama veya kriz
     duyurusu,
   - Önemli bir spor müsabakasının SONUCU (maç bitti, tur geçildi/elendi,
     transfer resmileşti vb. — henüz oynanmakta olan/önizleme haberleri
     değil).
   Bunların dışında kalan, aciliyeti olmayan ama yine de kamu ilgisi
   yüksek olan diğer haberler için de true verebilirsin; sadece rutin,
   bilgilendirici, aciliyeti olmayan duyurular (örn. başvuru tarihleri,
   genel bilgi haberleri) için false ver.

Yanıtını SADECE şu JSON biçiminde ver, başka hiçbir metin ekleme:
{
  "category": "...",
  "tags": ["...", "..."],
  "verificationStatus": "...",
  "verificationNote": "...",
  "isFlashWorthy": true veya false
}

Tüm çıktı Türkçe olmalı (kategori değeri hariç, o İngilizce/kod değeri
olarak sabit kalmalı). Yorum, açıklama veya markdown kod bloğu ekleme;
sadece geçerli JSON döndür.`;

function isValidCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && VALID_CATEGORIES.includes(value as NewsCategory);
}

function isValidVerificationStatus(value: unknown): value is AiVerificationStatus {
  return (
    typeof value === 'string' &&
    VALID_VERIFICATION_STATUSES.includes(value as AiVerificationStatus)
  );
}

/**
 * Güvenli varsayılan analiz sonucu. Gemini API çağrısı veya yanıt
 * ayrıştırması başarısız olduğunda kullanılır — haberin, AI analizi
 * başarısız olsa bile "gundem" kategorisinde ve "beklemede" doğrulama
 * durumunda yayınlanabilmesini sağlar.
 */
function buildFallbackAnalysis(): GeminiAnalysisResult {
  return {
    category: 'gundem',
    tags: [],
    verificationStatus: 'beklemede',
    verificationNote:
      'AI analizi tamamlanamadığı için doğrulama durumu otomatik olarak beklemede bırakıldı.',
    isFlashWorthy: false,
  };
}

/**
 * Ham JSON metnini GeminiAnalysisResult biçimine güvenli bir şekilde
 * ayrıştırır ve doğrular. Her alan bağımsız olarak doğrulanır; geçersiz
 * bir alan varsa o alan için fallback değerine düşülür (tüm sonuç
 * reddedilmez).
 */
function parseGeminiAnalysisResponse(rawResponse: string): GeminiAnalysisResult {
  const fallback = buildFallbackAnalysis();

  try {
    const parsed = JSON.parse(rawResponse) as Partial<{
      category: unknown;
      tags: unknown;
      verificationStatus: unknown;
      verificationNote: unknown;
      isFlashWorthy: unknown;
    }>;

    const category = isValidCategory(parsed.category) ? parsed.category : fallback.category;

    const tags =
      Array.isArray(parsed.tags) && parsed.tags.every((tag) => typeof tag === 'string')
        ? (parsed.tags as string[])
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
            .slice(0, 6)
        : fallback.tags;

    const verificationStatus = isValidVerificationStatus(parsed.verificationStatus)
      ? parsed.verificationStatus
      : fallback.verificationStatus;

    const verificationNote =
      typeof parsed.verificationNote === 'string' && parsed.verificationNote.trim().length > 0
        ? parsed.verificationNote.trim()
        : fallback.verificationNote;

    const isFlashWorthy =
      typeof parsed.isFlashWorthy === 'boolean' ? parsed.isFlashWorthy : fallback.isFlashWorthy;

    return { category, tags, verificationStatus, verificationNote, isFlashWorthy };
  } catch {
    return fallback;
  }
}

/**
 * Bir haberi Gemini Flash ile detaylı analiz eder: kategori atar, etiket
 * çıkarır, doğrulama durumunu değerlendirir ve "son dakika" niteliği
 * taşıyıp taşımadığına karar verir.
 *
 * Bu fonksiyon RSS ingest pipeline'ının içinde, Groq ile hızlı işleme
 * adımından SONRA çağrılır. Toplu işlemde bir haberin analizi başarısız
 * olsa bile diğer haberlerin işlenmesi durmamalıdır — bu nedenle
 * fonksiyon HİÇBİR ZAMAN hata fırlatmaz; API çağrısı veya JSON
 * ayrıştırması başarısız olursa güvenli bir varsayılana (fallback) döner.
 */
export async function analyzeArticle(
  title: string,
  content: string,
): Promise<GeminiAnalysisResult> {
  const truncatedContent = content.slice(0, 6000);
  // Kota hatası alınırsa bir sonraki anahtarla EN FAZLA 1 kez tekrar denenir
  // (bkz. markCurrentGeminiKeyAsExhausted) — bu yüzden en fazla 2 deneme.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: GEMINI_ANALYSIS_MODEL });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${ANALYSIS_SYSTEM_PROMPT}\n\nBaşlık: ${title}\n\nİçerik:\n${truncatedContent}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          // NOT: 'gemini-flash-latest' (gemini-3.6-flash) bir "thinking" modeli —
          // maxOutputTokens iç muhakeme (thoughtsTokenCount) için harcanan token'ları
          // da kapsar. 500 gibi düşük bir limit, modelin ~500 token'ı düşünmeye
          // harcayıp gerçek JSON yanıtına hiç yer kalmamasına (finishReason:
          // MAX_TOKENS, boş/kesik içerik) yol açıyordu — bu da JSON.parse
          // hatasıyla her haberin sessizce "gundem" fallback kategorisine
          // düşmesine sebep oluyordu (canlı doğrulamada tespit edildi). Bu yüzden
          // limit, düşünme + gerçek çıktı için yeterli paya çıkarıldı.
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      });

      const rawResponse = result.response.text();

      if (!rawResponse) {
        return buildFallbackAnalysis();
      }

      return parseGeminiAnalysisResponse(rawResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'bilinmeyen hata';

      if (isGeminiQuotaError(error) && attempt < maxAttempts) {
        console.warn(
          `[Gemini] Kota/hız sınırı hatası alındı ("${title}"), bir sonraki API anahtarıyla tekrar deneniyor.`,
        );
        markCurrentGeminiKeyAsExhausted();
        continue;
      }

      console.error(`[Gemini] Haber analiz edilirken hata oluştu ("${title}"): ${errorMessage}`);
      return buildFallbackAnalysis();
    }
  }

  return buildFallbackAnalysis();
}

/**
 * Verilen metin için Gemini'nin embedding modeliyle (gemini-embedding-001)
 * 768 boyutlu bir embedding vektörü üretir. Model varsayılan olarak 3072
 * boyut üretir; Supabase şemasındaki vector(768) sütunuyla eşleşmesi için
 * outputDimensionality:768 parametresi açıkça belirtilir (canlı API
 * doğrulamasında bu parametrenin gerçekten 768 değer döndürdüğü teyit edildi).
 *
 * Bu embedding iki amaçla kullanılır:
 *   1. RSS ingest pipeline'ında anlamsal mükerrer haber tespiti
 *      (bkz. lib/rss/dedup.ts — findSemanticDuplicate).
 *   2. RAG tabanlı floating AI chatbot'un bağlam getirimi (Aşama 3).
 *
 * API çağrısı başarısız olursa boş bir dizi döner — çağıran taraflar
 * (dedup ve RAG mantığı) boş embedding'i "anlamsal kontrol atlanabilir"
 * sinyali olarak ele almalı, hata fırlatmamalıdır.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.slice(0, 8000);
  // Kota hatası alınırsa bir sonraki anahtarla EN FAZLA 1 kez tekrar denenir.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const keys = getGeminiApiKeys();
      const apiKey = keys[activeKeyIndex % keys.length];

      // Not: @google/generative-ai SDK'sının bu projede kilitlenen sürümü
      // (^0.15.0), embedContent çağrısında outputDimensionality parametresini
      // desteklemiyor. Bu parametre, modelin varsayılan 3072 boyut yerine
      // Supabase şemasındaki vector(768) sütunuyla eşleşen 768 boyutlu vektör
      // üretmesi için ZORUNLU. Bu yüzden burada SDK'yı atlayıp doğrudan REST
      // uç noktasına istek atılır — canlı ortamda 768 değerli bir dizi
      // döndürdüğü doğrulanmıştır.
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: truncatedText }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();

        if (response.status === 429 && attempt < maxAttempts) {
          console.warn(
            '[Gemini] Embedding çağrısında kota/hız sınırı hatası, bir sonraki API anahtarıyla tekrar deneniyor.',
          );
          markCurrentGeminiKeyAsExhausted();
          continue;
        }

        console.error(
          `[Gemini] Embedding REST çağrısı başarısız (${response.status}): ${errorBody}`,
        );
        return [];
      }

      const data = (await response.json()) as { embedding?: { values?: number[] } };
      const embedding = data.embedding?.values;

      if (!embedding || embedding.length === 0) {
        return [];
      }

      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        console.error(
          `[Gemini] Beklenmeyen embedding boyutu: ${embedding.length} (beklenen: ${EMBEDDING_DIMENSIONS}).`,
        );
      }

      return embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'bilinmeyen hata';

      if (isGeminiQuotaError(error) && attempt < maxAttempts) {
        markCurrentGeminiKeyAsExhausted();
        continue;
      }

      console.error(`[Gemini] Embedding üretilirken hata oluştu: ${errorMessage}`);
      return [];
    }
  }

  return [];
}