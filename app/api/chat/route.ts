import { NextRequest, NextResponse } from 'next/server';
import { getAssistantReply } from '@/lib/ai/rag-chat';

/**
 * POST /api/chat
 *
 * Sağ altta sabit duran, RAG (Bilgi Getirimi ile Zenginleştirilmiş Üretim)
 * tabanlı floating AI chatbot balonunun arka uç uç noktası.
 *
 * AŞAMA 3: Bu route artık gerçek RAG hattına bağlıdır (lib/ai/rag-chat.ts):
 *   1. Kullanıcının son mesajı için Gemini embedding modeliyle bir vektör üretilir,
 *   2. Supabase "haberler" tablosunda pgvector ile kosinüs benzerliği araması yapılır
 *      (match_haberler_for_rag RPC'si, son 7 gün içindeki haberlerle sınırlı),
 *   3. Bulunan haberler bağlam olarak Groq'a (Llama-3.1) verilir ve yanıt üretilir,
 *   4. Yanıtta atıfta bulunulan haberler citedArticles olarak döndürülür.
 *
 * Her adım kendi içinde hataya karşı korumalıdır (lib/ai/rag-chat.ts asla
 * hata fırlatmaz, her durumda kullanıcıya anlaşılır bir Türkçe yanıt döner).
 * Buradaki try/catch, ek bir güvenlik katmanı olarak tutulmuştur.
 */

interface IncomingChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: IncomingChatMessage[];
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
      ((item as IncomingChatMessage).role === 'user' ||
        (item as IncomingChatMessage).role === 'assistant') &&
      typeof (item as IncomingChatMessage).content === 'string',
  );
}

export const dynamic = 'force-dynamic';

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