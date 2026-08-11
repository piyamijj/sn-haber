import { ImageResponse } from 'next/og';

import { getArticleBySlug } from '@/lib/haberler/queries';
import { NEWS_CATEGORY_LABELS_TR } from '@/types';

export const runtime = 'edge';

export const alt = 'SN Haber';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface OpengraphImageParams {
  params: {
    slug: string;
  };
}

/**
 * /haber/[slug] için dinamik OpenGraph görseli üretir.
 *
 * Koyu (OLED) arka plan üzerinde sol üstte "SN Haber" marka logotype'ı,
 * altında haberin kategori rozeti ve büyük başlık metni, en üstte marka
 * kırmızısı bir vurgu çizgisi gösterir. Haber bulunamazsa, genel bir
 * SN Haber marka görseline düşer.
 */
export default async function OpengraphImage({ params }: OpengraphImageParams) {
  const { slug } = params;
  const article = await getArticleBySlug(slug);

  const categoryLabel = article ? NEWS_CATEGORY_LABELS_TR[article.category] : null;
  const title = article ? article.title : 'SN Haber — AI Destekli Haber Platformu';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(225, 29, 46, 0.18), transparent)',
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '6px',
            width: '160px',
            backgroundColor: '#e11d2e',
            borderRadius: '3px',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: '#e11d2e' }}>SN</span>
            <span style={{ fontSize: 40, fontWeight: 900, color: '#f4f4f5' }}>Haber</span>
          </div>

          {categoryLabel && (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(225, 29, 46, 0.15)',
                color: '#ff4d5e',
                fontSize: 22,
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: '999px',
              }}
            >
              {categoryLabel}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              fontSize: title.length > 80 ? 44 : 56,
              fontWeight: 800,
              color: '#f4f4f5',
              lineHeight: 1.25,
              maxWidth: '1000px',
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#a1a1aa',
          }}
        >
          <span>snhaber.duckdns.org</span>
          <span>AI Destekli Haber Platformu</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}