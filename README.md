# SN Haber — AI Destekli Haber Platformu

## Proje Hakkında

**SN Haber**, Türkiye ve dünyadan güncel haberleri otomatik olarak toplayan, yapay zeka ile özetleyen, doğrulayan ve kategorilere ayıran modern bir haber platformudur. Next.js 14 (App Router) üzerine inşa edilmiş, tamamen koyu (OLED dark) temalı, yüksek performanslı ve SEO'ya uygun bir web uygulamasıdır.

Platform; Türkiye'nin majör RSS kaynaklarından her 10 dakikada bir otomatik haber çeker, içerik benzerliği algoritmalarıyla mükerrer haberleri engeller, Groq (Llama-3) ve Google Gemini Flash modelleriyle haberleri işleyip özetler/doğrular, ve güncel haberler üzerinde soru-cevap yapabilen bir RAG tabanlı yapay zeka asistanı sunar.

- **Canlı adres (hedef domain):** `snhaber.duckdns.org`
- **GitHub:** `piyamijj/sn-haber`

---

## Özellikler

### 1. Tasarım / Tema
- Saf koyu tema (OLED Dark, `#09090b` arka plan) ve esnek gri panellerle tüm arayüz.
- Üstte kayan **son dakika (flash) haber bandı** ve **canlı piyasa ticker'ı** (Dolar, Euro, Altın, BTC, BIST100).
- Anasayfa: kategoriye göre filtrelenebilir, **sonsuz kaydırma (infinite-scroll)** haber akışı.
- Haber detay sayfası: temiz tipografi, tarih/saat, okuma süresi, AI üretimi **3 maddelik "Hızlı Özet" kutusu**, **sesli okuma (TTS)** butonu.

### 2. AI Entegrasyonu
- **Groq API (Llama-3)** ile başlık/özet hızlı işleme.
- **Gemini Flash** ile detaylı analiz, doğrulama ve kategorizasyon.
- Sağ altta sabit, **Framer Motion animasyonlu floating AI chatbot** balonu — RAG (Bilgi Getirimi ile Zenginleştirilmiş Üretim) ile güncel haberleri sorgulayıp yanıtlar.

### 3. Otomasyon
- **Vercel Cron Jobs** ile Türkiye'nin majör RSS kaynaklarından her 10 dakikada bir otomatik haber çekimi.
- İçerik benzerliği algoritmasıyla (hash + embedding tabanlı) **mükerrer haber engelleme**.

### 4. SEO / Performans
- Dinamik **OpenGraph** görselleri (her haber için otomatik üretilir).
- `/feed.xml` üzerinden **RSS** çıktısı.
- **NewsArticle JSON-LD** yapılandırılmış veri.
- **ISR (Incremental Static Regeneration)** ile hızlı, güncel sayfa üretimi.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 14+ (App Router), React 18, TypeScript |
| Stil | Tailwind CSS, Shadcn UI (Radix UI primitifleri), Framer Motion |
| Veritabanı | Supabase (Postgres + pgvector) |
| Cache / Dedup | Upstash Redis |
| AI — Hızlı işleme | Groq API (Llama-3) |
| AI — Analiz / Embedding | Google Gemini Flash |
| RSS İşleme | rss-parser |
| Dağıtım | Vercel (Hosting + Cron Jobs) |
| Domain | DuckDNS (`snhaber.duckdns.org`) |

---

## Proje Yapısı

