'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import type { FlashNewsItem } from '@/types';
import { cn } from '@/lib/utils';

interface FlashTickerProps {
  items: FlashNewsItem[];
  className?: string;
}

/**
 * Üstte kayan "son dakika" (flash) haber bandı.
 * Framer Motion ile sürekli, akıcı bir şekilde sağdan sola kayar;
 * üzerine gelindiğinde (hover) durur. Piyasa ticker'ının hemen üstünde
 * yer alır ve en yüksek öncelikli, güncel haberleri vurgular.
 */
export function FlashTicker({ items, className }: FlashTickerProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Kesintisiz döngü hissi için öğe listesini iki kez tekrar ediyoruz.
  const loopItems = [...items, ...items];

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 border-b border-oled-border bg-oled-panel px-3 py-2',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 pr-3">
        <span className="live-dot" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-destructive">
          Son Dakika
        </span>
        <span className="hidden h-4 w-px bg-oled-border sm:block" aria-hidden="true" />
      </div>

      <div className="ticker-viewport flex-1">
        <motion.div
          className="flex items-center gap-10 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            duration: Math.max(20, items.length * 6),
            ease: 'linear',
            repeat: Infinity,
          }}
          whileHover={{ transition: { duration: 0 } }}
          style={{ willChange: 'transform' }}
        >
          {loopItems.map((item, index) => (
            <Link
              key={`${item.id}-${index}`}
              href={`/haber/${item.slug}`}
              className="group flex items-center gap-2 text-sm text-foreground/90 transition-colors hover:text-primary"
            >
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                aria-hidden="true"
              />
              <span className="group-hover:underline">{item.title}</span>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}