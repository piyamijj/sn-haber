'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { FlashNewsItem } from '@/types';
import { NEWS_CATEGORY_LABELS_TR, type NewsCategory } from '@/types';
import { FlashTicker } from '@/components/layout/flash-ticker';
import { MarketTicker } from '@/components/layout/market-ticker';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  flashItems: FlashNewsItem[];
}

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

/**
 * Sitenin üst kısmında yer alan, sayfa kaydırılsa bile sabit (sticky)
 * kalan tüm başlık yığını: son dakika bandı, canlı piyasa ticker'ı ve
 * marka/kategori navigasyonu. Bu üçü birlikte tek bir sticky konteynerde
 * gruplanır, böylece kullanıcı aşağı kaydırdığında hepsi birlikte
 * üstte sabit kalır.
 */
export function SiteHeader({ flashItems }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 w-full">
      <FlashTicker items={flashItems} />
      <MarketTicker />

      <header className="w-full overflow-hidden border-b border-oled-border bg-oled/95 backdrop-blur supports-[backdrop-filter]:bg-oled/80">
        <div className="container flex h-16 max-w-full items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight text-brand">SN</span>
            <span className="text-2xl font-black tracking-tight text-foreground">Haber</span>
          </Link>

          <nav
            aria-label="Kategori navigasyonu"
            className="hide-scrollbar min-w-0 flex-1 overflow-x-auto"
          >
            <ul className="flex w-max items-center gap-1 whitespace-nowrap">
              {CATEGORY_ORDER.map((category) => {
                const isActive = pathname === `/kategori/${category}`;

                return (
                  <li key={category}>
                    <Link
                      href={`/kategori/${category}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-oled-panel2 hover:text-foreground',
                        isActive
                          ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {NEWS_CATEGORY_LABELS_TR[category]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
    </div>
  );
}