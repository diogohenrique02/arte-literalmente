import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key && url.startsWith('https://'));
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, key!) : null;
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Integração pendente: configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.');
  return supabase;
}