import { z } from "zod/v4";
import { getMedicalDb, staffGuard } from "./_shared.js";
import { getLabDb } from "../lab/_shared.js";

// POST /api/medical/order  { code, fileBase64, mime }  — PÚBLICO (wizard):
// el cliente sube la foto/PDF de su orden sellada DESPUÉS de que su reserva
// fue registrada. Acepta dos códigos por el prefijo:
//   CM-XXXXX → cita de rayos/eco (medical_appointments, estado 'solicitud')
//   LAB-XXXXX → solicitud de examen de laboratorio (lab_orders, 'solicitada')
// La reserva NUNCA depende de la subida (INSERT antes; si la foto falla, el
// panel muestra "⚠️ Sin orden" y el counter la pide por chat o impresa).
// GET /api/medical/order?code=LAB-XXXXX|CM-XXXXX — SOLO STAFF: URL firmada
// (900 s) para ver la imagen al doctor. Deny-all RLS: el público jamás lee.

export const maxDuration = 30;

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const POST_SCHEMA = z.object({
  code: z.string().regex(/^(CM|LAB)-[A-Z0-9]{5}$/),
  fileBase64: z.string().max(4_600_000), // ~3.3 MB reales tras base64 (límite body de Vercel)
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Firma real del archivo (no confiar en la extensión ni en el mime declarado). */
function magicBytesOk(base64: string, mime: string): boolean {
  const head = base64.slice(0, 24);
  if (mime === "application/pdf") return head.startsWith("JVBERi"); // %PDF
  if (mime === "image/png") return head.startsWith("iVBORw0KGgo"); // \x89PNG
  if (mime === "image/jpeg") return head.startsWith("/9j/"); // FFD8FF
  if (mime === "image/webp") return head.startsWith("UklGR"); // RIFF....WEBP
  return false;
}

function envStorage(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// Rate limit: subir una orden es 1 llamada por reserva; ventaja simple por IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const ipHits = new Map<string, number[]>();
function rateLimited(ip: string, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  const existing = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (existing.length >= MAX_PER_WINDOW) { existing.push(now); ipHits.set(ip, existing); return true; }
  existing.push(now);
  ipHits.set(ip, existing);
  return false;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  const storage = envStorage();
  if (!storage || !getMedicalDb()) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }
  const db = getMedicalDb()!;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const codeRaw = (url.searchParams.get("code") ?? "").trim().toUpperCase();

  // ── GET: URL firmada para el STAFF (mostrarle la orden al doctor) ──
  if (req.method === "GET") {
    const staff = await staffGuard(req, res);
    if (!staff) return;
    if (!/^(CM|LAB)-[A-Z0-9]{5}$/.test(codeRaw)) {
      res.status(400).json({ ok: false, error: "Código inválido." });
      return;
    }
    try {
      let orderPath: string | null = null;
      if (codeRaw.startsWith("LAB-")) {
        const labDb = getLabDb();
        if (!labDb) throw new Error("lab db no configurada");
        orderPath = (await labDb.findOrderByCode(codeRaw))?.orderPath ?? null;
      } else {
        orderPath = (await db.findApptByCode(codeRaw))?.orderPath ?? null;
      }
      if (!orderPath) {
        res.status(404).json({ ok: false, error: "Esta reserva no tiene orden subida." });
        return;
      }
      const sign = await fetch(`${storage.url}/storage/v1/object/sign/medical-orders/${orderPath}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${storage.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 900 }),
      });
      if (!sign.ok) throw new Error(`sign ${sign.status}`);
      const { signedURL } = (await sign.json()) as { signedURL: string };
      res.status(200).json({ ok: true, url: `${storage.url}/storage/v1${signedURL}` });
    } catch {
      res.status(500).json({ ok: false, error: "No se pudo abrir la orden. Intenta de nuevo." });
    }
    return;
  }

  // ── POST: subida del cliente (público, rate-limited) ──
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" && forwarded.length > 0 ? forwarded.split(",")[0].trim() : "direct";
  if (rateLimited(ip, Date.now())) {
    res.status(429).json({ ok: false, error: "Demasiados intentos. Espera un minuto." });
    return;
  }

  const parsed = POST_SCHEMA.safeParse(req.body);
  if (!parsed.success || !magicBytesOk(parsed.data.fileBase64, parsed.data.mime)) {
    res.status(400).json({ ok: false, error: "Archivo inválido: sube una foto (JPG/PNG/WEBP) o PDF de hasta 3 MB." });
    return;
  }
  const { code, fileBase64, mime } = parsed.data;

  try {
    if (code.startsWith("LAB-")) {
      const labDb = getLabDb();
      if (!labDb) throw new Error("lab db no configurada");
      const order = await labDb.findOrderByCode(code);
      if (!order) {
        res.status(404).json({ ok: false, error: "Reserva no encontrada." });
        return;
      }
      if (order.status !== "solicitada") {
        res.status(409).json({ ok: false, error: "Esta solicitud ya fue confirmada: entrega la orden en la sede." });
        return;
      }
      const objectPath = `${order.id}/orden-${Date.now()}.${EXT[mime]}`;
      const bytes = Buffer.from(fileBase64, "base64");
      const up = await fetch(`${storage.url}/storage/v1/object/medical-orders/${objectPath}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${storage.key}`, "Content-Type": mime, "x-upsert": "true", "cache-control": "3600" },
        body: new Uint8Array(bytes),
      });
      if (!up.ok) throw new Error(`storage ${up.status}: ${await up.text()}`);
      await labDb.setOrderFile(order.id, objectPath);
      res.status(200).json({ ok: true });
      return;
    }
    const appt = await db.findApptByCode(code);
    if (!appt) {
      res.status(404).json({ ok: false, error: "Reserva no encontrada." });
      return;
    }
    if (appt.serviceType !== "rayos" && appt.serviceType !== "eco") {
      res.status(400).json({ ok: false, error: "Esta cita no requiere orden médica." });
      return;
    }
    if (appt.status !== "solicitud") {
      res.status(409).json({ ok: false, error: "Esta cita ya fue confirmada: entrega la orden en la sede." });
      return;
    }
    const objectPath = `${appt.id}/orden-${Date.now()}.${EXT[mime]}`;
    const bytes = Buffer.from(fileBase64, "base64");
    const up = await fetch(`${storage.url}/storage/v1/object/medical-orders/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${storage.key}`, "Content-Type": mime, "x-upsert": "true", "cache-control": "3600" },
      body: new Uint8Array(bytes),
    });
    if (!up.ok) throw new Error(`storage ${up.status}: ${await up.text()}`);
    await db.setOrderFile(appt.id, objectPath);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[medical/order] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "No se pudo subir la orden. Intenta de nuevo o envíanosla por WhatsApp." });
  }
}
