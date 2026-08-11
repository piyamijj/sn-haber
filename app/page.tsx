import type { Metadata } from 'next';

import { getPaginatedArticles } from '@/lib/haberler/queries';
import { NewsFeed } from '@/components/haber/news-feed';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Anasayfa',
  description:
    'SN Haber anasayfası — Türkiye ve dünyadan güncel haberler, yapay zeka ile özetlenmiş ve kategorilere ayrılmış şekilde tek akışta.',
};

export default async function HomePage() {
  const { items, nextCursor, hasMore } = await getPaginatedArticles({});

  return (
    <div className="container flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Gündemdeki Tüm Haberler
        </h1>
        <p className="text-sm text-muted-foreground">
          Türkiye ve dünyadan en güncel haberler, yapay zeka ile özetlenmiş ve
          doğrulanmış şekilde tek akışta.
        </p>
      </div>

      <NewsFeed
        initialItems={items}
        initialNextCursor={nextCursor}
        initialHasMore={hasMore}
      />
    </div>
  );
}