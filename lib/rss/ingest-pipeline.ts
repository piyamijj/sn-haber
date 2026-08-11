import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { fetchMultipleRssFeeds } from '@/lib/rss/fetch-feed';
import {
  computeContentHash,
  isLikelyDuplicateByHash,
  findSemanticDuplicate,
} from '@/lib/rss/dedup';
import { quickProcessArticle } from '@/lib/ai/groq';
import { analyzeArticle, generateEmbedding } from '@/lib/ai/gemini';
import { markContentHashSeen } from '@/lib/redis/client';
import { estimateReadingTimeMinutes, slugify } from '@/lib/utils';
import type { RssFeedItem } from '@/types';

/**
 * Supabase "kaynaklar" tablosundaki aktif bir RSS kaynağının satır biçimi.
 */
interface KaynakRow {
  id: string;
  isim: string;
  rss_url: string;
}

/**
 * RSS ingest pipeline'ının tam çalışma özeti. Tüm sayaçlar ve mesajlar
 * Türkçedir; bu özet, hem /api/cron/rss-ingest route'unun JSON yanıtında
 * hem de manuel scripts/ingest-rss.ts script'inin konsol çıktısında
 * kullanılır.
 */
export interface RssIngestSummary {
  durum: 'tamamlandi' | 'hata';
  mesaj: string;
  islenenKaynakSayisi: number;
  cekilenOgeSayisi: number;
  eklenenHaberSayisi: number;
  atlananMukerrerHashSayisi: number;
  atlananMukerrerAnlamsalSayisi: number;
  hataSayisi: number;
  kaynakSonuclari: {
    isim: string;
    durum: 'basarili' | 'hata';
    detay: string;
  }[];
}

/** Aynı anda işlenecek maksimum haber öğesi sayısı — AI API'lerini yormamak için. */
const CONCURRENCY_LIMIT = 3;

/**
 * Bir haber başlığından benzersiz bir slug üretir. Aynı başlıktan
 * (veya çok benzer başlıklardan) doğan slug çakışmalarını önlemek için,
 * temel slug'ın sonuna içerik hash'inin ilk 8 karakterini ekler.
 */
function buildUniqueSlug(title: string, contentHash: string): string {
  const baseSlug = slugify(title) || 'haber';
  const shortHashSuffix = contentHash.slice(0, 8);
  return `${baseSlug}-${shortHashSuffix}`;
}

/**
 * Bir diziyi, verilen boyuttaki ardışık gruplara (batch) böler.
 * RSS öğeleri, AI API'lerine (Groq/Gemini) aşırı yük bindirmemek için
 * bu gruplar halinde, sınırlı eşzamanlılıkla işlenir.
 */
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

/**
 * Tek bir RSS öğesinin işlenme sonucu — insertOlan işaretiyle birlikte
 * dahili raporlama için kullanılır.
 */
type ItemProcessResult =
  | { sonuc: 'eklendi' }
  | { sonuc: 'mukerrer-hash' }
  | { sonuc: 'mukerrer-anlamsal' }
  | { sonuc: 'hata'; detay: string };

/**
 * Tek bir RSS öğesini uçtan uca işler: içerik hash'i hesaplar, Redis'te
 * hızlı mükerrer ön kontrolü yapar, Groq ile hızlı işleme ve Gemini ile
 * detaylı analiz/embedding üretimini paralel çalıştırır, embedding
 * tabanlı anlamsal mükerrer kontrolü yapar, ve mükerrer değilse
 * Supabase "haberler" tablosuna ekler.
 *
 * Bu fonksiyon hata fırlatmaz; her hata durumu bir ItemProcessResult
 * olarak döner, böylece toplu işlemde tek bir öğenin başarısız olması
 * diğer öğelerin işlenmesini durdurmaz.
 */
