import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Eye, Clock } from 'lucide-react';

import { getArticleBySlug, getRelatedArticles } from '@/lib/haberler/queries';
import { NEWS_CATEGORY_LABELS_TR } from '@/types';
import { formatDateTimeTr, formatNumberTr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { QuickSummaryBox } from '@/components/haber/quick-summary-box';
import { TtsButton } from '@/components/haber/tts-button';
import { NewsCard } from '@/components/haber/news-card';

export const revalidate = 300;

interface ArticlePageParams {
  params: {
    slug: string;
  };
}

const siteDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'snhaber.duckdns.org';
const siteUrl = `https://${siteDomain}`;

export async function generateMetadata({ params }: ArticlePageParams): Promise<Metadata> {
  const { slug } = params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: 'Haber Bulunamadı',
    };
  }

  // Not: OpenGraph/Twitter görseli burada elle belirtilmiyor — bu segmentteki
  // opengraph-image.tsx dosyası (app/haber/[slug]/opengraph-image.tsx),
  // Next.js'in dosya-tabanlı metadata konvansiyonu sayesinde otomatik olarak
  // bu sayfanın openGraph.images / twitter.images alanına bağlanır.
  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: `${siteUrl}/haber/${article.slug}`,
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary,
      url: `${siteUrl}/haber/${article.slug}`,
      siteName: 'SN Haber',
      locale: 'tr_TR',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageParams) {
  const { slug } = params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const categoryLabel = NEWS_CATEGORY_LABELS_TR[article.category];
  const relatedArticles = await getRelatedArticles(article.category, article.id, 4);

  const contentParagraphs = article.content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const ttsText = [article.title, article.summary, contentParagraphs.join(' ')].join('. ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    image: article.imageUrl ? [article.imageUrl] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: article.sourceName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'SN Haber',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/haber/${article.slug}`,
    },
    articleSection: categoryLabel,
    keywords: article.tags.join(', '),
  };

  return (
    <div className="container flex flex-col gap-8 py-6">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            Anasayfa
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/kategori/${article.category}`}
            className="transition-colors hover:text-foreground"
          >
            {categoryLabel}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {article.isFlash && <Badge variant="live">Son Dakika</Badge>}
          <Badge variant="secondary">{categoryLabel}</Badge>
        </div>

        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{article.sourceName}</span>
          <span>{formatDateTimeTr(article.publishedAt)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {article.readingTimeMinutes} dk okuma
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {formatNumberTr(article.viewCount)} görüntülenme
          </span>
        </div>

        <TtsButton text={ttsText} />
      </div>

      {article.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-oled-border bg-oled-panel2 sm:aspect-[21/9]">
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            priority
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <QuickSummaryBox bullets={article.aiQuickSummary} />

          <div className="prose-sn">
            {contentParagraphs.length > 0 ? (
              contentParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>{article.summary}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-oled-border pt-4">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Kaynak:{' '}
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {article.sourceName}
            </a>
          </p>
        </div>

        {relatedArticles.length > 0 && (
          <aside className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              İlgili Haberler
            </h2>
            <div className="flex flex-col gap-4">
              {relatedArticles.map((related, index) => (
                <NewsCard key={related.id} article={related} index={index} />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}