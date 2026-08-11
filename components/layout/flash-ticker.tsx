'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';

import type { FlashNewsItem } from '@/types';
import { cn } from '@/lib/utils';

interface FlashTickerProps {
  items: FlashNewsItem[];
  className?: string;
}

/**
 * Üstte kayan "son dakika" (flash) haber bandı.
 * Saf CSS keyframe animasyonuyla (bkz. globals.css .marquee-track)
 * sürekli, akıcı bir şekilde sağdan sola kayar; sadece gerçek fare
 * işaretçili cihazlarda üzerine gelindiğinde durur (dokunmatik
 * cihazlarda hover-durdurma davranışı CSS media query ile zaten devre
 * dışı bırakılmıştır). Piyasa ticker'ının hemen üstünde yer alır ve en
 * yüksek öncelikli, güncel haberleri vurgular.
 */
export function FlashTicker({ items, className }: FlashTickerProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Kesintisiz döngü hissi için öğe listesini iki kez tekrar ediyoruz.
  const loopItems = [...items, ...items];
  // Süre saniye biriminde; öğe sayısına göre ölçeklenir ama çok kısa/uzun
  // olmaz. Önceki iki hız artırma turundan sonra toplamda ~%60 daha hızlı.
  const durationSeconds = Math.max(8, items.length * 2.2);

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
        <div
          className="marquee-track marquee-pause-on-hover gap-10"
          style={{ '--marquee-duration': `${durationSeconds}s` } as CSSProperties}
        >
          {loopItems.map((item, index) => (
            <Link
              key={`${item.id}-${index}`}
              href={`/haber/${item.slug}`}
              className="group flex shrink-0 items-center gap-2 text-sm text-foreground/90 transition-colors hover:text-primary"
            >
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                aria-hidden="true"
              />
              <span className="group-hover:underline">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}