import { getSupabaseServerClient } from '@/lib/supabase/server';
import type {
  NewsArticle,
  NewsArticleListItem,
  NewsCategory,
  FlashNewsItem,
  PaginatedNewsResponse,
  AiVerificationStatus,
} from '@/types';

/**
 * Supabase "haberler" tablosundaki ham satır biçimi (snake_case).
 * Bu tip, veritabanı şemasıyla bire bir eşleşir.
 */
interface HaberlerRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  ai_quick_summary: string[] | null;
  content: string;
  category: NewsCategory;
  tags: string[] | null;
  source_name: string;
  source_url: string;
  image_url: string | null;
  published_at: string;
  updated_at: string;
  reading_time_minutes: number;
  is_flash: boolean;
  ai_verification_status: AiVerificationStatus;
  content_hash: string;
  embedding: unknown;
  view_count: number;
}

const DEFAULT_PAGE_SIZE = 12;

/**
 * Supabase satırını (snake_case) tam NewsArticle tipine (camelCase) çevirir.
 */
function mapRowToArticle(row: HaberlerRow): NewsArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    aiQuickSummary: row.ai_quick_summary ?? [],
    content: row.content,
    category: row.category,
    tags: row.tags ?? [],
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingTimeMinutes: row.reading_time_minutes,
    isFlash: row.is_flash,
    aiVerificationStatus: row.ai_verification_status,
    contentHash: row.content_hash,
    embeddingId: row.embedding ? row.id : null,
    viewCount: row.view_count,
  };
}

/**
 * Supabase satırını, akış/liste görünümlerinde kullanılan hafif
 * NewsArticleListItem tipine çevirir.
 */
function mapRowToListItem(row: HaberlerRow): NewsArticleListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    sourceName: row.source_name,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    readingTimeMinutes: row.reading_time_minutes,
    isFlash: row.is_flash,
  };
}

interface GetPaginatedArticlesParams {
  category?: NewsCategory;
  /** Sayfalama imleci — önceki sayfanın son öğesinin published_at değeri. */
  cursor?: string | null;
  limit?: number;
}

/**
 * Ana sayfa / kategori akışı için sayfalanmış (cursor-based) haber
 * listesini döndürür. published_at alanına göre azalan sırada sıralar.
 *
 * Not: Supabase projesi bu aşamada henüz kurulmadığı için, bağlantı/sorgu
 * hataları sessizce yakalanır ve boş bir sonuç döndürülür — bu davranış,
 * 2. aşamada Supabase şeması ve veri girişi tamamlandığında canlı
 * verilerle otomatik olarak düzelecektir.
 */
export async function getPaginatedArticles({
  category,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}: GetPaginatedArticlesParams): Promise<PaginatedNewsResponse> {
  try {
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from('haberler')
      .select(
        'id, slug, title, summary, category, source_name, image_url, published_at, reading_time_minutes, is_flash',
      )
      .order('published_at', { ascending: false })
      .limit(limit + 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (cursor) {
      query = query.lt('published_at', cursor);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const hasMore = data.length > limit;
    const pageRows = (hasMore ? data.slice(0, limit) : data) as HaberlerRow[];
    const items = pageRows.map(mapRowToListItem);
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.published_at ?? null : null;

    return { items, nextCursor, hasMore };
  } catch {
    return { items: [], nextCursor: null, hasMore: false };
  }
}

/**
 * Üstte kayan "son dakika" bandı için en güncel is_flash=true haberleri
 * döndürür.
 */
export async function getFlashNewsItems(limit = 8): Promise<FlashNewsItem[]> {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('haberler')
      .select('id, slug, title, published_at')
      .eq('is_flash', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row: Pick<HaberlerRow, 'id' | 'slug' | 'title' | 'published_at'>) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      publishedAt: row.published_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Slug'a göre tek bir haberin tüm detaylarını getirir ve görüntülenme
 * sayacını artırır (increment_view_count RPC'si üzerinden).
 * Haber bulunamazsa null döner.
 */
export async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('haberler')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return null;
    }

    const article = mapRowToArticle(data as HaberlerRow);

    // Görüntülenme sayısını artır — sayfa render'ını bloklamaması için
    // hata sessizce yutulur, kullanıcıya herhangi bir etkisi olmaz.
    supabase.rpc('increment_view_count', { haber_id: article.id }).then(
      () => undefined,
      () => undefined,
    );

    return article;
  } catch {
    return null;
  }
}

/**
 * Bir haberle aynı kategoride, verilen haber hariç ilgili haberleri
 * getirir. Haber detay sayfasında "İlgili Haberler" bölümü için
 * kullanılmak üzere hazırlanmıştır.
 */
export async function getRelatedArticles(
  category: NewsCategory,
  excludeId: string,
  limit = 4,
): Promise<NewsArticleListItem[]> {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('haberler')
      .select(
        'id, slug, title, summary, category, source_name, image_url, published_at, reading_time_minutes, is_flash',
      )
      .eq('category', category)
      .neq('id', excludeId)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return (data as HaberlerRow[]).map(mapRowToListItem);
  } catch {
    return [];
  }
}