```
sn-haber/
├── app/                        # Next.js App Router sayfaları ve route handler'ları
│   ├── page.tsx                 # Anasayfa (haber akışı)
│   ├── layout.tsx               # Kök layout (header/footer/chatbot)
│   ├── globals.css              # OLED koyu tema CSS değişkenleri
│   ├── haber/[slug]/            # Haber detay sayfası
│   ├── kategori/[slug]/         # Kategoriye göre filtrelenmiş akış
│   ├── opengraph/[slug]/        # Dinamik OpenGraph görsel üretimi
│   ├── feed.xml/                # RSS çıktısı
│   ├── sitemap.ts               # Dinamik sitemap
│   ├── robots.ts                # robots.txt kuralları
│   └── api/
│       ├── haberler/            # Sayfalanmış haber listesi (infinite-scroll)
│       ├── markets/              # Canlı piyasa ticker verisi
│       ├── chat/                 # RAG chatbot uç noktası
│       └── cron/rss-ingest/      # Vercel Cron Job hedefi (RSS çekme pipeline'ı)
├── components/
│   ├── ui/                      # Shadcn UI temel bileşenleri (Button, Card, Badge, ...)
│   ├── layout/                  # Header, footer, flash/piyasa ticker'ları
│   ├── haber/                   # Haber kartı, akış, hızlı özet kutusu, TTS butonu
│   └── chatbot/                 # Floating AI chatbot bileşeni
├── lib/
│   ├── supabase/                # Supabase istemci fabrikaları (browser/server/service)
│   ├── redis/                   # Upstash Redis istemcisi ve cache/dedup yardımcıları
│   ├── haberler/                # Haber veri erişim katmanı (sorgular)
│   ├── markets/                 # Piyasa veri sağlayıcı katmanı
│   ├── ai/                      # Groq/Gemini entegrasyon katmanı (Aşama 3)
│   ├── rss/                     # RSS ayrıştırma yardımcıları (Aşama 2)
│   └── utils.ts                 # Ortak yardımcı fonksiyonlar
├── types/                       # Paylaşılan TypeScript tipleri
├── supabase/migrations/         # SQL şema migration dosyaları
├── scripts/                     # Yardımcı script'ler (örn. manuel RSS ingest tetikleme)
├── vercel.json                  # Vercel Cron Job tanımı
├── .env.local.example           # Ortam değişkenleri şablonu (gerçek anahtar İÇERMEZ)
└── .gitignore                   # .env.local dahil, commit edilmemesi gereken dosyalar
```

---

## Kurulum

Yerel geliştirme ortamında projeyi çalıştırmak için:

