import { createHash } from 'crypto';

import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { isContentHashSeen } from '@/lib/redis/client';

/**
 * Anlamsal (embedding) mükerrer tespiti için kosinüs benzerliği eşiği.
 * Bu değerin üzerindeki benzerlik skoru, iki haberin farklı kaynaklardan
 * farklı kelimelerle bildirilmiş AYNI olay olduğunu gösterir kabul edilir.
 *
 * 0.92 gibi yüksek bir eşik seçilmiştir: amaç, sadece "aynı konu" değil,
 * "aynı haber olayı" olan içerikleri yakalamaktır — çok agresif bir eşik
 * (örn. 0.80) farklı ama ilişkili haberleri de mükerrer sayabilir.
 */
export const SIMILARITY_THRESHOLD = 0.92;

/**
 * pgvector aramasında dikkate alınacak en yakın aday sayısı.
 * Sadece en yakın komşuları çekmek, tüm tabloyu taramaktan çok daha
 * hızlıdır ve HNSW indeksinden faydalanır.
 */
const SEMANTIC_CANDIDATE_LIMIT = 5;

/**
 * Bir metni, hash hesaplamadan önce normalize eder: küçük harfe çevirir,
 * baştaki/sondaki ve tekrarlayan boşlukları sıkıştırır, Türkçe özel
 * karakterleri korur (hash'in Türkçe metinlerde tutarlı çalışması için
 * `toLocaleLowerCase('tr-TR')` kullanılır). Bu normalizasyon, aynı
 * haberin küçük noktalama/boşluk farklılıklarıyla farklı hash üretip
 * dedup kontrolünü atlatmasını önler.
 */
