import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Genel 404 (Sayfa Bulunamadı) sayfası.
 * Aranan haber, kategori veya sayfa bulunamadığında gösterilir.
 */
export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oled-panel2">
        <Newspaper className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </span>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        404 — Sayfa Bulunamadı
      </h1>

      <p className="max-w-md text-sm text-muted-foreground">
        Aradığınız haber, kategori veya sayfa kaldırılmış, taşınmış ya da hiç
        var olmamış olabilir. Anasayfaya dönerek güncel haberlere göz
        atabilirsiniz.
      </p>

      <Button asChild size="lg" className="mt-2">
        <Link href="/">Anasayfaya Dön</Link>
      </Button>
    </div>
  );
}