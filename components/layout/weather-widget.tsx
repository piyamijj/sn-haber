'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog } from 'lucide-react';

import type { WeatherSnapshot } from '@/types';
import { cn } from '@/lib/utils';

const GEOLOCATION_TIMEOUT_MS = 5000;

/**
 * Open-Meteo WMO hava kodunu (current.weather_code) uygun bir lucide-react
 * ikonuna eşler. Kod aralıkları Open-Meteo'nun resmi WMO kod tablosuna
 * göredir: 0-1 açık, 2-3 parçalı/bulutlu, 45-48 sis, 51-67 yağmur/çisenti,
 * 71-86 kar, 95-99 gök gürültülü sağanak.
 */
function getWeatherIcon(weatherCode: number, isDay: boolean) {
  if (weatherCode === 0 || weatherCode === 1) {
    return isDay ? Sun : Moon;
  }
  if (weatherCode >= 2 && weatherCode <= 3) {
    return Cloud;
  }
  if (weatherCode >= 45 && weatherCode <= 48) {
    return CloudFog;
  }
  if (weatherCode >= 51 && weatherCode <= 67) {
    return CloudRain;
  }
  if (weatherCode >= 71 && weatherCode <= 86) {
    return CloudSnow;
  }
  if (weatherCode >= 95) {
    return CloudLightning;
  }
  return Cloud;
}

/**
 * Header'da piyasa ticker'ının yakınında gösterilen küçük, canlı hava
 * durumu göstergesi. Tarayıcının Geolocation API'siyle kullanıcının
 * konumunu almaya çalışır (izin ister); izin verilmezse ya da konum
 * alınamazsa SESSİZCE İstanbul varsayılanına döner — hiçbir hata mesajı
 * göstermez, widget her koşulda anlamlı bir şey gösterir.
 */
export function WeatherWidget({ className }: { className?: string }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeatherFor(latitude?: number, longitude?: number) {
      try {
        const url =
          typeof latitude === 'number' && typeof longitude === 'number'
            ? `/api/weather?lat=${latitude}&lon=${longitude}`
            : '/api/weather';

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as WeatherSnapshot;
        if (isMounted) {
          setWeather(data);
        }
      } catch {
        // Sessizce yut — widget bu durumda hiçbir şey göstermeyecek
        // (mevcut null state korunur), sayfayı bozmaz.
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeatherFor(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // İzin reddedildi ya da konum alınamadı — sessizce İstanbul
          // varsayılanına düş.
          fetchWeatherFor();
        },
        { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
      );
    } else {
      fetchWeatherFor();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  if (!weather) {
    return null;
  }

  const WeatherIcon = getWeatherIcon(weather.weatherCode, weather.isDay);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-sm text-foreground/80',
        className,
      )}
    >
      <WeatherIcon className="h-4 w-4 text-brand" aria-hidden="true" />
      <span className="font-medium">{weather.temperatureCelsius}°C</span>
      <span className="text-muted-foreground">{weather.cityName}</span>
    </div>
  );
}