import Parser from 'rss-parser';

import type { RssFeedItem } from '@/types';

/**
 * rss-parser için özel alan eşlemeleri.
 * Bazı RSS kaynakları görsel bilgisini "enclosure" veya "media:content"
 * gibi standart olmayan alanlarda taşıyabilir; bu eşlemeler o alanları
 * da okunabilir hale getirir.
 */
const rssParser: Parser<
  Record<string, unknown>,
  {
    title?: string;
    link?: string;
    contentSnippet?: string;
    content?: string;
    'content:encoded'?: string;
    isoDate?: string;
    pubDate?: string;
    enclosure?: { url?: string };
    'media:content'?: { $?: { url?: string } };
    'media:thumbnail'?: { $?: { url?: string } };
    itemImageTag?: string;
  }
> = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      // Anadolu Ajansı gibi bazı kaynaklar, standart olmayan şekilde
      // görseli item seviyesinde düz bir <image>URL</image> etiketinde
      // taşır (RSS 2.0 spesifikasyonunda item için <image> tanımlı
      // değildir, bu yüzden rss-parser'ın varsayılan alanları bunu
      // yakalamaz). "itemImageTag" adıyla ayrı bir alias tanımlanır ki
      // channel seviyesindeki standart <image> ile çakışmasın.
      ['image', 'itemImageTag'],
    ],
  },
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; SNHaberBot/1.0; +https://snhaber.duckdns.org)',
  },
});

/**
 * Verilen HTML metnindeki tüm etiketleri temizleyip düz metin döndürür.
 * RSS beslemelerindeki "description"/"content" alanları genellikle HTML
 * içerdiğinden, özet/kaynak metni olarak kullanılmadan önce temizlenmelidir.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  return html
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(p|br|div|li)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verilen HTML içeriğindeki ilk <img> etiketinin "src" değerini regex ile
 * çıkarır. RSS öğesinde açık bir görsel alanı (enclosure, media:content)
 * bulunmadığında, içerik HTML'i içinden görsel bulmak için son çare olarak
 * kullanılır.
 */
export function extractImageFromContent(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }

  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match?.[1] ?? null;
}

/**
 * Bir RSS öğesinden en uygun görsel URL'sini çıkarmaya çalışır.
 * Sırasıyla enclosure.url, media:content/media:thumbnail alanlarını ve
 * son olarak içerik HTML'i içindeki ilk <img> etiketini dener.
 */
function resolveImageUrl(item: {
  enclosure?: { url?: string };
  'media:content'?: { $?: { url?: string } };
  'media:thumbnail'?: { $?: { url?: string } };
  content?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  itemImageTag?: string;
}): string | null {
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  const mediaContentUrl = item['media:content']?.$?.url;
  if (mediaContentUrl) {
    return mediaContentUrl;
  }

  const mediaThumbnailUrl = item['media:thumbnail']?.$?.url;
  if (mediaThumbnailUrl) {
    return mediaThumbnailUrl;
  }

  // Anadolu Ajansı gibi kaynaklar görseli standart olmayan bir item-level
  // <image>URL</image> etiketinde taşır (canlı ortamda tespit edildi:
  // AA'nın görselleri hiç gelmiyordu çünkü bu alan hiç kontrol edilmiyordu).
  if (item.itemImageTag && item.itemImageTag.trim().startsWith('http')) {
    return item.itemImageTag.trim();
  }

  const fromContent = extractImageFromContent(item.content);
  if (fromContent) {
    return fromContent;
  }

  // Bazı kaynaklar (ör. WordPress tabanlı siteler) görseli sadece
  // content:encoded (tam HTML gövdesi) alanında taşır.
  const fromEncodedContent = extractImageFromContent(item['content:encoded']);
  if (fromEncodedContent) {
    return fromEncodedContent;
  }

  return null;
}

/**
 * Verilen RSS besleme URL'sini çeker, ayrıştırır ve her öğeyi
 * RssFeedItem biçimine normalize eder.
 *
 * Ağ hatası, zaman aşımı veya geçersiz/bozuk XML durumunda hata fırlatmaz;
 * bunun yerine boş bir dizi döndürür ve durumu konsola Türkçe bir mesajla
 * loglar — böylece bir kaynağın başarısız olması, diğer kaynakların RSS
 * ingest pipeline'ında işlenmesini engellemez.
 */
export async function fetchRssFeedItems(
  sourceName: string,
  rssUrl: string,
): Promise<RssFeedItem[]> {
  try {
    const feed = await rssParser.parseURL(rssUrl);

    if (!feed.items || feed.items.length === 0) {
      return [];
    }

    return feed.items
      .filter((item) => Boolean(item.title) && Boolean(item.link))
      .map((item) => {
        const rawContent = item.content ?? item.contentSnippet ?? '';
        const contentSnippet = stripHtml(item.contentSnippet ?? rawContent);
        const imageUrl = resolveImageUrl(item);

        return {
          sourceName,
          sourceUrl: rssUrl,
          title: stripHtml(item.title) || 'Başlıksız Haber',
          link: item.link ?? '',
          contentSnippet,
          isoDate: item.isoDate ?? item.pubDate ?? null,
          imageUrl,
        } satisfies RssFeedItem;
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'bilinmeyen hata';
    console.error(
      `[RSS] "${sourceName}" kaynağından besleme çekilemedi (${rssUrl}): ${errorMessage}`,
    );
    return [];
  }
}

/**
 * Birden fazla RSS kaynağını paralel olarak çeker. Her kaynak bağımsız
 * olarak işlenir; bir kaynağın başarısız olması diğerlerini etkilemez.
 * Sonuçlar tek bir düz RssFeedItem[] dizisi olarak birleştirilir.
 */
export async function fetchMultipleRssFeeds(
  sources: { sourceName: string; rssUrl: string }[],
): Promise<RssFeedItem[]> {
  const results = await Promise.all(
    sources.map((source) => fetchRssFeedItems(source.sourceName, source.rssUrl)),
  );

  return results.flat();
}