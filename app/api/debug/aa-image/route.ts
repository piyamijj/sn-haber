import { NextRequest, NextResponse } from 'next/server';

import { fetchRssFeedItems } from '@/lib/rss/fetch-feed';

/**
 * GEÇİCİ DEBUG ROUTE — AA görsel çıkarma mantığını canlı ortamda doğrulamak
 * için eklendi, doğrulama tamamlanınca silinecek. CRON_SECRET ile korunur.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ hata: 'Yetkisiz istek.' }, { status: 401 });
  }

  const items = await fetchRssFeedItems(
    'Anadolu Ajansı - Ekonomi',
    'https://www.aa.com.tr/tr/rss/default?cat=ekonomi',
  );

  return NextResponse.json({
    toplamOge: items.length,
    ornekler: items.slice(0, 5).map((item) => ({
      title: item.title,
      imageUrl: item.imageUrl,
      isoDate: item.isoDate,
    })),
  });
}