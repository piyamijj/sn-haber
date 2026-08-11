import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/chat
 *
 * Sağ altta sabit duran, RAG (Retrieval-Augmented Generation) tabanlı
 * floating AI chatbot balonunun arka uç uç noktası.
 *
 * AŞAMA 1 İSKELETİ:
 * Bu route, henüz herhangi bir dış AI API'sini (Groq/Gemini) ÇAĞIRMAZ.
 * Tam RAG akışı şu adımları gerektirir:
 *   1. Kullanıcı sorusu için bir embedding üretmek (Gemini embedding modeli),
 *   2. Supabase "haberler" tablosundaki "embedding" sütunu üzerinde
 *      pgvector ile kosinüs benzerliği araması yapmak (en ilgili haberleri bulmak),
 *   3. Bulunan haberleri bağlam olarak Groq/Gemini'ye vererek yanıtı
 *      ürettirmek (RAG),
 *   4. Yanıtta atıfta bulunulan haberleri citedArticles olarak döndürmek.
 *
 * Bu akış, Aşama 2'de RSS ingest pipeline'ı Supabase'e embedding'li
 * haberleri yazmaya başladıktan ve Aşama 3'te Groq/Gemini AI
 * entegrasyonları kurulduktan sonra devreye alınacaktır.
 *
 * Şimdilik, kullanıcıya durumu açıkça belirten, yardımsever bir
 * Türkçe yer tutucu yanıt döndürülür — dış AI API çağrısı YAPILMAZ.
 *
 * TODO (Aşama 3): getAssistantReply(messages) fonksiyonunun içini,
 * yukarıdaki 4 adımı uygulayan gerçek RAG mantığıyla değiştir. Bu
 * fonksiyonun imzası ve döndürdüğü { content, citedArticles } biçimi
 * sabit tutulacak şekilde tasarlandı — böylece gerçek entegrasyon tek
 * fonksiyonluk, izole bir değişiklik olacaktır.
 */

interface IncomingChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: IncomingChatMessage[];
}

interface CitedArticleRef {
  id: string;
  slug: string;
  title: string;
}

interface AssistantReplyResult {
  content: string;
  citedArticles: CitedArticleRef[];
}

function isValidMessagesPayload(body: unknown): body is ChatRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as { messages?: unknown };

  if (!Array.isArray(candidate.messages)) {
    return false;
  }

  return candidate.messages.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item as IncomingChatMessage).role &&
      typeof (item as IncomingChatMessage).content === 'string',
  );
}

/**
 * Asistan yanıtını üreten çekirdek fonksiyon.
 *
 * AŞAMA 1: Dış AI API çağrısı yapılmaz; kullanıcıya RAG hattının henüz
 * kurulmakta olduğunu açıklayan, yardımsever bir Türkçe yanıt döner.
 *
 * AŞAMA 3'te burası şu şekilde değişecek:
 *   - son kullanıcı mesajı için Gemini embedding üretilecek,
 *   - Supabase'de pgvector ile en yakın haberler bulunacak,
 *   - Groq/Gemini'ye bu haberler bağlam olarak verilip yanıt alınacak,
 *   - bulunan haberler citedArticles olarak eklenecek.
 */
async function getAssistantReply(
  messages: IncomingChatMessage[],
): Promise<AssistantReplyResult> {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');

  const soruOzeti = lastUserMessage?.content?.trim();

  const content = soruOzeti
    ? `Sorunu aldım: "${soruOzeti}". Şu anda güncel haberler üzerinde arama yapıp sana kaynak göstererek yanıt verebilecek RAG (Bilgi Getirimi ile Zenginleştirilmiş Üretim) altyapım kurulum aşamasında. Haber veritabanı ve yapay zeka analiz hattı tamamlandığında, bu tür sorulara ilgili haberlere atıfta bulunarak yanıt verebileceğim. Şimdilik ana sayfadaki güncel haber akışına göz atabilirsin.`
    : 'Merhaba! Güncel haberler hakkında soru sorabilirsin. Haber veritabanı ve yapay zeka analiz hattı tamamlandığında, sorularına ilgili haberlere atıfta bulunarak yanıt verebileceğim.';

  return {
    content,
    citedArticles: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isValidMessagesPayload(body)) {
      return NextResponse.json(
        { hata: 'Geçersiz istek: "messages" alanı zorunludur ve bir dizi olmalıdır.' },
        { status: 400 },
      );
    }

    const result = await getAssistantReply(body.messages);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        content:
          'Üzgünüm, şu anda yanıt oluştururken bir sorun oluştu. Lütfen birazdan tekrar dener misin?',
        citedArticles: [],
      },
      { status: 200 },
    );
  }
}