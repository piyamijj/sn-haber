import { NextRequest, NextResponse } from 'next/server';

import { getPaginatedArticles } from '@/lib/haberler/queries';
import type { NewsCategory } from '@/types';

const VALID_CATEGORIES: NewsCategory[] = [
  'gundem',
  'ekonomi',
  'dunya',
  'spor',
  'teknoloji',
  'saglik',
  'kultur-sanat',
  'magazin',
  'bilim',
  'yasam',
];

function isNewsCategory(value: string): value is NewsCategory {
  return VALID_CATEGORIES.includes(value as NewsCategory);
}

/**
 * GET /api/haberler
 *
 * İstemci tarafındaki sonsuz kaydırma (infinite-scroll) haber akışı
 * bileşeni tarafından, bir sonraki sayfayı çekmek için kullanılır.
 *
 * Query parametreleri:
 * - cursor    (opsiyonel) — önceki sayfanın son öğesinin published_at değeri.
 * - kategori  (opsiyonel) — NewsCategory birleşimindeki geçerli bir değer.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const cursorParam = searchParams.get('cursor');
    const kategoriParam = searchParams.get('kategori');

    let category: NewsCategory | undefined;

    if (kategoriParam) {
      if (!isNewsCategory(kategoriParam)) {
        return NextResponse.json(
          { hata: 'Geçersiz kategori parametresi.' },
          { status: 400 },
        );
      }
      category = kategoriParam;
    }

    const result = await getPaginatedArticles({
      category,
      cursor: cursorParam ?? undefined,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { hata: 'Haberler yüklenirken bir sunucu hatası oluştu.' },
      { status: 500 },
    );
  }
}