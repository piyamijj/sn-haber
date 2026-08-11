'use client';

import type { CSSProperties } from 'react';

import type { HoroscopeReading, ZodiacSign } from '@/types';
import { ZODIAC_SIGN_LABELS_TR } from '@/types';
import { cn } from '@/lib/utils';

interface HoroscopeTickerProps {
  readings: HoroscopeReading[];
  className?: string;
}

/** Her burç için klasik Unicode astrolojik sembol — ek bir görsel asset gerektirmez. */
const ZODIAC_GLYPHS: Record<ZodiacSign, string> = {
  koc: '♈',
  boga: '♉',
  ikizler: '♊',
  yengec: '♋',
  aslan: '♌',
  basak: '♍',
  terazi: '♎',
  akrep: '♏',
  yay: '♐',
  oglak: '♑',
  kova: '♒',
  balik: '♓',
};

/**
 * Bir metni belirtilen uzunluğa, kelimenin ortasından kesmeden (son
 * tam kelimeden sonra) kısaltır ve sonuna "…" ekler.
 */
function truncateText(text: string, maxLength = 80): string {
  if (text.length <= maxLength) {
    return text;
  }

  const sliced = text.slice(0, maxLength);
  const lastSpaceIndex = sliced.lastIndexOf(' ');
  const safeSlice = lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced;

  return `${safeSlice.trimEnd()}…`;
}

/**
 * Piyasa ticker'ının hemen altında yer alan, günlük burç yorumlarını
 * kayan bir bant olarak gösteren bileşen. Son dakika bandı
 * (flash-ticker.tsx) ve piyasa ticker'ı (market-ticker.tsx) ile aynı
 * saf CSS keyframe mekanizmasını (`.marquee-track`, bkz. app/globals.css)
 * kullanır — böylece animasyon davranışı ve daha önce o iki bant için
 * çözülmüş kararlılık/sıçrama sorunları burada da aynı şekilde
 * geçerli olur, ayrı bir animasyon yaklaşımı icat edilmez.
 *
 * Günün burç yorumları henüz üretilmemişse (cron o gün için henüz
 * çalışmamışsa) ya da veriye erişim izni (RLS) henüz tanımlanmamışsa
 * `readings` boş gelir ve bileşen hiçbir şey render etmez — sayfa
 * kırık/boş bir bant göstermez.
 */
export function HoroscopeTicker({ readings, className }: HoroscopeTickerProps) {
  if (!readings || readings.length === 0) {
    return null;
  }

  // Kesintisiz döngü hissi için yorum listesini iki kez tekrar ediyoruz.
  const loopReadings = [...readings, ...readings];
  // Burç yorumu metinleri son dakika başlıklarından daha uzun olduğu
  // için öğe başına daha fazla süre veriyoruz.
  const durationSeconds = Math.max(20, readings.length * 5);

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 border-b border-oled-border bg-oled-panel px-3 py-2',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 pr-3">
        <span aria-hidden="true">✨</span>
        <span className="text-xs font-bold uppercase tracking-wider text-brand">
          Günlük Burç
        </span>
        <span className="hidden h-4 w-px bg-oled-border sm:block" aria-hidden="true" />
      </div>

      <div className="ticker-viewport flex-1">
        <div
          className="marquee-track marquee-pause-on-hover gap-8"
          style={{ '--marquee-duration': `${durationSeconds}s` } as CSSProperties}
        >
          {loopReadings.map((reading, index) => (
            <div
              key={`${reading.sign}-${index}`}
              className="flex shrink-0 items-center gap-2 text-sm"
            >
              <span className="text-base leading-none" aria-hidden="true">
                {ZODIAC_GLYPHS[reading.sign]}
              </span>
              <span className="font-semibold text-foreground/90">
                {ZODIAC_SIGN_LABELS_TR[reading.sign]}
              </span>
              <span className="text-foreground/70">{truncateText(reading.commentText)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}