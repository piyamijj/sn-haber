import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Verilen tarihe göre Türkçe göreli zaman ifadesi üretir.
 * Örnek: "3 dakika önce", "2 saat önce", "5 gün önce"
 */
export function formatRelativeTimeTr(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return 'şimdi';
  if (diffSec < 60) return `${diffSec} saniye önce`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dakika önce`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} hafta önce`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} ay önce`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} yıl önce`;
}

/**
 * Tarihi "11 Ağustos 2026, 15:02" formatında Türkçe olarak biçimlendirir.
 */
export function formatDateTimeTr(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(target);
}

/**
 * Verilen metnin kelime sayısına göre tahmini okuma süresini dakika
 * cinsinden hesaplar. Ortalama okuma hızı dakikada ~200 kelime kabul edilir.
 */
export function estimateReadingTimeMinutes(text: string): number {
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const minutes = Math.ceil(wordCount / 200);
  return Math.max(1, minutes);
}

/**
 * Sayısal bir değeri Türkçe yerel biçimde (binlik ayraç virgül/nokta) formatlar.
 */
export function formatNumberTr(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Bir metinden URL-uyumlu slug üretir (Türkçe karakterleri normalize eder).
 */
export function slugify(text: string): string {
  const trMap: Record<string, string> = {
    ç: 'c',
    Ç: 'c',
    ğ: 'g',
    Ğ: 'g',
    ı: 'i',
    İ: 'i',
    ö: 'o',
    Ö: 'o',
    ş: 's',
    Ş: 's',
    ü: 'u',
    Ü: 'u',
  };

  return text
    .split('')
    .map((char) => trMap[char] ?? char)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}