function normalizeTextForHash(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKC')
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

/**
 * Başlık ve özet metninden SHA-256 içerik hash'i üretir.
 *
 * Bu hash, RSS ingest pipeline'ındaki HIZLI ve KESİN mükerrer kontrolü
 * için kullanılır: aynı haber aynı kaynaktan (veya çok benzer başlık/
 * özetle başka bir kaynaktan) tekrar çekildiğinde, normalize edilmiş
 * metin aynı olacağı için aynı hash üretilir.
 *
 * Not: Bu, tam eşleşme (exact-match) kontrolüdür. Farklı kaynakların
 * aynı olayı tamamen farklı kelimelerle anlatması durumunda hash farklı
 * çıkar — bu durum, aşağıdaki embedding tabanlı anlamsal benzerlik
 * kontrolüyle (findSemanticDuplicate) yakalanır.
 */
export function computeContentHash(title: string, snippet: string): string {
  const normalizedTitle = normalizeTextForHash(title);
  const normalizedSnippet = normalizeTextForHash(snippet);
  const combined = `${normalizedTitle}|${normalizedSnippet}`;

  return createHash('sha256').update(combined, 'utf8').digest('hex');
}

/**
 * İki embedding vektörü arasındaki kosinüs benzerliğini hesaplar.
 * Dönen değer -1 ile 1 arasındadır; 1'e ne kadar yakınsa vektörler o
 * kadar benzerdir. Gemini embedding modelinin ürettiği vektörler zaten
 * normalize edilmiş olsa da, bu fonksiyon herhangi bir vektör çifti için
 * güvenle çalışacak şekilde tam kosinüs benzerliği formülünü uygular.
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length || vectorA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < vectorA.length; index += 1) {
    const a = vectorA[index];
    const b = vectorB[index];
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Bir Supabase pgvector benzerlik aramasından dönen aday satırın biçimi.
 */
interface SemanticCandidateRow {
  id: string;
  title: string;
  slug: string;
  /** pgvector'ın <=> operatörü kosinüs UZAKLIĞINI döner (1 - benzerlik). */
  distance: number;
}

/**
 * Anlamsal mükerrer tespiti sonucu.
 */
export interface SemanticDuplicateResult {
  isDuplicate: boolean;
  matchedArticleId: string | null;
  matchedArticleTitle: string | null;
  similarity: number | null;
}

/**
 * Verilen embedding vektörüne pgvector kosinüs uzaklığı operatörü (<=>)
 * ile en yakın mevcut haberleri Supabase'den sorgular ve en yakın adayın
 * benzerlik skoru SIMILARITY_THRESHOLD üzerindeyse bunu mükerrer olarak
 * işaretler.
 *
 * Bu kontrol, aynı olayın farklı kaynaklarca farklı kelimelerle
 * bildirildiği durumları yakalamak için content_hash tam eşleşme
 * kontrolünün TAMAMLAYICISI olarak kullanılır — hash kontrolü mükerrer
 * bulamadığında bu fonksiyon ikinci güvenlik katmanı olarak çalışır.
 *
 * Supabase tarafında bu sorgu, aşağıdaki gibi bir RPC fonksiyonu
 * üzerinden çalıştırılır (bkz. supabase/migrations/0002_semantic_search.sql
 * — Aşama 2 devamında eklenecek `match_haberler_by_embedding` RPC'si).
 * RPC henüz tanımlı değilse veya sorgu başarısız olursa, fonksiyon
 * güvenli tarafta kalarak "mükerrer değil" sonucu döner — böylece
 * anlamsal kontroldeki bir altyapı sorunu, yeni haberlerin hiç
 * yayınlanamamasına neden olmaz.
 */
export async function findSemanticDuplicate(
  embedding: number[],
): Promise<SemanticDuplicateResult> {
  const emptyResult: SemanticDuplicateResult = {
    isDuplicate: false,
    matchedArticleId: null,
    matchedArticleTitle: null,
    similarity: null,
  };

  if (!embedding || embedding.length === 0) {
    return emptyResult;
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase.rpc('match_haberler_by_embedding', {
      query_embedding: embedding,
      match_count: SEMANTIC_CANDIDATE_LIMIT,
    });

    if (error || !data || data.length === 0) {
      return emptyResult;
    }

    const candidates = data as SemanticCandidateRow[];
    const closest = candidates[0];

    // pgvector <=> operatörü kosinüs UZAKLIĞINI döner (0 = aynı, 2 = tam ters).
    // Benzerlik = 1 - uzaklık.
    const similarity = 1 - closest.distance;

    if (similarity >= SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        matchedArticleId: closest.id,
        matchedArticleTitle: closest.title,
        similarity,
      };
    }

    return {
      isDuplicate: false,
      matchedArticleId: null,
      matchedArticleTitle: null,
      similarity,
    };
  } catch {
    // Anlamsal kontrol altyapısı (RPC, bağlantı) sorunluysa, güvenli
    // tarafta kalıp mükerrer olmadığını varsay — hash kontrolü zaten
    // birincil güvenlik katmanıdır.
    return emptyResult;
  }
}

/**
 * Bir haber öğesinin mükerrer olup olmadığını iki katmanlı stratejiyle
 * kontrol eder:
 *   1. Redis'te içerik hash'i daha önce görülmüş mü? (hızlı ön kontrol)
 *   2. (Çağıran taraf, Redis "hayır" derse) Supabase content_hash UNIQUE
 *      kısıtlaması ile kesin kontrol yapar (bu fonksiyonun dışında,
 *      insert sırasında bir "unique_violation" hatası olarak yakalanır).
 *
 * Bu fonksiyon sadece hızlı Redis ön kontrolünü yapar; embedding tabanlı
 * anlamsal kontrol için ayrıca findSemanticDuplicate çağrılmalıdır.
 */
export async function isLikelyDuplicateByHash(contentHash: string): Promise<boolean> {
  try {
    return await isContentHashSeen(contentHash);
  } catch {
    // Redis erişilemezse, hash kontrolünü atlamış oluruz; nihai güvence
    // Supabase'deki content_hash UNIQUE kısıtlamasıdır.
    return false;
  }
}