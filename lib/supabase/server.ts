import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Sunucu tarafında (Server Components, Route Handlers, RSS ingest/cron
 * pipeline) kullanılacak Supabase istemcilerini oluşturan yardımcı
 * fonksiyonlar. Bu dosya SADECE sunucu tarafında import edilmelidir;
 * SUPABASE_SERVICE_ROLE_KEY hiçbir zaman tarayıcıya gönderilmemelidir.
 */

let serviceClient: SupabaseClient | null = null;
let anonServerClient: SupabaseClient | null = null;

/**
 * Yetkili (service role) Supabase istemcisi.
 * Row Level Security politikalarını atlar — SADECE güvenilir sunucu
 * kodunda (RSS ingest pipeline, cron job, admin işlemleri) kullanılmalıdır.
 * İstemci tarafına veya herhangi bir public route'a asla sızdırılmamalıdır.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (serviceClient) {
    return serviceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase servis istemcisi başlatılamadı: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlı olmalı.',
    );
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

/**
 * Salt-okunur (anon key) Supabase istemcisi.
 * Server Component'lerde sayfa render'ı için haber listesi/detayı
 * okumak amacıyla kullanılır. Row Level Security politikalarına tabidir.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (anonServerClient) {
    return anonServerClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase sunucu istemcisi başlatılamadı: NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ortam değişkenleri tanımlı olmalı.',
    );
  }

  anonServerClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return anonServerClient;
}