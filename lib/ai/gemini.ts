import { GoogleGenerativeAI } from '@google/generative-ai';

import type { GeminiAnalysisResult, NewsCategory, AiVerificationStatus } from '@/types';

let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Gemini istemcisini döndürür (tekil örnek).
 * Gemini Flash, detaylı analiz, doğrulama, kategorizasyon ve embedding
 * üretimi için kullanılır.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (geminiClient) {
    return geminiClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini istemcisi başlatılamadı: GEMINI_API_KEY ortam değişkeni tanımlı olmalı.',
    );
  }

  geminiClient = new GoogleGenerativeAI(apiKey);
  return geminiClient;
}

const GEMINI_ANALYSIS_MODEL = 'gemini-1.5-flash';
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
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
   karar ver (isFlashWorthy: true/false) — aciliyet, önemli bir gelişme,
   yüksek kamu ilgisi taşıyan olaylar için true.

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
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: GEMINI_ANALYSIS_MODEL });

    const truncatedContent = content.slice(0, 6000);

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
        maxOutputTokens: 500,
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
    console.error(`[Gemini] Haber analiz edilirken hata oluştu ("${title}"): ${errorMessage}`);
    return buildFallbackAnalysis();
  }
}

/**
 * Verilen metin için Gemini'nin text-embedding-004 modeliyle 768
 * boyutlu bir embedding vektörü üretir.
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
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

    const truncatedText = text.slice(0, 8000);

    const result = await model.embedContent(truncatedText);
    const embedding = result.embedding?.values;

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
    console.error(`[Gemini] Embedding üretilirken hata oluştu: ${errorMessage}`);
    return [];
  }
}