async function processFeedItem(
  item: RssFeedItem,
  kaynakId: string | null,
): Promise<ItemProcessResult> {
  try {
    const contentHash = computeContentHash(item.title, item.contentSnippet);

    const isDuplicateByHash = await isLikelyDuplicateByHash(contentHash);
    if (isDuplicateByHash) {
      return { sonuc: 'mukerrer-hash' };
    }

    const quickResult = await quickProcessArticle(item.title, item.contentSnippet);

    const [analysisResult, embedding] = await Promise.all([
      analyzeArticle(quickResult.refinedTitle, item.contentSnippet),
      generateEmbedding(`${quickResult.refinedTitle}\n${item.contentSnippet}`),
    ]);

    if (embedding.length > 0) {
      const semanticCheck = await findSemanticDuplicate(embedding);
      if (semanticCheck.isDuplicate) {
        return { sonuc: 'mukerrer-anlamsal' };
      }
    }

    const publishedAt = item.isoDate ? new Date(item.isoDate).toISOString() : new Date().toISOString();
    const slug = buildUniqueSlug(quickResult.refinedTitle, contentHash);
    const readingTimeMinutes = estimateReadingTimeMinutes(item.contentSnippet);

    const supabase = getSupabaseServiceClient();

    const { error: insertError } = await supabase.from('haberler').insert({
      slug,
      title: quickResult.refinedTitle,
      summary: quickResult.summary,
      ai_quick_summary: quickResult.quickSummaryBullets,
      content: item.contentSnippet,
      category: analysisResult.category,
      tags: analysisResult.tags,
      source_name: item.sourceName,
      source_url: item.link,
      image_url: item.imageUrl,
      published_at: publishedAt,
      reading_time_minutes: readingTimeMinutes,
      is_flash: analysisResult.isFlashWorthy,
      ai_verification_status: analysisResult.verificationStatus,
      ai_verification_note: analysisResult.verificationNote,
      content_hash: contentHash,
      embedding: embedding.length > 0 ? embedding : null,
      kaynak_id: kaynakId,
    });

    if (insertError) {
      // Supabase'in content_hash UNIQUE kısıtlaması ihlal edildiyse
      // (unique_violation, Postgres hata kodu 23505), bu bir hata değil,
      // Redis ön kontrolünü atlatmış nihai bir mükerrer tespitidir.
      if (insertError.code === '23505') {
        await markContentHashSeen(contentHash);
        return { sonuc: 'mukerrer-hash' };
      }

      return { sonuc: 'hata', detay: insertError.message };
    }

    await markContentHashSeen(contentHash);
    return { sonuc: 'eklendi' };
  } catch (error) {
    const detay = error instanceof Error ? error.message : 'bilinmeyen hata';
    return { sonuc: 'hata', detay };
  }
}

/**
 * RSS ingest + dedup + AI işleme pipeline'ının çekirdek fonksiyonu.
 *
 * Adımlar:
 *   1. Supabase "kaynaklar" tablosundan aktif RSS kaynaklarını okur.
 *   2. Tüm kaynakların beslemelerini paralel olarak çeker.
 *   3. Her öğeyi sınırlı eşzamanlılıkla (CONCURRENCY_LIMIT) işler:
 *      içerik hash'i + Redis ön kontrolü, Groq hızlı işleme, Gemini
 *      analiz + embedding, embedding tabanlı anlamsal mükerrer kontrolü,
 *      ve Supabase'e ekleme.
 *   4. Her kaynağın son_cekim_zamani/son_cekim_durumu alanlarını günceller.
 *   5. Detaylı bir Türkçe özet döner.
 *
 * Bu fonksiyon /api/cron/rss-ingest route'u (Vercel Cron Job, her 10
 * dakikada bir) ve scripts/ingest-rss.ts (manuel tetikleme) tarafından
 * ortak olarak kullanılır.
 */
