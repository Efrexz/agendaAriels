import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { getLabDb, notConfigured } from "./_shared.js";
import { resultAvailable, tokenMatches } from "./_access.js";

const SCHEMA = z.object({ code: z.string().regex(/^LAB-[A-Z0-9]{5}$/), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

interface Req { method?: string; body?: unknown }
interface Res { status(code: number): Res; json(payload: unknown): Res; setHeader(name: string, value: string): unknown }

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Método no permitido." }); return; }
  const parsed = SCHEMA.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Enlace inválido." }); return; }
  if (notConfigured(res)) return;
  try {
    const db = getLabDb()!;
    const order = await db.findOrderByCode(parsed.data.code);
    const hash = order ? await db.findResultAccessHash(order.id) : null;
    if (!order || !resultAvailable(order) || !tokenMatches(parsed.data.token, hash)) {
      res.status(404).json({ ok: false, error: "Enlace no disponible o vencido. Solicita uno nuevo a la sede." });
      return;
    }
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await client.storage.from("lab-results").createSignedUrl(order.resultPath!, 60);
    if (error || !data?.signedUrl) { res.status(503).json({ ok: false, error: "No pudimos abrir el resultado. Intenta nuevamente." }); return; }
    res.status(200).json({ ok: true, url: data.signedUrl });
  } catch {
    res.status(500).json({ ok: false, error: "No pudimos abrir el resultado. Intenta nuevamente." });
  }
}
