import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente del panel interno en el navegador: usa la anon key.
// RLS en Supabase deniega TODO a este rol — el acceso a datos solo
// ocurre vía /api/internal/* con el JWT del staff autenticado.

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !anonKey) {
      throw new Error("Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno");
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