```bash
# 1. Depoyu klonlayın
git clone https://github.com/piyamijj/sn-haber.git
cd sn-haber

# 2. Bağımlılıkları yükleyin
npm install

# 3. Ortam değişkenleri şablonunu kopyalayın ve doldurun
cp .env.local.example .env.local
# .env.local dosyasını açıp aşağıdaki "Ortam Değişkenleri" tablosundaki
# gerçek değerlerinizi girin.

# 4. Geliştirme sunucusunu başlatın
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

---

## Ortam Değişkenleri

Tüm değişkenlerin şablonu `.env.local.example` dosyasındadır. **`.env.local` dosyası asla git'e commit edilmemelidir** (`.gitignore` içinde tanımlıdır).

| Değişken | Açıklama | Nereden Alınır |
|---|---|---|
| `NEXT_PUBLIC_DOMAIN` | Sitenin canlı domaini | `snhaber.duckdns.org` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'si | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public (anon) anahtarı | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase yetkili (service role) anahtarı — sadece sunucu tarafı | Supabase → Project Settings → API |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL'si | Upstash Console → Redis veritabanı → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token'ı | Upstash Console → Redis veritabanı → REST API |
| `GROQ_API_KEY` | Groq API anahtarı (Llama-3) | console.groq.com/keys |
| `GEMINI_API_KEY` | Google Gemini API anahtarı | aistudio.google.com/app/apikey |
| `CRON_SECRET` | Vercel Cron Job kimlik doğrulama gizli anahtarı | Kendiniz üretin (örn. rastgele bir UUID) |

---

## Supabase Kurulumu

1. [app.supabase.com](https://app.supabase.com) üzerinden yeni bir proje oluşturun.
2. Proje ayarlarından (**Project Settings → API**) `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` değerlerini alın.
3. Supabase SQL Editor'ü açın ve `supabase/migrations/0001_init.sql` dosyasının tüm içeriğini çalıştırın. Bu migration:
   - `pgvector` uzantısını etkinleştirir (embedding tabanlı mükerrer tespiti ve RAG için gereklidir),
   - `haberler` (haberler) ve `kaynaklar` (RSS kaynakları) tablolarını oluşturur,
   - Gerekli indeksleri ve Row Level Security (RLS) politikalarını kurar,
   - Türkiye'nin majör RSS kaynaklarının başlangıç listesini ekler.
4. Migration'ın hatasız tamamlandığını **Table Editor** üzerinden doğrulayın.

---

## Vercel Dağıtımı

1. GitHub deposunu (`piyamijj/sn-haber`) Vercel'de yeni bir proje olarak içe aktarın.
2. Vercel proje ayarlarından **Environment Variables** bölümüne, yukarıdaki "Ortam Değişkenleri" tablosundaki tüm değerleri ekleyin (`.env.local` içeriğiyle aynı değerler).
3. `vercel.json` dosyasında tanımlı Cron Job (`/api/cron/rss-ingest`, her 10 dakikada bir) dağıtımla birlikte otomatik olarak etkinleşir; ekstra bir kurulum gerekmez.
4. **Domain bağlama (DuckDNS):**
   - Vercel proje ayarlarından **Domains** bölümüne `snhaber.duckdns.org` domainini ekleyin.
   - Vercel'in size vereceği CNAME/A kaydını, DuckDNS hesabınızdaki `snhaber` alt domaininin DNS ayarlarına girin.
   - DNS doğrulaması tamamlandığında Vercel otomatik olarak SSL sertifikası sağlar.

Bu adımların çoğu kullanıcı hesabında yapılması gereken manuel işlemlerdir (Supabase proje oluşturma, GitHub yetkilendirmesi, Vercel proje bağlama, DuckDNS DNS ayarı) — bu nedenle her adım öncesinde kopyala-yapıştır hazır talimatlar ilgili oturumdan iletilir.

---

## Proje Aşamaları / Yol Haritası

- [x] **Aşama 1 — Proje İskeleti:** Next.js 14 App Router kurulumu, OLED koyu tema, temel layout, anasayfa/haber detay sayfası bileşenleri, GitHub deposu.
- [ ] **Aşama 2 — Veri Katmanı:** Supabase şeması, RSS çekme pipeline'ı, hash/embedding tabanlı mükerrer haber engelleme.
- [ ] **Aşama 3 — AI Entegrasyonları:** Groq hızlı özet, Gemini Flash detaylı analiz/doğrulama/kategorizasyon, RAG tabanlı chatbot.
- [ ] **Aşama 4 — SEO / Performans Katmanı:** Dinamik OpenGraph, JSON-LD, ISR ince ayarları, performans optimizasyonu.
- [ ] **Aşama 5 — Dağıtım:** Vercel'e deploy, Cron Job aktivasyonu, domain bağlama.

---

## Güvenlik Notu

- `.env.local` dosyası **asla** git'e commit edilmemelidir; `.gitignore` içinde bu dosya hariç tutulmuştur.
- Hiçbir API anahtarı veya token, kod dosyalarına veya commit mesajlarına açık şekilde yazılmamalıdır.
- Tüm gizli anahtarlar (`GROQ_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VERCEL_TOKEN`, `GITHUB_TOKEN` vb.) yalnızca `.env.local` (yerel geliştirme) veya Vercel proje ortam değişkenleri (üretim) içinde tutulmalıdır.
- Geliştirme/kurulum sürecinde paylaşılan anahtarların, işlemler tamamlandıktan sonra ilgili servis panellerinden (Groq Console, Google AI Studio, Supabase, Vercel, GitHub) **iptal edilip (revoke) yenilenmesi** önerilir.