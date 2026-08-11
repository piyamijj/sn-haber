'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Clock,
  Newspaper,
  TrendingUp,
  Globe2,
  Trophy,
  Cpu,
  HeartPulse,
  Palette,
  Sparkles,
  FlaskConical,
  Leaf,
  type LucideIcon,
} from 'lucide-react';

import type { NewsArticleListItem, NewsCategory } from '@/types';
import { NEWS_CATEGORY_LABELS_TR } from '@/types';
import { formatRelativeTimeTr, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * RSS kaynağından görsel gelmeyen haberler için kategoriye özel bir
 * yer tutucu tasarım tanımı: belirgin (OLED'de de fark edilir) bir
 * gradyan + o kategoriyi temsil eden bir ikon. Amaç, boş/kırık görünen
 * silik bir kutu yerine markaya uygun, "kasıtlı tasarlanmış" hissi
 * veren dolgun bir görsel sağlamak.
 */
const CATEGORY_PLACEHOLDER: Record<
  NewsCategory,
  { gradient: string; iconColor: string; Icon: LucideIcon }
> = {
  gundem: {
    gradient: 'from-red-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-red-400/70',
    Icon: Newspaper,
  },
  ekonomi: {
    gradient: 'from-emerald-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-emerald-400/70',
    Icon: TrendingUp,
  },
  dunya: {
    gradient: 'from-blue-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-blue-400/70',
    Icon: Globe2,
  },
  spor: {
    gradient: 'from-orange-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-orange-400/70',
    Icon: Trophy,
  },
  teknoloji: {
    gradient: 'from-violet-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-violet-400/70',
    Icon: Cpu,
  },
  saglik: {
    gradient: 'from-teal-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-teal-400/70',
    Icon: HeartPulse,
  },
  'kultur-sanat': {
    gradient: 'from-pink-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-pink-400/70',
    Icon: Palette,
  },
  magazin: {
    gradient: 'from-fuchsia-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-fuchsia-400/70',
    Icon: Sparkles,
  },
  bilim: {
    gradient: 'from-cyan-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-cyan-400/70',
    Icon: FlaskConical,
  },
  yasam: {
    gradient: 'from-amber-900/70 via-oled-panel2 to-oled-panel',
    iconColor: 'text-amber-400/70',
    Icon: Leaf,
  },
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
  const placeholder = CATEGORY_PLACEHOLDER[article.category];

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
                  'relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br',
                  placeholder.gradient,
                )}
              >
                {/* Hafif nokta deseni — düz bir renk kutusu değil, dokulu bir yüzey hissi verir. */}
                <div
                  className="absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, currentColor 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                  aria-hidden="true"
                />
                <placeholder.Icon
                  className={cn('relative h-10 w-10', placeholder.iconColor)}
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