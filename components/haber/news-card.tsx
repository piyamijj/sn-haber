'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Clock, Newspaper } from 'lucide-react';

import type { NewsArticleListItem, NewsCategory } from '@/types';
import { NEWS_CATEGORY_LABELS_TR } from '@/types';
import { formatRelativeTimeTr, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * RSS kaynağından görsel gelmeyen haberler için kategoriye özel bir
 * gradyan arka plan üretir — boş/kırık görünen bir ikon kutusu yerine
 * markaya uygun, görsel olarak dolu bir yer tutucu sağlar.
 */
const CATEGORY_GRADIENTS: Record<NewsCategory, string> = {
  gundem: 'from-red-950 via-oled-panel2 to-oled-panel2',
  ekonomi: 'from-emerald-950 via-oled-panel2 to-oled-panel2',
  dunya: 'from-blue-950 via-oled-panel2 to-oled-panel2',
  spor: 'from-orange-950 via-oled-panel2 to-oled-panel2',
  teknoloji: 'from-violet-950 via-oled-panel2 to-oled-panel2',
  saglik: 'from-teal-950 via-oled-panel2 to-oled-panel2',
  'kultur-sanat': 'from-pink-950 via-oled-panel2 to-oled-panel2',
  magazin: 'from-fuchsia-950 via-oled-panel2 to-oled-panel2',
  bilim: 'from-cyan-950 via-oled-panel2 to-oled-panel2',
  yasam: 'from-amber-950 via-oled-panel2 to-oled-panel2',
};

interface NewsCardProps {
  article: NewsArticleListItem;
  className?: string;
  /** Grid içindeki sırasına göre fade-in animasyonunu hafifçe geciktirmek için. */
  index?: number;
}

/**
 * Ana sayfa / kategori akışındaki tekil haber kartı.
 * Görsel, kategori rozeti, başlık, özet, kaynak adı, göreli yayın zamanı
 * ve tahmini okuma süresini gösterir. Görünüme girdiğinde hafif bir
 * fade-in animasyonu, üzerine gelindiğinde ise hafif bir kalkma/ölçek
 * efekti uygular.
 */
export function NewsCard({ article, className, index = 0 }: NewsCardProps) {
  const categoryLabel = NEWS_CATEGORY_LABELS_TR[article.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={cn('h-full', className)}
    >
      <Card className="group flex h-full flex-col overflow-hidden transition-colors hover:border-primary/40">
        <Link href={`/haber/${article.slug}`} className="flex h-full flex-col">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-oled-panel2">
            {article.imageUrl ? (
              <Image
                src={article.imageUrl}
                alt={article.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div
                className={cn(
                  'flex h-full w-full items-center justify-center bg-gradient-to-br',
                  CATEGORY_GRADIENTS[article.category],
                )}
              >
                <Newspaper
                  className="h-9 w-9 text-foreground/25"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </div>
            )}

            <div className="absolute left-2 top-2 flex items-center gap-1.5">
              {article.isFlash && <Badge variant="live">Son Dakika</Badge>}
              <Badge variant="secondary">{categoryLabel}</Badge>
            </div>
          </div>

          <CardContent className="flex flex-1 flex-col gap-2 p-4">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {article.title}
            </h3>

            <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
              {article.summary}
            </p>

            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{article.sourceName}</span>
              <div className="flex items-center gap-3">
                <span>{formatRelativeTimeTr(article.publishedAt)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {article.readingTimeMinutes} dk
                </span>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
}