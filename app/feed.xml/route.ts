import { NextResponse } from 'next/server';

import { getPaginatedArticles } from '@/lib/haberler/queries';

const siteDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'snhaber.duckdns.org';
const siteUrl = `https://${siteDomain}`;

/**
 * Verilen metindeki XML için özel anlam taşıyan karakterleri
 * (&, <, >, ", ') güvenli hale getirir.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Verilen tarihi RFC-822 biçiminde (RSS pubDate standardı) döndürür.
 */
function toRfc822Date(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toUTCString();
}

/**
 * GET /feed.xml
 *
 * En güncel yayınlanmış haberlerden geçerli bir RSS 2.0 beslemesi
 * üretir. SN Haber sitesindeki en yeni 30 haberi içerir; her öğe
 * başlık, bağlantı, özet (description), yayın tarihi (pubDate) ve
 * benzersiz kimlik (guid) bilgilerini taşır.
 */
export async function GET() {
  const { items } = await getPaginatedArticles({ limit: 30 });

  const channelTitle = 'SN Haber';
  const channelDescription =
    'SN Haber — Türkiye ve dünyadan güncel haberleri yapay zeka ile özetleyen, doğrulayan ve kategorilere ayıran AI destekli haber platformu.';
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = items
    .map((article) => {
      const articleUrl = `${siteUrl}/haber/${article.slug}`;

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${articleUrl}</link>
      <description>${escapeXml(article.summary)}</description>
      <pubDate>${toRfc822Date(article.publishedAt)}</pubDate>
      <guid isPermaLink="true">${articleUrl}</guid>
    </item>`;
    })
    .join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>tr-TR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}