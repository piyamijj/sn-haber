'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import type { MarketQuote } from '@/types';
import { formatNumberTr, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';

const POLL_INTERVAL_MS = 30_000;

/**
 * Sağlanan yön bilgisine göre uygun ikonu ve renk sınıfını döndürür.
 */
function getDirectionVisual(direction: MarketQuote['direction']) {
  if (direction === 'up') {
    return { Icon: TrendingUp, colorClass: 'text-market-up' };
  }
  if (direction === 'down') {
    return { Icon: TrendingDown, colorClass: 'text-market-down' };
  }
  return { Icon: Minus, colorClass: 'text-market-flat' };
}

/**
 * Bir kotasyonun fiyatını sembolüne göre uygun ondalık hassasiyetle
 * biçimlendirir (BTC ve BIST100 farklı ondalık gösterim gerektirir).
 */
function formatQuotePrice(quote: MarketQuote): string {
  if (quote.symbol === 'BTCUSD' || quote.symbol === 'ETHUSD') {
    return `$${formatNumberTr(quote.price, 0)}`;
  }
  if (quote.symbol === 'BIST100') {
    return formatNumberTr(quote.price, 2);
  }
  if (quote.symbol === 'XAUTRY' || quote.symbol === 'XAGTRY') {
    return `${formatNumberTr(quote.price, 2)} ₺`;
  }
  return `${formatNumberTr(quote.price, 4)} ₺`;
}

/**
 * Alttaki (üstteki son dakika bandının altında yer alan) canlı piyasa
 * ticker'ı. Dolar, Euro, Altın, BTC ve BIST100 kotasyonlarını gösterir.
 * /api/markets uç noktasından veri çeker ve 30 saniyede bir yeniler.
 */
export function MarketTicker() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Mobilde whileHover'a bağlı durdurma davranışı dokunma sonrası kalıcı
  // olarak takılı kalabiliyordu (bkz. flash-ticker.tsx aynı düzeltme).
  const isCoarsePointer = useCoarsePointer();

  useEffect(() => {
    let isMounted = true;

    async function fetchQuotes() {
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Piyasa verisi alınamadı');
        }

        const data = (await response.json()) as { quotes: MarketQuote[] };

        if (isMounted) {
          setQuotes(data.quotes ?? []);
          setHasError(false);
        }
      } catch {
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchQuotes();
    const intervalId = setInterval(fetchQuotes, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 border-b border-oled-border bg-oled px-3 py-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-28" />
        ))}
      </div>
    );
  }

  if (hasError || quotes.length === 0) {
    return null;
  }

  // Kesintisiz döngü hissi için kotasyon listesini iki kez tekrar ediyoruz.
  const loopQuotes = [...quotes, ...quotes];

  return (
    <div className="ticker-viewport border-b border-oled-border bg-oled px-3 py-2">
      <motion.div
        className="flex items-center whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: Math.max(15, quotes.length * 4),
          ease: 'linear',
          repeat: Infinity,
        }}
        whileHover={isCoarsePointer ? undefined : { transition: { duration: 0 } }}
        style={{ willChange: 'transform' }}
      >
        {loopQuotes.map((quote, index) => {
          const { Icon, colorClass } = getDirectionVisual(quote.direction);
          const changeSign = quote.changePercent > 0 ? '+' : '';

          return (
            <div
              key={`${quote.symbol}-${index}`}
              className="flex items-center gap-2 pr-8 text-sm"
            >
              <span className="font-semibold text-foreground/90">{quote.label}</span>
              <span className="text-foreground/80">{formatQuotePrice(quote)}</span>
              <span className={cn('flex items-center gap-1 font-medium', colorClass)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {changeSign}
                {formatNumberTr(quote.changePercent, 2)}%
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}