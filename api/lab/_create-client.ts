import { z } from "zod/v4";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { getLabDb, isLabBranch, LAB_BRANCH_LABELS, formatPhoneForDb } from "./_shared.js";

// POST /api/lab/create-client — PÚBLICO (wizard /cita-medica, tile de lab).// El cliente SOLICITA un examen de laboratorio (feedback 17/11 del dueño):
// requiere orden sellada (la sube como foto al bucket privado) y queda en
// estado 'solicitada' — la muestra AÚN no se tomó. El counter verifica la
// orden, coordina por WhatsApp la toma (costo S/ 25, se paga en sede) y al
// tomarla pasa la orden a 'recibida' → arranca el tracking existente.
// La foto de la orden es tolerante a fallos: la reserva se crea PRIMERO
// (INSERT antes; si la subida falla, el panel muestra "⚠️ Sin orden" y el
// counter la pide por chat o el cliente la trae impresa).

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

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ2345679"; // sin I/1/O/0 confusos

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `LAB-${out}`;
}

const CLIENT_SCHEMA = z.object({
  sede: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  examType: z.string().trim().min(2).max(120),
  petName: z.string().trim().min(2).max(60),
  petType: z.string().trim().min(1).max(30).default("Perro"),
  ownerName: z.string().trim().min(3).max(80),
  ownerPhone: z.string().trim().min(6).max(24),
});

type ClientPayload = z.infer<typeof CLIENT_SCHEMA>;

/** Mensaje al cliente (sin nombre del laboratorio externo — decisión del dueño). */
export function buildLabRequestMessage(
  p: ClientPayload,
  code: string,
): string {
  const lines = [
    `🧪 *Solicitud de examen recibida, ${p.ownerName.split(/\s+/)[0]}!*`,
    "",
    `🔬 Examen: ${p.examType}`,
    `🏥 ${LAB_BRANCH_LABELS[p.sede] ?? p.sede}`,
    `🐾 Mascota: ${p.petName}`,
    `🔖 Código: *${code}*`,
    "",
    "Nuestro personal está verificando tu orden con el equipo de la sede.",
    "Te escribiremos por este medio para coordinar la toma de muestra:",
    "💉 *Costo de toma de muestra: S/ 25* (se paga en la sede, el día de la toma).",
    "",
    "Puedes ver el estado en tiempo real (tu código ya viene incluido) en:",
    `https://agenda-ariels-nu.vercel.app/estado?code=${code}`,
    "",
    `☎ Consultas: por este mismo chat 🐶✨`,
  ];
  return lines.join("\n");
}

/** Alerta al counter (patrón grooming). */
export function buildLabCounterAlert(p: ClientPayload, code: string): string {
  const lines = [
    "🔔 *NUEVA SOLICITUD DE LABORATORIO (web)*",
    `🔖 Código: *${code}*`,
    `🏥 ${LAB_BRANCH_LABELS[p.sede] ?? p.sede}`,
    `🔬 Examen: ${p.examType}`,
    `🐾 Mascota: ${p.petName} · 👤 ${p.ownerName} · ${p.ownerPhone}`,
    "📄 Verificar orden en panel → coordinar toma de muestra (S/ 25) → al tomarla pasar a 'recibida'",
  ];
  return lines.join("\n");
}

// Dedupe corto (doble click): misma petición clave en 60s
const DEDUPE_WINDOW_MS = 60_000;
const MAX_DEDUPE_ENTRIES = 200;
const recent = new Map<string, { code: string; at: number }>();
function dedupeKey(p: ClientPayload): string {
  return `${p.ownerPhone.replace(/\D/g, "")}|${p.sede}|${p.examType}|${p.petName}`.toLowerCase();
}

