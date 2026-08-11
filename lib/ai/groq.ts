import Groq from 'groq-sdk';

import type { GroqQuickProcessResult } from '@/types';

let groqClient: Groq | null = null;

/**
 * Groq istemcisini döndürür (tekil örnek).
 * Groq API, Llama-3 modelleriyle başlık/özet hızlı işleme için kullanılır.
 */
export function getGroqClient(): Groq {
  if (groqClient) {
    return groqClient;
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Groq istemcisi başlatılamadı: GROQ_API_KEY ortam değişkeni tanımlı olmalı.',
    );
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

const GROQ_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Sen SN Haber platformu için çalışan bir haber editörü yapay zekasısın.
Sana ham bir haber başlığı ve içeriği verilecek. Görevin:

1. Başlığı düzelt/temizle: gereksiz büyük harfleri, kaynak adı öneklerini,
   fazladan noktalama işaretlerini kaldır; haberin özünü net şekilde
   yansıtan, tarafsız bir Türkçe başlık üret.
2. İçerikten 2-3 cümlelik, akıcı, tarafsız bir Türkçe özet yaz.
3. Haberin en önemli 3 olgusunu/noktasını, her biri tek bir kısa cümle
   olacak şekilde 3 madde halinde çıkar (bu maddeler "Hızlı Özet"
   kutusunda gösterilecek).

Yanıtını SADECE şu JSON biçiminde ver, başka hiçbir metin ekleme:
{
  "refinedTitle": "...",
  "summary": "...",
  "quickSummaryBullets": ["...", "...", "..."]
}

Tüm çıktı Türkçe olmalı. Yorum, açıklama veya markdown kod bloğu ekleme;
sadece geçerli JSON döndür.`;

/**
 * Ham RSS başlık/içeriğini Groq (Llama-3) ile hızlı işler:
 * başlığı temizler, kısa bir özet üretir ve "Hızlı Özet" kutusu için
 * tam olarak 3 maddelik bir liste çıkarır.
 *
 * Bu fonksiyon RSS ingest pipeline'ının içinde, her yeni haber için
 * çağrılır. Toplu işlemde bir haberin başarısız olması diğerlerini
 * durdurmamalıdır — bu nedenle fonksiyon HİÇBİR ZAMAN hata fırlatmaz;
 * Groq API çağrısı veya JSON ayrıştırması başarısız olursa, ham
 * başlık/içerikten türetilmiş güvenli bir varsayılana (fallback) döner.
 */
export async function quickProcessArticle(
  rawTitle: string,
  rawContent: string,
): Promise<GroqQuickProcessResult> {
  const fallbackResult: GroqQuickProcessResult = buildFallbackResult(rawTitle, rawContent);

  try {
    const client = getGroqClient();

    const truncatedContent = rawContent.slice(0, 4000);

    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Başlık: ${rawTitle}\n\nİçerik:\n${truncatedContent}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices?.[0]?.message?.content;

    if (!rawResponse) {
      return fallbackResult;
    }

    return parseGroqResponse(rawResponse, fallbackResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'bilinmeyen hata';
    console.error(`[Groq] Haber işlenirken hata oluştu ("${rawTitle}"): ${errorMessage}`);
    return fallbackResult;
  }
}

/**
 * Groq'tan dönen ham JSON metnini güvenli bir şekilde ayrıştırır ve
 * doğrular. Beklenen alanlardan biri eksik/geçersizse, o alan için
 * fallback değerine düşer (tüm sonucu reddetmez).
 */
function parseGroqResponse(
  rawResponse: string,
  fallbackResult: GroqQuickProcessResult,
): GroqQuickProcessResult {
  try {
    const parsed = JSON.parse(rawResponse) as Partial<GroqQuickProcessResult>;

    const refinedTitle =
      typeof parsed.refinedTitle === 'string' && parsed.refinedTitle.trim().length > 0
        ? parsed.refinedTitle.trim()
        : fallbackResult.refinedTitle;

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : fallbackResult.summary;

    const quickSummaryBullets =
      Array.isArray(parsed.quickSummaryBullets) &&
      parsed.quickSummaryBullets.every((bullet) => typeof bullet === 'string')
        ? normalizeBullets(parsed.quickSummaryBullets as string[], fallbackResult.quickSummaryBullets)
        : fallbackResult.quickSummaryBullets;

    return { refinedTitle, summary, quickSummaryBullets };
  } catch {
    return fallbackResult;
  }
}

/**
 * Madde listesini tam olarak 3 öğeye normalize eder: 3'ten fazlaysa
 * kırpar, 3'ten azsa fallback maddeleriyle tamamlar, boş/anlamsız
 * maddeleri filtreler.
 */
function normalizeBullets(bullets: string[], fallbackBullets: string[]): string[] {
  const cleaned = bullets
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 3);
  }

  const combined = [...cleaned];
  for (const fallbackBullet of fallbackBullets) {
    if (combined.length >= 3) {
      break;
    }
    if (!combined.includes(fallbackBullet)) {
      combined.push(fallbackBullet);
    }
  }

  return combined.slice(0, 3);
}

/**
 * Groq API çağrısı veya yanıt ayrıştırması başarısız olduğunda kullanılan
 * güvenli varsayılan sonuç. Ham başlığı olduğu gibi kullanır ve ham
 * içerikten basit bir özet/madde listesi türetir — böylece haber, AI
 * işleme başarısız olsa bile yayınlanabilir durumda kalır.
 */
function buildFallbackResult(rawTitle: string, rawContent: string): GroqQuickProcessResult {
  const trimmedContent = rawContent.trim();
  const summary =
    trimmedContent.length > 280 ? `${trimmedContent.slice(0, 277)}...` : trimmedContent;

  const sentences = trimmedContent
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const quickSummaryBullets =
    sentences.length > 0
      ? sentences.slice(0, 3)
      : ['Bu haber için otomatik özet oluşturulamadı.'];

  return {
    refinedTitle: rawTitle.trim(),
    summary: summary || rawTitle.trim(),
    quickSummaryBullets:
      quickSummaryBullets.length >= 3
        ? quickSummaryBullets
        : [...quickSummaryBullets, ...Array(3 - quickSummaryBullets.length).fill('—')],
  };
}