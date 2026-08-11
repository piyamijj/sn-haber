import { NextRequest, NextResponse } from 'next/server';

import { fetchWeatherSnapshot } from '@/lib/weather/provider';
import type { WeatherSnapshot } from '@/types';

const FALLBACK_SNAPSHOT: WeatherSnapshot = {
  cityName: 'İstanbul',
  temperatureCelsius: 24,
  weatherCode: 1,
  isDay: true,
};

/**
 * GET /api/weather?lat=..&lon=..
 *
 * Header'daki hava durumu widget'ı tarafından çağrılır. Tarayıcının
 * Geolocation API'siyle alınan koordinatlar varsa lat/lon query
 * parametreleri olarak gönderilir; yoksa (izin verilmedi/alınamadı)
 * parametresiz çağrılır ve sağlayıcı varsayılan olarak İstanbul
 * koordinatlarını kullanır.
 *
 * Hata durumunda widget'ın kırılmaması için sabit bir yedek anlık
 * görüntüyle (İstanbul, makul bir sıcaklık) 200 döner — bileşen bu
 * durumu normal bir veri gibi ele alır, hata göstermez.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  const latitude = latParam ? Number.parseFloat(latParam) : undefined;
  const longitude = lonParam ? Number.parseFloat(lonParam) : undefined;

  const hasValidCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);

  try {
    const snapshot = hasValidCoords
      ? await fetchWeatherSnapshot(latitude, longitude)
      : await fetchWeatherSnapshot();

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch {
    return NextResponse.json(FALLBACK_SNAPSHOT, { status: 200 });
  }
}