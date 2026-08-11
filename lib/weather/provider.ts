import type { WeatherSnapshot } from '@/types';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/** Konum izni verilmediğinde veya alınamadığında kullanılan varsayılan şehir (İstanbul). */
const DEFAULT_LATITUDE = 41.0082;
const DEFAULT_LONGITUDE = 28.9784;
const DEFAULT_CITY_NAME = 'İstanbul';

interface OpenMeteoCurrentResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

interface ReverseGeocodeResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
}

/**
 * Verilen koordinatlar için Türkçe bir şehir/yerleşim adı çözer.
 * BigDataCloud'un anahtar gerektirmeyen ters coğrafi kodlama uç noktasını
 * kullanır. Herhangi bir hata durumunda null döner — çağıran taraf bu
 * durumda genel bir isim (örn. "Bulunduğunuz Konum") kullanabilir.
 */
async function resolveCityName(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=tr`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ReverseGeocodeResponse;
    return data.city || data.locality || data.principalSubdivision || null;
  } catch {
    return null;
  }
}

/**
 * Verilen koordinatlar için Open-Meteo'dan canlı hava durumu anlık
 * görüntüsü çeker (sıcaklık, WMO hava kodu, gündüz/gece bilgisi) ve
 * şehir adını çözmeye çalışır.
 *
 * Anahtar gerektirmez. API çağrısı başarısız olursa varsayılan şehir
 * (İstanbul) için sabit/yaklaşık bir değer DEĞİL, boş bir hata fırlatır
 * — çağıran route bu durumu ele alıp uygun bir HTTP yanıtı döner.
 */
export async function fetchWeatherSnapshot(
  latitude: number = DEFAULT_LATITUDE,
  longitude: number = DEFAULT_LONGITUDE,
): Promise<WeatherSnapshot> {
  const forecastUrl =
    `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,weather_code,is_day&timezone=auto';

  const [forecastResponse, cityName] = await Promise.all([
    fetch(forecastUrl, { signal: AbortSignal.timeout(5000) }),
    resolveCityName(latitude, longitude),
  ]);

  if (!forecastResponse.ok) {
    throw new Error(`Open-Meteo yanıtı başarısız: ${forecastResponse.status}`);
  }

  const data = (await forecastResponse.json()) as OpenMeteoCurrentResponse;
  const current = data.current;

  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Open-Meteo yanıtında geçerli sıcaklık verisi bulunamadı.');
  }

  return {
    cityName: cityName ?? DEFAULT_CITY_NAME,
    temperatureCelsius: Math.round(current.temperature_2m),
    weatherCode: current.weather_code ?? 0,
    isDay: current.is_day !== 0,
  };
}