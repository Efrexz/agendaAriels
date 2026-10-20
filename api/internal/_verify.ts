import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Verificación de sesión del panel interno. Los endpoints bajo
// /api/internal/* exigen un JWT válido de Supabase Auth.
// (Los archivos con prefijo _ no se exponen como rutas en Vercel.)
// ─────────────────────────────────────────────────────────────

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      adminClient = createClient(url, key, { auth: { persistSession: false } });
    }
  }
  return adminClient;
}

export interface StaffUser {
  id: string;
  email: string;
}

export async function verifyStaff(jwt: string | null | undefined): Promise<StaffUser | null> {
  if (!jwt) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "sin-correo",
  };
}

export function bearerFrom(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers.authorization;
  if (typeof raw !== "string") return null;
  const match = /^Bearer (.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

export function unauthorized(res: { status(code: number): { json(p: unknown): unknown } }): void {
  res.status(401).json({ ok: false, error: "Sesión no válida. Ingresa al panel de nuevo." });
}
