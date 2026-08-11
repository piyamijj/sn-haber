import type { MetadataRoute } from 'next';

const siteDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'snhaber.duckdns.org';
const siteUrl = `https://${siteDomain}`;

/**
 * /robots.txt üretir.
 *
 * Tüm arama motoru botlarına siteyi taramasına izin verir, ancak
 * /api/ altındaki uç noktaların (route handler'lar, cron hedefleri,
 * chat/markets/haberler API'leri) taranmasını engeller. Sitemap ve
 * RSS beslemesine referans verir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}