import { z } from "zod/v4";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import {
  getLabDb, notConfigured, staffGuard, isLabBranch, LAB_BRANCH_LABELS,
  formatPhoneForDb,
} from "./_shared.js";

// POST /api/internal/lab/create  (solo staff, desde el panel)
// Nueva orden de laboratorio en el registro (reemplaza el cuaderno).
// Sede origen = a la que pertenece quien registra (auto); responsable = editable.
// WhatsApp best-effort al cliente con su código LAB- (y al counter, patrón grooming).

export const maxDuration = 30;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const CREATE_SCHEMA = z.object({
  sedeResponsable: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  sedeOrigen: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  labName: z.string().trim().min(1).max(120),
  examType: z.string().trim().min(2).max(120),
  petName: z.string().trim().min(2).max(60),
  petType: z.string().trim().max(30).default("-"),
  historyCode: z.string().trim().max(40).default("-"),
  doctorName: z.string().trim().max(120).default("-"),
  ownerName: z.string().trim().min(3).max(80),
  ownerPhone: z.string().trim().min(6).max(24),
  paidNotes: z.string().trim().max(200).default("-"),
  notes: z.string().trim().max(400).default("-"),
});

type CreatePayload = z.infer<typeof CREATE_SCHEMA>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I/1/O/0 confusos

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `LAB-${out}`;
}

// ── Dedupe corto (doble click en "＋ Nueva orden") ──
const DEDUPE_WINDOW_MS = 60_000;
const MAX_DEDUPE_ENTRIES = 200;
const recent = new Map<string, { code: string; at: number }>();

function dedupeKey(p: CreatePayload): string {
  return [p.petName, formatPhoneForDb(p.ownerPhone), p.examType, p.labName].join("|").toLowerCase();
}

function findDedupe(p: CreatePayload, nowMs: number): string | null {
  const hit = recent.get(dedupeKey(p));
  if (!hit) return null;
  if (nowMs - hit.at > DEDUPE_WINDOW_MS) {
    recent.delete(dedupeKey(p));
    return null;
  }
  return hit.code;
}

function rememberDedupe(p: CreatePayload, code: string, nowMs: number): void {
  if (recent.size >= MAX_DEDUPE_ENTRIES) {
    const oldest = recent.keys().next().value;
    if (oldest) recent.delete(oldest);
  }
  recent.set(dedupeKey(p), { code, at: nowMs });
}

export function buildClientLabMessage(p: CreatePayload, code: string): string {
  const lines = [
    `🧪 *Orden de laboratorio registrada, ${p.ownerName.split(/\s+/)[0]}!*`,
    "",
    `🐾 Mascota: ${p.petName} · Examen: ${p.examType}`,
    `🏥 Laboratorio: ${p.labName} · ${LAB_BRANCH_LABELS[p.sedeResponsable] ?? p.sedeResponsable}`,
    `🔖 Código: *${code}*`,
    "",
    "Te avisaremos por este medio cuando tu resultado esté listo 🐶✨",
    "",
    "Puedes ver el estado en tiempo real con tu código en:",
    "https://agenda-ariels-nu.vercel.app/estado",
  ];
  return lines.join("\n");
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const parsed = CREATE_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Datos incompletos: revisa mascota, examen, laboratorio y teléfono." });
    return;
  }
  const payload = parsed.data;
  if (!isLabBranch(payload.sedeOrigen) || !isLabBranch(payload.sedeResponsable)) {
    res.status(400).json({ ok: false, error: "Sede inválida." });
    return;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const deduped = findDedupe(payload, nowMs);
  if (deduped) {
    res.status(200).json({ ok: true, orderCode: deduped });
    return;
  }

  const db = getLabDb()!;

  // Insert con reintentos por unicidad del código
  let inserted = false;
  let code = "";
  let newId: string | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    code = randomCode();
    try {
      const row = await db.insertOrder({
        orderCode: code,
        sedeOrigen: payload.sedeOrigen,
        sedeResponsable: payload.sedeResponsable,
        labName: payload.labName,
        examType: payload.examType,
        petName: payload.petName,
        petType: payload.petType,
        historyCode: payload.historyCode,
        doctorName: payload.doctorName,
        ownerName: payload.ownerName,
        ownerPhone: formatPhoneForDb(payload.ownerPhone),
        paidNotes: payload.paidNotes,
        notes: payload.notes,
        status: "recibida",
        createdBy: staff.email,
      });
      inserted = row.code === null;
      newId = row.id;
      if (row.code === "23505") console.warn(`[lab/create] código ${code} colisionó, reintentando`);
    } catch (err) {
      console.error(`[lab/create] insert falló: ${err instanceof Error ? err.message : err}`);
      res.status(500).json({ ok: false, error: "No pudimos registrar la orden. Intenta de nuevo." });
      return;
    }
  }
  if (!inserted) {
    res.status(500).json({ ok: false, error: "No pudimos registrar la orden. Intenta de nuevo." });
    return;
  }

  // Timeline inicial (best-effort)
  try {
    if (newId) await db.recordOrderStatus(newId, "recibida", staff.email);
  } catch {
    /* timeline best-effort */
  }

  // WhatsApp al cliente con su código (best-effort; no bloquea el registro)
  let notified = false;
  const env = process.env as BookingEnv;
  const dest = normalizePhoneDest(formatPhoneForDb(payload.ownerPhone));
  const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
  const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";
  if (dest && (evoReady || dryRun)) {
    const sent = await sendViaEvolution([buildClientLabMessage(payload, code)], env, fetch, dest);
    notified = sent.ok;
  }

  rememberDedupe(payload, code, nowMs);
  res.status(200).json({ ok: true, orderCode: code, notified });
}
