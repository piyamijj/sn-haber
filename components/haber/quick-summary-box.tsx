'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface QuickSummaryBoxProps {
  bullets: string[];
  className?: string;
}

/**
 * Haber detay sayfasının en üstünde gösterilen, AI tarafından üretilmiş
 * "Hızlı Özet" kutusu. Tam olarak 3 madde gösterir; marka rengiyle
 * vurgulanmış bir panel içinde, üstünde küçük bir Sparkles ikonu ve
 * "AI Hızlı Özet" etiketiyle sunulur. Altında içeriğin yapay zeka
 * tarafından üretildiğini belirten kısa bir uyarı metni yer alır.
 */
export function QuickSummaryBox({ bullets, className }: QuickSummaryBoxProps) {
  if (!bullets || bullets.length === 0) {
    return null;
  }

  const displayBullets = bullets.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-lg border border-primary/30 bg-primary/[0.06] p-4 sm:p-5 ${className ?? ''}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-primary">
          AI Hızlı Özet
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {displayBullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <span
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Bu özet, haber içeriğinden yapay zeka tarafından otomatik olarak üretilmiştir ve
        yalnızca bilgilendirme amaçlıdır.
      </p>
    </motion.div>
  );
}