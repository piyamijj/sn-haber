import { getGroqClient } from "@/lib/ai/groq";
import { generateEmbedding } from "@/lib/ai/gemini";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Bu modül, /api/chat route'undan gelen hafif mesaj biçimini kabul eder.
 * types/index.ts'teki tam ChatMessage (id/createdAt/citedArticles dahil)
 * istemci (UI) tarafının kullandığı zengin biçimdir; burada sadece
 * modele gönderilecek role+content çifti yeterlidir.
 */
export interface RagChatInputMessage {
  role: "user" | "assistant";
  content: string;
}

interface RagArticleMatch {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  published_at: string;
  distance: number;
}

interface AssistantReplyResult {
  content: string;
  citedArticles: { title: string; slug: string }[];
}

const MAX_CONTEXT_ARTICLES = 6;
const RAG_DAY_RANGE = 7;
// NOT: 'llama-3.1-8b-instant' 16 Ağustos 2026'da Groq tarafından
// kullanımdan kaldırıldı; yerine 'openai/gpt-oss-120b' kullanılıyor
// (reasoning_effort: 'low' ile hızlı/temiz yanıt için, bkz. groq.ts).
const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

const NO_SEARCH_FALLBACK_TR =
  "Şu anda güncel haberler arasında arama yapamıyorum, kısa bir teknik sorun oluştu. Lütfen birazdan tekrar dener misin?";

const NO_MATCH_FALLBACK_TR =
  "Bu soruyla ilgili son 7 gün içinde yayınlanmış bir haber bulamadım. Sorunu biraz daha farklı ifade edebilir misin, ya da güncel bir olayla mı ilgili emin misin? Haber dışı genel bir soru ise elimden geldiğince yine de yardımcı olmaya çalışabilirim, ama en doğru yanıtları güncel haberler hakkındaki sorularda verebiliyorum."

function buildSystemPrompt(articles: RagArticleMatch[]): string {
  if (articles.length === 0) {
    return [
      "Sen SN Haber adlı bir haber platformunun yapay zeka asistanısın.",
      "Kullanıcının sorusuyla ilgili bağlamında hiçbir güncel haber bulunamadı.",
      "Bu durumda, elinde haber bağlamı olmadığını Türkçe olarak açıkça belirt,",
      "asla haber icat etme veya tahmin yürütme. Soru haberle ilgili değilse",
      "kısa ve nazik bir şekilde genel bilgiyle yardımcı olabilirsin, ama bunun",
      "güncel haber kaynağına dayanmadığını netçe söyle.",
    ].join(" ");
  }

  const contextBlock = articles
    .map((article, index) => {
      const shortContent = article.content?.slice(0, 800) ?? "";
      return [
        `[${index + 1}] Başlık: ${article.title}`,
        `Slug: ${article.slug}`,
        `Kategori: ${article.category}`,
        `Yayın Tarihi: ${article.published_at}`,
        `Özet: ${article.summary}`,
        `İçerik (kısaltılmış): ${shortContent}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Sen SN Haber adlı bir AI destekli haber platformunun sağ alt köşesinde yaşayan,",
    "kullanıcılara güncel haberler hakkında yardımcı olan bir yapay zeka asistanısın.",
    "Yanıtlarını SADECE aşağıda verilen haber bağlamına dayandır. Bağlamda yer almayan",
    "hiçbir bilgiyi kesinlikle uydurma veya tahmin etme (hallucination yasak).",
    "Eğer bağlamdaki haberler kullanıcının sorusunu tam karşılamıyorsa, bunu Türkçe",
    "olarak açıkça söyle ve elindeki en yakın bilgiyi paylaş.",
    "Yanıtların kısa, öz ve gazetecilik diline uygun bir Türkçeyle yazılmış olsun.",
    "Hangi haber(ler)e dayanarak yanıt verdiğini, yanıtının sonunda parantez içinde",
    "haber başlıklarıyla belirt, örneğin: (Kaynak: <haber başlığı>).",
    "",
    "=== GÜNCEL HABER BAĞLAMI ===",
    contextBlock,
    "=== BAĞLAM SONU ===",
  ].join("\n");
}

function extractCitedArticles(
  replyText: string,
  articles: RagArticleMatch[]
): { title: string; slug: string }[] {
  if (articles.length === 0) return [];

  const cited = articles.filter((article) =>
    replyText.toLowerCase().includes(article.title.toLowerCase().slice(0, 20))
  );

  if (cited.length > 0) {
    return cited.map((article) => ({ title: article.title, slug: article.slug }));
  }

  // Model referansı metinde tam yakalanamadıysa, bağlam olarak kullanılan
  // ilk 3 haberi güvenli bir varsayım olarak öner (kullanıcı en azından
  // hangi haberlere bakıldığını görebilsin).
  return articles.slice(0, 3).map((article) => ({
    title: article.title,
    slug: article.slug,
  }));
}

export async function getAssistantReply(
  messages: RagChatInputMessage[]
): Promise<AssistantReplyResult> {
  try {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUserMessage || !lastUserMessage.content?.trim()) {
      return {
        content: "Bir soru yazmayı unutmuş olabilirsin, tekrar dener misin?",
        citedArticles: [],
      };
    }

    const queryEmbedding = await generateEmbedding(lastUserMessage.content);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return { content: NO_SEARCH_FALLBACK_TR, citedArticles: [] };
    }

    const supabase = getSupabaseServiceClient();
    const { data: matches, error } = await supabase.rpc("match_haberler_for_rag", {
      query_embedding: queryEmbedding,
      match_count: MAX_CONTEXT_ARTICLES,
      gun_araligi: RAG_DAY_RANGE,
    });

    if (error) {
      console.error("[rag-chat] match_haberler_for_rag hatası:", error.message);
      return { content: NO_SEARCH_FALLBACK_TR, citedArticles: [] };
    }

    const articles: RagArticleMatch[] = Array.isArray(matches) ? matches : [];

    if (articles.length === 0) {
      return { content: NO_MATCH_FALLBACK_TR, citedArticles: [] };
    }

    const systemPrompt = buildSystemPrompt(articles);

    const conversationForModel = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationForModel,
      ],
    });

    const replyText =
      completion.choices?.[0]?.message?.content?.trim() ??
      "Şu anda bir yanıt üretemedim, tekrar dener misin?";

    const citedArticles = extractCitedArticles(replyText, articles);

    return { content: replyText, citedArticles };
  } catch (err) {
    console.error("[rag-chat] getAssistantReply beklenmeyen hata:", err);
    return {
      content:
        "Üzgünüm, yanıt üretirken beklenmeyen bir sorun oluştu. Lütfen birazdan tekrar dener misin?",
      citedArticles: [],
    };
  }
}