export async function runRssIngestPipeline(): Promise<RssIngestSummary> {
  const supabase = getSupabaseServiceClient();

  const { data: kaynaklar, error: kaynaklarError } = await supabase
    .from('kaynaklar')
    .select('id, isim, rss_url')
    .eq('aktif', true);

  if (kaynaklarError) {
    return {
      durum: 'hata',
      mesaj: `Aktif RSS kaynakları okunamadı: ${kaynaklarError.message}`,
      islenenKaynakSayisi: 0,
      cekilenOgeSayisi: 0,
      eklenenHaberSayisi: 0,
      atlananMukerrerHashSayisi: 0,
      atlananMukerrerAnlamsalSayisi: 0,
      hataSayisi: 1,
      kaynakSonuclari: [],
    };
  }

  const aktifKaynaklar = (kaynaklar ?? []) as KaynakRow[];

  if (aktifKaynaklar.length === 0) {
    return {
      durum: 'tamamlandi',
      mesaj: 'Aktif RSS kaynağı bulunamadı; işlenecek bir şey yok.',
      islenenKaynakSayisi: 0,
      cekilenOgeSayisi: 0,
      eklenenHaberSayisi: 0,
      atlananMukerrerHashSayisi: 0,
      atlananMukerrerAnlamsalSayisi: 0,
      hataSayisi: 0,
      kaynakSonuclari: [],
    };
  }

  const kaynakIdBySourceName = new Map<string, string>();
  for (const kaynak of aktifKaynaklar) {
    kaynakIdBySourceName.set(kaynak.isim, kaynak.id);
  }

  const kaynakSonuclari: RssIngestSummary['kaynakSonuclari'] = [];

  let feedItems: RssFeedItem[] = [];
  try {
    feedItems = await fetchMultipleRssFeeds(
      aktifKaynaklar.map((kaynak) => ({ sourceName: kaynak.isim, rssUrl: kaynak.rss_url })),
    );

    for (const kaynak of aktifKaynaklar) {
      const kaynakOgeSayisi = feedItems.filter((item) => item.sourceName === kaynak.isim).length;
      kaynakSonuclari.push({
        isim: kaynak.isim,
        durum: 'basarili',
        detay: `${kaynakOgeSayisi} öğe çekildi.`,
      });
    }
  } catch (error) {
    const detay = error instanceof Error ? error.message : 'bilinmeyen hata';
    for (const kaynak of aktifKaynaklar) {
      kaynakSonuclari.push({ isim: kaynak.isim, durum: 'hata', detay });
    }
  }

  let eklenenHaberSayisi = 0;
  let atlananMukerrerHashSayisi = 0;
  let atlananMukerrerAnlamsalSayisi = 0;
  let hataSayisi = 0;

  const batches = chunkArray(feedItems, CONCURRENCY_LIMIT);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((item) => {
        const kaynakId = kaynakIdBySourceName.get(item.sourceName) ?? null;
        return processFeedItem(item, kaynakId);
      }),
    );

    for (const result of batchResults) {
      if (result.sonuc === 'eklendi') {
        eklenenHaberSayisi += 1;
      } else if (result.sonuc === 'mukerrer-hash') {
        atlananMukerrerHashSayisi += 1;
      } else if (result.sonuc === 'mukerrer-anlamsal') {
        atlananMukerrerAnlamsalSayisi += 1;
      } else {
        hataSayisi += 1;
      }
    }
  }

  const now = new Date().toISOString();
  await Promise.all(
    aktifKaynaklar.map((kaynak) => {
      const kaynakSonucu = kaynakSonuclari.find((sonuc) => sonuc.isim === kaynak.isim);
      const sonCekimDurumu = kaynakSonucu?.durum === 'hata' ? 'hata' : 'basarili';

      return supabase
        .from('kaynaklar')
        .update({ son_cekim_zamani: now, son_cekim_durumu: sonCekimDurumu })
        .eq('id', kaynak.id);
    }),
  );

  return {
    durum: 'tamamlandi',
    mesaj: `RSS ingest pipeline tamamlandı: ${aktifKaynaklar.length} kaynak işlendi, ${feedItems.length} öğe çekildi, ${eklenenHaberSayisi} yeni haber eklendi, ${atlananMukerrerHashSayisi} mükerrer (hash) ve ${atlananMukerrerAnlamsalSayisi} mükerrer (anlamsal) öğe atlandı, ${hataSayisi} hata oluştu.`,
    islenenKaynakSayisi: aktifKaynaklar.length,
    cekilenOgeSayisi: feedItems.length,
    eklenenHaberSayisi,
    atlananMukerrerHashSayisi,
    atlananMukerrerAnlamsalSayisi,
    hataSayisi,
    kaynakSonuclari,
  };
}