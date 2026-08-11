import { Redis } from '@upstash/redis';

import type { MarketQuote } from '@/types';

let redisClient: Redis | null = null;

/**
 * Upstash Redis istemcisini döndürür (REST tabanlı, sunucu ortamlarında
 * — Route Handler, Vercel Cron Job — güvenle kullanılabilir).
 * Piyasa ticker cache'i ve RSS ingest dedup pipeline'ı için tekil örnek.
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis istemcisi başlatılamadı: UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN ortam değişkenleri tanımlı olmalı.',
    );
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

// ============================================================
// Piyasa ticker cache'i
// ============================================================

const MARKET_QUOTES_CACHE_KEY = 'sn-haber:market-quotes';
const MARKET_QUOTES_CACHE_TTL_SECONDS = 60;

/**
 * Canlı piyasa kotasyonlarını (Dolar, Euro, Altın, BTC, BIST100) kısa
 * ömürlü cache'e yazar. Ticker her istek için dış API'yi tekrar
 * çağırmamak amacıyla bu cache'i kullanır.
 */
export async function cacheMarketQuotes(quotes: MarketQuote[]): Promise<void> {
  const redis = getRedisClient();
  await redis.set(MARKET_QUOTES_CACHE_KEY, JSON.stringify(quotes), {
    ex: MARKET_QUOTES_CACHE_TTL_SECONDS,
  });
}

/**
 * Cache'lenmiş piyasa kotasyonlarını döndürür; cache boşsa null döner.
 */
export async function getCachedMarketQuotes(): Promise<MarketQuote[] | null> {
  const redis = getRedisClient();
  const cached = await redis.get<string | MarketQuote[]>(MARKET_QUOTES_CACHE_KEY);

  if (!cached) {
    return null;
  }

  if (typeof cached === 'string') {
    try {
      return JSON.parse(cached) as MarketQuote[];
    } catch {
      return null;
    }
  }

  return cached;
}

// ============================================================
// Mükerrer haber (dedup) hızlı ön kontrol katmanı
// ============================================================
// Supabase'deki content_hash UNIQUE kısıtlaması nihai/kesin dedup
// garantisini sağlar; Redis burada RSS ingest pipeline'ının her 10
// dakikalık çalışmasında Supabase'e gitmeden hızlı bir ön filtre
// olarak kullanılır (aynı içerik kısa süre içinde tekrar denenirse
// gereksiz DB sorgusu/AI çağrısı yapılmasını önler).

const CONTENT_HASH_SET_PREFIX = 'sn-haber:content-hash:';
const CONTENT_HASH_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 gün

/**
 * Verilen içerik hash'inin daha önce görülüp görülmediğini kontrol eder.
 * true dönerse bu haber muhtemelen mükerrerdir ve AI işleme/DB insert
 * adımları atlanabilir.
 */
export async function isContentHashSeen(contentHash: string): Promise<boolean> {
  const redis = getRedisClient();
  const exists = await redis.exists(`${CONTENT_HASH_SET_PREFIX}${contentHash}`);
  return exists === 1;
}

/**
 * İçerik hash'ini "görüldü" olarak işaretler (TTL ile).
 * RSS ingest pipeline'ında bir haber başarıyla işlenip Supabase'e
 * yazıldıktan sonra çağrılmalıdır.
 */
export async function markContentHashSeen(contentHash: string): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`${CONTENT_HASH_SET_PREFIX}${contentHash}`, '1', {
    ex: CONTENT_HASH_TTL_SECONDS,
  });
}