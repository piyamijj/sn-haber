import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { FloatingChatbot } from '@/components/chatbot/floating-chatbot';
import { getFlashNewsItems } from '@/lib/haberler/queries';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const siteDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'snhaber.duckdns.org';
const siteUrl = `https://${siteDomain}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SN Haber — AI Destekli Haber Platformu',
    template: '%s — SN Haber',
  },
  description:
    'SN Haber; Türkiye ve dünyadan güncel haberleri yapay zeka ile özetleyen, doğrulayan ve kategorilere ayıran AI destekli haber platformudur.',
  keywords: [
    'haber',
    'son dakika',
    'gündem',
    'ekonomi',
    'yapay zeka',
    'AI haber',
    'SN Haber',
  ],
  authors: [{ name: 'SN Haber' }],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: siteUrl,
    siteName: 'SN Haber',
    title: 'SN Haber — AI Destekli Haber Platformu',
    description:
      'Türkiye ve dünyadan güncel haberleri yapay zeka ile özetleyen, doğrulayan ve kategorilere ayıran haber platformu.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SN Haber — AI Destekli Haber Platformu',
    description:
      'Türkiye ve dünyadan güncel haberleri yapay zeka ile özetleyen, doğrulayan ve kategorilere ayıran haber platformu.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: {
      'application/rss+xml': `${siteUrl}/feed.xml`,
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flashItems = await getFlashNewsItems();

  return (
    <html lang="tr" className="dark">
      <body
        className={`${inter.variable} min-h-screen bg-oled font-sans text-foreground antialiased`}
      >
        <SiteHeader flashItems={flashItems} />
        <main className="min-h-[60vh]">{children}</main>
        <SiteFooter />
        <FloatingChatbot />
      </body>
    </html>
  );
}