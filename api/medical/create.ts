import { z } from "zod/v4";
import { addDays, format } from "date-fns";
import { getLimaDayKey } from "../lib-lima.js";
import { computeFreeSlots, currentMinuteLima, weekdayOf } from "./slots.js";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../booking.js";
import { BRANCH_LABELS, BRANCH_PHONES, getMedicalDb } from "./_shared.js";

// POST /api/medical/create — PÚBLICO (wizard /cita-medica).
// Crea citas: general / rayos / eco (slot exacto) y especializada (solicitud).
// Genera código CM-XXXXX server-side y envía los avisos (clientes y counter).

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

const MAX_ADVANCE_DAYS = 30;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I/1/O/0 confusos

const CREATE_SCHEMA = z.object({
  branch: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  serviceType: z.enum(["general", "rayos", "eco", "especializada"]),
  specialtyId: z.string().uuid().nullable().optional(),
  doctorId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startMinute: z.number().int().min(0).max(1380).nullable().optional(),
  hasOrder: z.boolean().nullable().optional(),
  petName: z.string().trim().min(2).max(60),
  petType: z.string().trim().min(1).max(30).default("-"),
  petNotes: z.string().trim().max(400).default("-"),
  ownerName: z.string().trim().min(3).max(80),
  ownerPhone: z.string().trim().min(6).max(24),
  ownerEmail: z
    .string()
    .trim()
    .max(120)
    .default("-")
    .refine((v) => v === "-" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Email inválido" }),
});

type CreatePayload = z.infer<typeof CREATE_SCHEMA>;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `CM-${out}`;
}

// ── Dedupe corto (doble click): misma petición clave en 60s ──
const DEDUPE_WINDOW_MS = 60_000;
const MAX_DEDUPE_ENTRIES = 200;
const recent = new Map<string, { code: string; at: number }>();

function dedupeKey(p: CreatePayload): string {
  return `${p.ownerPhone.replace(/\D/g, "")}|${p.branch}|${p.serviceType}|${p.doctorId ?? "-"}|${p.date ?? "-"}|${p.startMinute ?? "|"}`;
}

export function resetMedicalDedupe(): void {
  recent.clear();
}

function findDedupe(p: CreatePayload, nowMs: number): string | null {
  const cutoff = nowMs - DEDUPE_WINDOW_MS;
  for (const [k, v] of recent) if (v.at < cutoff) recent.delete(k);
  const hit = recent.get(dedupeKey(p));
  return hit ? hit.code : null;
}

function rememberDedupe(p: CreatePayload, code: string, nowMs: number): void {
  if (recent.size >= MAX_DEDUPE_ENTRIES) {
    const oldest = recent.keys().next().value;
    if (oldest) recent.delete(oldest);
  }
  recent.set(dedupeKey(p), { code, at: nowMs });
}

// ── Plantillas de WhatsApp ───────────────────────────────────

function minuteToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function shortDateLima(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function buildCounterAlert(p: CreatePayload, code: string, extra: Record<string, string | null> = {}): string {
  const lines = [
    "🔔 *NUEVA CITA MÉDICA*",
    `🔖 Código: *${code}*`,
    `🏥 ${BRANCH_LABELS[p.branch] ?? p.branch}`,
    `📋 ${extra.serviceLabel ?? p.serviceType}`,
  ];
  if (extra.specialty) lines.push(`🎓 Especialidad: ${extra.specialty}`);
  if (extra.doctor) lines.push(`🩺 Doctor: ${extra.doctor}`);
  if (p.date) lines.push(`🗓 ${shortDateLima(p.date)}${extra.time ? ` · ${String(extra.time)}` : ""}`);
  lines.push(
    `🐾 Mascota: ${p.petName} (${p.petType})`,
    `👤 ${p.ownerName} · ${p.ownerPhone}`,
  );
  if (p.serviceType === "rayos" || p.serviceType === "eco") {
    lines.push(`📄 Orden médica: ${p.hasOrder ? " presenta orden sellada" : "⚠️ SIN orden"}`);
  }
  if (p.serviceType === "especializada") {
    lines.push("💰 Pago pactado: el cliente enviará comprobante por WhatsApp");
  }
  if (p.doctorId) return lines.join("\n");
  return lines.join("\n");
}

export function buildClientApptMessage(
  p: CreatePayload,
  code: string,
  extra: Record<string, string | null> = {},
  paymentInfo?: string,
): string {
  if (p.serviceType === "especializada") {
    const lines = [
      `🐾 *Solicitud registrada, ${p.ownerName.split(/\s+/)[0]}!*`,
      "",
      `🎓 ${extra.specialty ?? p.serviceType} · ${BRANCH_LABELS[p.branch] ?? p.branch}`,
      `🐾 Mascota: ${p.petName}`,
      `🔖 Código: *${code}*`,
      "",
      "💳 *Para confirmar tu cita, escoge nuestros métodos de pago:*",
      paymentInfo ?? "(métodos de pago en configuración)",
      "",
      `📤 Envíanos la captura del pago al WhatsApp de la sede: ${BRANCH_PHONES[p.branch] ?? ""}`,
      "",
      "Cuando verifiquemos el pago confirmamos fecha, hora y doctor por este medio 🐶✨",
    ];
    return lines.join("\n");
  }

  const lines = [
    `🐾 *Cita registrada, ${p.ownerName.split(/\s+/)[0]}!*`,
    "",
    `📋 ${extra.serviceLabel ?? p.serviceType}`,
    `🏥 ${BRANCH_LABELS[p.branch] ?? p.branch}`,
    `🗓 ${shortDateLima(p.date ?? "")} · ${extra.time ?? ""}`,
  ];
  if (extra.doctor) lines.push(`🩺 Doctor: ${extra.doctor}`);
  lines.push(
    `🐾 Mascota: ${p.petName}`,
    "",
    `🔖 Código: *${code}*`,
  );
  if (p.serviceType === "rayos" || p.serviceType === "eco") {
    lines.push("📄 IMPORTANTE: preséntate con tu orden médica sellada por un médico.");
  }
  lines.push(
    "",
    "⚠️ Llega puntual; la tolerancia es de 10 minutos y luego atendemos al siguiente en espera.",
    `☎ Consultas: ${BRANCH_PHONES[p.branch] ?? ""}`,
    "",
    "¡Te esperamos! 🐶✨",
  );
  return lines.join("\n");
}

// ── Handler ──────────────────────────────────────────────────

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  const existing = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (existing.length >= MAX_PER_WINDOW) {
    ipHits.set(ip, existing);
    return true;
  }
  existing.push(now);
  ipHits.set(ip, existing);
  return false;
}

