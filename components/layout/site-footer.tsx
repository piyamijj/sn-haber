import Link from 'next/link';

/**
 * Sitenin alt kısmında yer alan sade, koyu temalı footer.
 * Marka adı, telif hakkı satırı, RSS bağlantısı ve kısa bir tanıtım
 * ifadesi içerir.
 */
export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-oled-border bg-oled">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight text-brand">SN</span>
            <span className="text-lg font-black tracking-tight text-foreground">Haber</span>
          </Link>
          <p className="text-xs text-muted-foreground">AI destekli haber platformu</p>
        </div>

        <nav aria-label="Footer navigasyonu" className="flex items-center gap-4">
          <Link
            href="/feed.xml"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            RSS Beslemesi
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {currentYear} SN Haber. Tüm hakları saklıdır.
        </p>
      </div>
    </footer>
  );
}