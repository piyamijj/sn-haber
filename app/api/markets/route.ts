import { NextResponse } from 'next/server';

import { fetchLiveMarketQuotes } from '@/lib/markets/provider';

/**
 * GET /api/markets
 *
 * İstemci tarafındaki canlı piyasa ticker'ı (Dolar, Euro, Altın, BTC,
 * BIST100) tarafından 30 saniyede bir çağrılır. Veri sağlayıcıdan
 * (şu an için cache/yer tutucu, Aşama 2/3'te gerçek FX/kripto/BIST
 * kaynaklarına bağlanacak) kotasyonları çeker ve JSON olarak döner.
 *
 * Hata durumunda ticker'ın kırılmaması için boş bir dizi ile 200
 * durum kodu döndürülür — bileşen bu durumda kendini gizler.
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
    return NextResponse.json({ quotes: [] }, { status: 200 });
  }
}