import { z } from "zod/v4";
import { createClient } from "@supabase/supabase-js";
import { getLabDb, notConfigured, LAB_BRANCH_PHONES } from "./_shared.js";

// ─────────────────────────────────────────────────────────────
// GET /api/lab-status?code=LAB-XXXXX
// Página del cliente: estado del EXAMEN en tiempo real. Expone
// SOLO campos seguros: mascota, examen, estado e timeline.
// NUNCA teléfono del dueño, notas, montos ni médico.
// Resultado publicado: URL FIRMADA de 10 minutos (storage privado);
// tras 20 días la API dice "expirado" y la página muestra el aviso
// con WhatsApp de la sede. (Los resultados se purgan con el cron.)
// ─────────────────────────────────────────────────────────────

const RESULT_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;

function OrderParseDate(iso: string | null): number {
  return iso ? Date.parse(iso) : NaN;
}

const CODE_SCHEMA = z.string().regex(/^LAB-[A-Z0-9]{5}$/);

export const maxDuration = 10;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(key: string, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  const existing = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (existing.length >= MAX_PER_WINDOW) {
    hits.set(key, existing);
    return true;
  }
  existing.push(now);
  hits.set(key, existing);
  return false;
}

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

export async function buildLabStatusResponse(
  db: ReturnType<typeof getLabDb> & NonNullable<ReturnType<typeof getLabDb>>,
  code: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const order = await db.findOrderByCode(code);
  if (!order) {
    // Sin distinción entre "no existe" y error: misma respuesta.
    return { status: 404, body: { ok: false, error: "No encontramos una orden con ese código." } };
  }
  const timeline = await db.listStatusUpdatesMany([order.id]);
  const orderBody: Record<string, unknown> = {
    orderCode: order.orderCode,
    status: order.status,
    // Campos seguros: mascota + examen para que el cliente reconozca la orden.
    petName: order.petName,
    examType: order.examType,
    // Teléfono de la sede (no del dueño): para el botón WhatsApp cuando el
    // resultado ya expiró. Es el número público de veterinaria.
    sedeLabel: order.sedeResponsable,
    sedePhone: LAB_BRANCH_PHONES[order.sedeResponsable] ?? "",
    createdAt: order.createdAt,
    timeline: timeline[order.id] ?? [],
  };

  // Resultado publicado → link firmado corto (nunca público permanente).
  // Expirado (ventana 20 días, archivo ya borrado por el cron) → resultExpired:
  // la página muestra el aviso amigable + WhatsApp de la sede.
  const publishedMs = OrderParseDate(order.resultPublishedAt);
  if (order.resultPath && Number.isFinite(publishedMs) && Date.now() - publishedMs <= RESULT_WINDOW_MS) {
    const client = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const { data, error } = await client.storage.from("lab-results").createSignedUrl(order.resultPath, 600);
    if (!error && data?.signedUrl) {
      orderBody.resultFile = {
        url: data.signedUrl,
        name: order.resultName || order.orderCode,
        publishedAt: order.resultPublishedAt,
      };
    }
  } else if (!order.resultPath && Number.isFinite(publishedMs)) {
    orderBody.resultExpired = true;
  }

  return {
    status: 200,
    body: {
      ok: true,
      order: orderBody,
    },
  };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  const ip = typeof req.headers["x-forwarded-for"] === "string"
    ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
    : "direct";
  if (rateLimited(ip, Date.now())) {
    res.status(429).json({ ok: false, error: "Demasiadas consultas. Espera un momento." });
    return;
  }

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const rawCode = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  const parsedCode = CODE_SCHEMA.safeParse(rawCode);
  if (!parsedCode.success) {
    res.status(400).json({ ok: false, error: "Código de orden inválido." });
    return;
  }

  if (notConfigured(res)) return;

  try {
    const db = getLabDb()!;
    const result = await buildLabStatusResponse(db, parsedCode.data);
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
