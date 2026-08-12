import { NextResponse } from 'next/server';

import { fetchLiveMarketQuotes, getPlaceholderQuotes } from '@/lib/markets/provider';

/**
 * GET /api/markets
 *
 * İstemci tarafındaki canlı piyasa ticker'ı (Dolar, Euro, Altın, BTC,
 * BIST100) tarafından 30 saniyede bir çağrılır. Veri sağlayıcıdan
 * (Redis cache -> canlı fiyat -> yer tutucu değerler zinciri, bkz.
 * lib/markets/provider.ts) kotasyonları çeker ve JSON olarak döner.
 *
 * Piyasa bandının HER ZAMAN görünür kalması istendiği için (ör. dış
 * veri sağlayıcısı tamamen erişilemez olsa ya da bu route'ta beklenmeyen
 * bir hata oluşsa bile), fetchLiveMarketQuotes() kendi içinde zaten bir
 * yer tutucu zincirine düşer; burada da EK bir son güvenlik ağı olarak,
 * o fonksiyon beklenmedik şekilde hata fırlatırsa boş dizi DEĞİL,
 * doğrudan aynı yer tutucu kotasyonları döndürüyoruz. Böylece
 * MarketTicker bileşeni (quotes.length === 0 durumunda kendini
 * gizleyecek şekilde yazılmış) hiçbir zaman "veri yok" durumuna düşmez.
 */
export async function GET() {
  try {
    const quotes = await fetchLiveMarketQuotes();

    return NextResponse.json(
      { quotes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch {
    return NextResponse.json({ quotes: getPlaceholderQuotes() }, { status: 200 });
  }
}