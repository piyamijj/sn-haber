'use client';

import { useState } from 'react';

import {
  ZODIAC_SIGN_LABELS_TR,
  ZODIAC_SIGN_DATE_RANGES_TR,
  type HoroscopeReading,
  type ZodiacSign,
} from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HoroscopeWidgetProps {
  readings: HoroscopeReading[];
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
 * Ana sayfada gösterilen, küçük ve derli topu bir "Günlük Burç Yorumu"
 * widget'ı. Veri sunucu tarafında (getTodaysHoroscopes) önceden
 * üretilmiş/cache'lenmiş olarak okunur — bu bileşen sadece görüntüler,
 * kendi başına hiçbir AI çağrısı yapmaz.
 *
 * Cron o gün için henüz çalışmamışsa (readings boşsa) hiçbir şey
 * render etmez; ana sayfa kırık/boş bir bölüm göstermez.
 */
export function HoroscopeWidget({ readings }: HoroscopeWidgetProps) {
  const [selectedSign, setSelectedSign] = useState<ZodiacSign | null>(
    readings[0]?.sign ?? null,
  );

  if (readings.length === 0 || !selectedSign) {
    return null;
  }

  const selectedReading = readings.find((reading) => reading.sign === selectedSign);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
          <span aria-hidden="true">✨</span>
          Günlük Burç Yorumu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {readings.map((reading) => {
            const isActive = reading.sign === selectedSign;

            return (
              <button
                key={reading.sign}
                type="button"
                onClick={() => setSelectedSign(reading.sign)}
                aria-pressed={isActive}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-oled-panel2 text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {ZODIAC_GLYPHS[reading.sign]}
                </span>
                {ZODIAC_SIGN_LABELS_TR[reading.sign]}
              </button>
            );
          })}
        </div>

        {selectedReading && (
          <div className="rounded-md bg-oled-panel2 p-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {ZODIAC_SIGN_LABELS_TR[selectedReading.sign]} ·{' '}
              {ZODIAC_SIGN_DATE_RANGES_TR[selectedReading.sign]}
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {selectedReading.commentText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}