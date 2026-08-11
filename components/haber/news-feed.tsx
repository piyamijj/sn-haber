'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { NewsArticleListItem, NewsCategory, PaginatedNewsResponse } from '@/types';
import { NEWS_CATEGORY_LABELS_TR } from '@/types';
import { cn } from '@/lib/utils';
import { NewsCard } from '@/components/haber/news-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORY_ORDER: NewsCategory[] = [
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

interface NewsFeedProps {
  initialItems: NewsArticleListItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  /** Aktif kategori filtresi; homepage'de undefined (Tümü) olur. */
  activeCategory?: NewsCategory;
}

/**
 * Ana sayfa / kategori sayfası için sonsuz kaydırmalı (infinite-scroll)
 * haber akışı. Üstte kategori filtre sekmeleri, altında responsive
 * haber kartı grid'i gösterir. Sayfa sonuna yaklaşıldığında
 * IntersectionObserver ile /api/haberler uç noktasından bir sonraki
 * sayfayı çeker ve mevcut listeye ekler.
 */
export function NewsFeed({
  initialItems,
  initialNextCursor,
  initialHasMore,
  activeCategory,
}: NewsFeedProps) {
  const router = useRouter();

  const [items, setItems] = useState<NewsArticleListItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  // Kategori değiştiğinde (sunucudan gelen yeni initial* props ile)
  // istemci tarafı state'i sıfırla.
  useEffect(() => {
    setItems(initialItems);
    setNextCursor(initialNextCursor);
    setHasMore(initialHasMore);
    setHasError(false);
  }, [initialItems, initialNextCursor, initialHasMore, activeCategory]);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || !nextCursor) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    setHasError(false);

    try {
      const params = new URLSearchParams();
      params.set('cursor', nextCursor);
      if (activeCategory) {
        params.set('kategori', activeCategory);
      }

      const response = await fetch(`/api/haberler?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Haberler yüklenemedi');
      }

      const data = (await response.json()) as PaginatedNewsResponse;

      setItems((previous) => [...previous, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setHasError(true);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, nextCursor, activeCategory]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      if (value === 'tumu') {
        router.push('/');
      } else {
        router.push(`/kategori/${value}`);
      }
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={activeCategory ?? 'tumu'} onValueChange={handleCategoryChange}>
        <TabsList>
          <TabsTrigger value="tumu">Tümü</TabsTrigger>
          {CATEGORY_ORDER.map((category) => (
            <TabsTrigger key={category} value={category}>
              {NEWS_CATEGORY_LABELS_TR[category]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-oled-border bg-oled-panel py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Bu kategoride henüz haber bulunmuyor.
          </p>
          <p className="text-xs text-muted-foreground">
            Yeni haberler her 10 dakikada bir otomatik olarak eklenir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((article, index) => (
            <NewsCard key={article.id} article={article} index={index % 6} />
          ))}
        </div>
      )}

      {isLoadingMore && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="aspect-[16/9] w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {hasError && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-destructive">
            Haberler yüklenirken bir sorun oluştu.
          </p>
          <button
            type="button"
            onClick={loadMore}
            className={cn(
              'rounded-md border border-oled-border bg-oled-panel2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-oled-panel',
            )}
          >
            Tekrar dene
          </button>
        </div>
      )}

      {!hasMore && items.length > 0 && !isLoadingMore && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Tüm haberlerin sonuna ulaştınız.
        </p>
      )}

      <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
    </div>
  );
}