export async function handleLabCreateClient(opts: { body: unknown; now?: Date }): Promise<{ status: number; body: Record<string, unknown> }> {
  const now = opts.now ?? new Date();
  const parsed = CLIENT_SCHEMA.safeParse(opts.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 4).join(" | ");
    console.warn(`[lab/create-client] payload rechazado → ${issues}`);
    return { status: 400, body: { ok: false, error: "Datos de la solicitud inválidos o incompletos." } };
  }
  const p = parsed.data;
  if (!isLabBranch(p.sede)) return { status: 400, body: { ok: false, error: "Sede inválida." } };

  const db = getLabDb();
  if (!db) return { status: 500, body: { ok: false, error: "Servicio no disponible." } };

  const nowMs = now.getTime();
  const cutoff = nowMs - DEDUPE_WINDOW_MS;
  for (const [k, v] of recent) if (v.at < cutoff) recent.delete(k);
  const hit = recent.get(dedupeKey(p));
  if (hit) return { status: 200, body: { ok: true, orderCode: hit.code } };

  // Insert con reintentos por unicidad del código
  let code = "";
  let insertedId: string | null = null;
  for (let attempt = 0; attempt < 5 && !insertedId; attempt++) {
    code = randomCode();
    try {
      const row = await db.insertOrder({
        orderCode: code,
        sedeOrigen: p.sede, // la misma sede origina y es responsable (web)
        sedeResponsable: p.sede,
        labName: "Por asignar", // el counter la define al enviar la muestra
        examType: p.examType,
        petName: p.petName,
        petType: p.petType,
        historyCode: "-",
        doctorName: "-", // viene de la orden externa del cliente
        ownerName: p.ownerName,
        ownerPhone: formatPhoneForDb(p.ownerPhone),
        paidNotes: "Toma de muestra S/ 25 por pagar en sede",
        notes: "Solicitud desde la web — verificar orden sellada y coordinar toma de muestra",
        status: "solicitada",
        createdBy: "cliente-web",
      });
      if (row.id) insertedId = row.id;
      if (row.code === "23505") console.warn(`[lab/create-client] código ${code} colisionó, reintentando`);
    } catch (err) {
      console.error(`[lab/create-client] insert falló: ${err instanceof Error ? err.message : err}`);
      return { status: 500, body: { ok: false, error: "No pudimos registrar tu solicitud. Intenta de nuevo." } };
    }
  }
  if (!insertedId) return { status: 500, body: { ok: false, error: "No pudimos registrar tu solicitud. Intenta de nuevo." } };

  // Timeline inicial (el aviso del resultado en /estado)
  try { await db.recordOrderStatus(insertedId, "solicitada", "sistema"); } catch { /* best-effort */ }

  // WhatsApps: alerta al counter + mensaje al cliente (best-effort)
  const env = process.env as BookingEnv;
  const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
  const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";
  if ((evoReady || dryRun) && normalizePhoneDest(env.WHATSAPP_DESTINO ?? "")) {
    await sendViaEvolution([buildLabCounterAlert(p, code)], env, fetch);
  }
  let clientDelivered: boolean | null = null;
  const dest = normalizePhoneDest(p.ownerPhone);
  if ((evoReady || dryRun) && dest) {
    const delivery = await sendViaEvolution([buildLabRequestMessage(p, code)], env, fetch, dest);
    clientDelivered = delivery.ok;
  }

  recent.set(dedupeKey(p), { code, at: nowMs });
  if (recent.size > MAX_DEDUPE_ENTRIES) recent.clear();
  return { status: 200, body: { ok: true, orderCode: code, whatsappDelivered: clientDelivered } };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" && forwarded.length > 0 ? forwarded.split(",")[0].trim() : "direct";
  // Rate limit simple (mismo espíritu que _create médico)
  const WINDOW_MS = 60_000;
  const MAX_PER_WINDOW = 4;
  const ipHits = (globalThis as unknown as { __labIpHits?: Map<string, number[]> }).__labIpHits ?? new Map<string, number[]>();
  (globalThis as unknown as { __labIpHits?: Map<string, number[]> }).__labIpHits = ipHits;
  const cutoff = Date.now() - WINDOW_MS;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= MAX_PER_WINDOW) { hits.push(Date.now()); ipHits.set(ip, hits); res.status(429).json({ ok: false, error: "Demasiados envíos. Espera un minuto." }); return; }
  hits.push(Date.now());
  ipHits.set(ip, hits);

  try {
    const result = await handleLabCreateClient({ body: req.body });
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
