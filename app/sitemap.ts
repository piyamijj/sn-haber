import type { MetadataRoute } from 'next';

import { getPaginatedArticles } from '@/lib/haberler/queries';
import type { NewsCategory } from '@/types';

const siteDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'snhaber.duckdns.org';
const siteUrl = `https://${siteDomain}`;

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

/**
 * /sitemap.xml üretir.
 *
 * Şunları içerir:
 * - Anasayfa (en yüksek öncelik, sık güncellenir).
 * - Her kategori sayfası (/kategori/[slug]).
 * - En güncel yayınlanmış haberlerin detay sayfaları (en fazla 200 adet).
 *
 * Haber sayfaları için lastModified, ilgili haberin updatedAt/publishedAt
 * değerinden alınır.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const homepageEntry: MetadataRoute.Sitemap[number] = {
    url: siteUrl,
    lastModified: new Date(),
    changeFrequency: 'always',
    priority: 1,
  };

  const categoryEntries: MetadataRoute.Sitemap = VALID_CATEGORIES.map((category) => ({
    url: `${siteUrl}/kategori/${category}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  let articleEntries: MetadataRoute.Sitemap = [];

  try {
    const { items } = await getPaginatedArticles({ limit: 200 });

    articleEntries = items.map((article) => ({
      url: `${siteUrl}/haber/${article.slug}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: 'daily',
      priority: 0.6,
    }));
  } catch {
    articleEntries = [];
  }

  return [homepageEntry, ...categoryEntries, ...articleEntries];
}