export async function handleMedicalCreate(opts: {
  body: unknown;
  now?: Date;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const now = opts.now ?? new Date();

  const parsed = CREATE_SCHEMA.safeParse(opts.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 5).join(" | ");
    console.warn(`[medical/create] payload rechazado → ${issues}`);
    return { status: 400, body: { ok: false, error: "Datos de la cita inválidos o incompletos." } };
  }
  const p = parsed.data;

  // Ventana de fechas
  const today = getLimaDayKey(now);
  const maxDay = format(addDays(new Date(today + "T12:00:00Z"), MAX_ADVANCE_DAYS), "yyyy-MM-dd");
  if (p.serviceType !== "especializada") {
    if (!p.date) return { status: 400, body: { ok: false, error: "Elige la fecha de tu cita." } };
    if (p.date < today || p.date > maxDay) {
      return { status: 400, body: { ok: false, error: "Fecha fuera del rango permitido (máx. 30 días)." } };
    }
  }

  // ── Búsqueda y validaciones server-side (nunca confiar en el cliente) ──
  const db = getMedicalDb();
  if (!db) return { status: 500, body: { ok: false, error: "Servicio no disponible." } };

  const config = await db.getConfig();
  const durationMinutes = Math.max(Number(config.appt_duration_minutes) || 60, 15);

  let doctorName: string | null = null;
  let specialtyName: string | null = null;

  try {
    if (p.serviceType === "especializada") {
      if (!p.specialtyId) {
        return { status: 400, body: { ok: false, error: "Elige una especialidad." } };
      }
      const specs = await db.listSpecialties(true);
      const spec = specs.find((s) => s.id === p.specialtyId) ?? null;
      if (!spec) return { status: 400, body: { ok: false, error: "Especialidad no disponible." } };
      if (!spec.branches.includes(p.branch)) {
        return { status: 400, body: { ok: false, error: "Esta especialidad no atiende en esa sede." } };
      }
      specialtyName = spec.name;
    } else {
      // general / rayos / eco: doctor + franja exacta
      if (!p.doctorId) return { status: 400, body: { ok: false, error: "Elige un doctor." } };
      if (p.startMinute === undefined || p.startMinute === null) {
        return { status: 400, body: { ok: false, error: "Elige la hora de tu cita." } };
      }
      if (p.startMinute % durationMinutes !== 0) {
        return { status: 400, body: { ok: false, error: "Hora no coincide con la agenda del doctor." } };
      }
      const doctors = await db.listDoctors(p.branch, null);
      const doctor = doctors.find((d) => d.id === p.doctorId && d.active) ?? null;
      if (!doctor) return { status: 400, body: { ok: false, error: "Doctor no disponible en esta sede." } };
      if (p.serviceType === "general" && doctor.kind !== "general") {
        return { status: 400, body: { ok: false, error: "Este doctor no atiende consultas generales." } };
      }
      doctorName = doctor.fullName;

      // rayos/eco: SIEMPRE requieren orden médica sellada
      if ((p.serviceType === "rayos" || p.serviceType === "eco") && !p.hasOrder) {
        return {
          status: 400,
          body: { ok: false, error: "Las radiografías/ecografías requieren orden médica con sello. Primero pasa por una consulta general." },
        };
      }

      // Slot libre: mismo cálculo que la disponibilidad (horario, ocupadas, ausencias, pasado)
      const busy = await db.listApptsForDoctor(p.doctorId, (p.date ?? "") as string);
      const timeOff = (await db.listTimeOff(null, (p.date ?? "") as string, (p.date ?? "") as string))
        .filter((t) => t.doctorId === p.doctorId);
      const minStart = p.date === today ? currentMinuteLima(now) + 30 : 0;
      const slots = computeFreeSlots({
        durationMinutes,
        weekday: weekdayOf((p.date ?? today) as string),
        schedules: await db.listDoctorSchedules(p.doctorId),
        busy,
        timeOffBlocks: timeOff,
        minStartMinute: minStart,
      });
      const okSlot = slots.some((s) => s.startMinute === p.startMinute);
      if (!okSlot) {
        return { status: 409, body: { ok: false, error: "Ese horario ya no está disponible. Elige otro." } };
      }
    }
  } catch {
    return { status: 500, body: { ok: false, error: "Error inesperado del servidor." } };
  }

  const nowMs = now.getTime();
  const deduped = findDedupe(p, nowMs);
  if (deduped) return { status: 200, body: { ok: true, appointmentCode: deduped } };

  // Insert con reintentos por unicidad del código
  let inserted = false;
  let code = "";
  let newApptId: string | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    code = randomCode();
    try {
      const row = await db.insertAppointment({
        appointmentCode: code,
        branch: p.branch,
        serviceType: p.serviceType,
        specialtyId: p.serviceType === "especializada" ? p.specialtyId ?? null : null,
        doctorId: p.serviceType === "especializada" ? null : p.doctorId ?? null,
        apptDate: p.serviceType === "especializada" ? null : (p.date ?? null),
        startMinute: p.serviceType === "especializada" ? null : (p.startMinute ?? null),
        durationMinutes: p.serviceType === "especializada" ? 0 : durationMinutes,
        needsOrder: p.serviceType === "rayos" || p.serviceType === "eco",
        hasOrder: p.serviceType === "rayos" || p.serviceType === "eco" ? Boolean(p.hasOrder) : null,
        status: p.serviceType === "especializada" ? "solicitud" : "confirmada",
        petName: p.petName,
        petType: p.petType,
        petNotes: p.petNotes,
        ownerName: p.ownerName,
        ownerPhone: p.ownerPhone,
        ownerEmail: p.ownerEmail,
        paymentNotes: "-",
        createdByClient: true,
        createdBy: "-",
      });
      inserted = row.code === null;
      newApptId = row.id;
      if (row.code === "23505") {
        console.warn(`[medical/create] código ${code} colisionó, reintentando`);
      }
    } catch (err) {
      console.error(`[medical/create] insert falló: ${err instanceof Error ? err.message : err}`);
      return { status: 500, body: { ok: false, error: "No pudimos registrar tu cita. Intenta de nuevo." } };
    }
  }
  if (!inserted) {
    return { status: 500, body: { ok: false, error: "No pudimos registrar tu cita. Intenta de nuevo." } };
  }

  // Timeline inicial
  try {
    if (newApptId) {
      await db.recordApptStatus(
        newApptId,
        p.serviceType === "especializada" ? "solicitud" : "confirmada",
        "sistema",
      );
    }
  } catch {
    /* timeline best-effort */
  }

  // WhatsApps: alerta al counter + mensaje al cliente (best-effort)
  const env = process.env as BookingEnv;
  const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
  const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";

  const counterAlert = buildCounterAlert(p, code, {
    serviceLabel: p.serviceType === "especializada" ? "🎓 SOLICITUD ESPECIALIZADA (pago pendiente)" : null,
    specialty: specialtyName,
    doctor: doctorName,
    time: p.startMinute !== null && p.startMinute !== undefined ? minuteToTime(p.startMinute) : null,
  });
  if ((evoReady || dryRun) && normalizePhoneDest(env.WHATSAPP_DESTINO ?? "")) {
    await sendViaEvolution([counterAlert], env, fetch);
  }

  const clientMsg = buildClientApptMessage(
    p,
    code,
    { specialty: specialtyName, doctor: doctorName, time: p.startMinute !== null && p.startMinute !== undefined ? minuteToTime(p.startMinute) : null },
    config.payment_info,
  );
  const clientDest = normalizePhoneDest(p.ownerPhone);
  if ((evoReady || dryRun) && clientDest) {
    await sendViaEvolution([clientMsg], env, fetch, clientDest);
  }

  rememberDedupe(p, code, nowMs);
  return { status: 200, body: { ok: true, appointmentCode: code } };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" && forwarded.length > 0 ? forwarded.split(",")[0].trim() : "direct";
  if (rateLimited(ip, Date.now())) {
    res.status(429).json({ ok: false, error: "Demasiados envíos. Espera un minuto." });
    return;
  }
  try {
    const result = await handleMedicalCreate({ body: req.body });
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
