import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPaginatedArticles } from '@/lib/haberler/queries';
import { NewsFeed } from '@/components/haber/news-feed';
import { NEWS_CATEGORY_LABELS_TR, type NewsCategory } from '@/types';

export const revalidate = 300;

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

function isNewsCategory(value: string): value is NewsCategory {
  return VALID_CATEGORIES.includes(value as NewsCategory);
}

interface CategoryPageParams {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return VALID_CATEGORIES.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: CategoryPageParams): Metadata {
  const { slug } = params;

  if (!isNewsCategory(slug)) {
    return {
      title: 'Kategori Bulunamadı',
    };
  }

  const label = NEWS_CATEGORY_LABELS_TR[slug];

  return {
    title: label,
    description: `${label} kategorisindeki en güncel haberler — SN Haber'de yapay zeka ile özetlenmiş ve doğrulanmış şekilde tek akışta.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageParams) {
  const { slug } = params;

  if (!isNewsCategory(slug)) {
    notFound();
  }

  const category = slug as NewsCategory;
  const label = NEWS_CATEGORY_LABELS_TR[category];

  const { items, nextCursor, hasMore } = await getPaginatedArticles({ category });

  return (
    <div className="container flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {label} Haberleri
        </h1>
        <p className="text-sm text-muted-foreground">
          {label} kategorisindeki en güncel haberler, yapay zeka ile özetlenmiş ve
          doğrulanmış şekilde tek akışta.
        </p>
      </div>

      <NewsFeed
        initialItems={items}
        initialNextCursor={nextCursor}
        initialHasMore={hasMore}
        activeCategory={category}
      />
    </div>
  );
}