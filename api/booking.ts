import { z } from "zod/v4";
import { addDays, format } from "date-fns";

// ─────────────────────────────────────────────────────────────
// Módulo compartido interno de la función api/booking.ts.
// Auto-contenido a propósito: Vercel solo incluye en el bundle
// lo que vive dentro de api/. La fuente de verdad de sedes y
// constantes es src/data/branches.ts (mantener en sincronía).
// ─────────────────────────────────────────────────────────────

const MAX_PICKUP_DISTANCE_KM = 2;
const MAX_ADVANCE_DAYS = 14;
const DISTANCE_TOLERANCE_KM = 0.02;
const EVOLUTION_RETRIES = 3;
const ATTEMPT_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [400, 1200];
const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";

const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  san_martin: { lat: -12.0206241, lng: -77.0865714 },
  los_olivos: { lat: -12.0085609, lng: -77.0710131 },
  san_miguel: { lat: -12.0774344, lng: -77.0934137 },
};

const SLOT_START_HOUR: Record<string, number> = { "9-11": 9, "11-14": 11 };

export interface BookingEnv {
  EVOLUTION_API_URL?: string;
  EVOLUTION_API_KEY?: string;
  EVOLUTION_INSTANCE?: string;
  WHATSAPP_DESTINO?: string;
  BACKUP_WEBHOOK_URL?: string;
  VITE_N8N_WEBHOOK_URL?: string;
}

export interface BookingResult {
  status: number;
  body: { ok: boolean; error?: string; bookingCode?: string };
}

// ── Tiempo Lima ──────────────────────────────────────────────

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  hour: "2-digit",
  hourCycle: "h23",
});

function getLimaDayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

function getLimaHour(date: Date = new Date()): number {
  return Number(hourFormatter.format(date));
}

function limaToday(date: Date = new Date()): Date {
  const [y, m, d] = getLimaDayKey(date).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Geo ──────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(hav));
}

// ── Contrato del payload ─────────────────────────────────────

const petSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.string().min(1).max(30),
  service: z.string().min(1).max(40),
  size: z.string().min(1).max(30),
  bathType: z.string().min(1).max(60),
  corteType: z.string().max(80).default("-"),
  corteSpecs: z.string().max(300).default("-"),
  extras: z.array(z.string().max(150)).max(6).default([]),
  perfume: z.string().max(60).default("-"),
  notes: z.string().max(400).default("-"),
  corteImage: z
    .string()
    .max(400)
    .nullable()
    .refine((v) => v === null || v.startsWith(CLOUDINARY_PREFIX), {
      message: "URL de imagen inválida",
    }),
});

export const bookingPayloadSchema = z.object({
  bookingCode: z.string().regex(/^VA-[A-Z0-9]{5}$/),
  submittedAt: z.string().min(1).max(48),
  branch: z
    .string()
    .min(1)
    .max(40)
    .refine((v) => !!BRANCH_COORDS[v], { message: "Sede desconocida" }),
  branchLabel: z.string().min(1).max(80),
  branchPhone: z.string().max(40),
  pets: z.array(petSchema).min(1).max(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateLabel: z.string().min(1).max(80),
  timeRange: z.enum(["9-11", "11-14"]),
  timeRangeLabel: z.string().min(1).max(40),
  ownerName: z.string().min(1).max(80),
  ownerDni: z.string().max(24).default("-"),
  ownerPhone: z.string().min(3).max(24),
  ownerAddress: z.string().min(1).max(200),
  ownerLat: z.number().min(-90).max(90).nullable(),
  ownerLng: z.number().min(-180).max(180).nullable(),
  mapsUrl: z.string().max(300).nullable().optional(),
  hasHistory: z.boolean().nullable(),
  registeredPetName: z.string().max(80).default("-"),
  registeredPhone: z.string().max(24).default("-"),
  petBirthDate: z.string().max(16).default("-"),
  petSpecies: z.string().max(30).default("-"),
  petBreed: z.string().max(80).default("-"),
  petCastrated: z.boolean().default(false),
  mobilityPhoneDifferent: z.boolean().default(false),
  mobilityPhone: z.string().max(24).default("-"),
  ownerEmail: z
    .string()
    .max(120)
    .default("-")
    .refine((v) => v === "-" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Email inválido",
    }),
});

export type BookingPayload = z.infer<typeof bookingPayloadSchema>;

// ── Validaciones de negocio ──────────────────────────────────

export function validateScheduleWindow(
  date: string,
  timeRange: string,
  now: Date = new Date(),
): string | null {
  const todayKey = getLimaDayKey(now);
  if (date < todayKey) return "La fecha de reserva ya pasó.";
  const maxDayKey = format(addDays(limaToday(now), MAX_ADVANCE_DAYS), "yyyy-MM-dd");
  if (date > maxDayKey) return "La fecha supera el máximo de 14 días de anticipación.";
  if (date === todayKey && getLimaHour(now) >= (SLOT_START_HOUR[timeRange] ?? 0)) {
    return "La franja horaria de hoy ya inició.";
  }
  return null;
}

function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// ── Plantilla del mensaje WhatsApp (réplica del flujo n8n) ───

function section(label: string, lines: string[]): string {
  return `*${label}*\n\n${lines.join("\n")}`;
}

export function buildBookingMessages(data: BookingPayload): string[] {
  const clientLines: string[] = [
    `Nombre: ${data.ownerName}`,
    `Celular: ${data.ownerPhone}`,
  ];
  if (data.mobilityPhoneDifferent && data.mobilityPhone && data.mobilityPhone !== "-") {
    clientLines.push(`Celular alterno: ${data.mobilityPhone}`);
  }
  if (data.ownerDni && data.ownerDni !== "-") {
    clientLines.push(`DNI: ${data.ownerDni}`);
  }
  if (data.ownerAddress && data.ownerAddress !== "-") {
    clientLines.push(`Dirección: ${data.ownerAddress}`);
  }

  const petBlocks = data.pets.map((pet, i) => {
    const lines: string[] = [
      `Tipo: ${pet.type}`,
      `Servicio: ${pet.service}`,
      `Tamaño: ${pet.size}`,
      `Baño: ${pet.bathType}`,
    ];
    if (pet.corteType && pet.corteType !== "-") {
      lines.push("", "Corte:", pet.corteType);
    }
    if (pet.corteSpecs && pet.corteSpecs !== "-") {
      lines.push("", `Indicaciones: ${pet.corteSpecs}`);
    }
    if (pet.corteImage) {
      lines.push("", "📷 Foto de referencia:", pet.corteImage);
    }
    if (pet.extras.length > 0) {
      lines.push("", "Extras:", ...pet.extras.map((e) => `• ${e}`));
    }
    if (pet.perfume && pet.perfume !== "-") {
      lines.push(`Perfume: ${pet.perfume}`);
    }
    if (pet.notes && pet.notes !== "-") {
      lines.push("", `Observaciones: ${pet.notes}`);
    }
    return `*${i + 1}. ${pet.name.toUpperCase()}*\n\n${lines.join("\n")}`;
  });

  const blocks: string[] = [
    `*NUEVA RESERVA*`,
    `Código: ${data.bookingCode}`,
    data.branchLabel,
    "━━━━━━━━━━━━━━━━━━",
    section("CLIENTE", clientLines),
    "━━━━━━━━━━━━━━━━━━",
    section("RECOJO", [`Fecha: ${data.dateLabel}`, `Rango horario: ${data.timeRangeLabel}`]),
    "━━━━━━━━━━━━━━━━━━",
    "*MASCOTAS*",
    ...petBlocks,
  ];

  if (data.hasHistory === false) {
    blocks.push(
      "━━━━━━━━━━━━━━━━━━",
      section("REGISTRO NUEVO", [
        `Mascota: ${data.registeredPetName}`,
        `Nacimiento: ${data.petBirthDate}`,
        `Especie: ${data.petSpecies}`,
        `Raza: ${data.petBreed}`,
        `Castrado: ${data.petCastrated ? "Sí" : "No"}`,
        `Correo: ${data.ownerEmail}`,
      ]),
    );
  }

  const messages = [blocks.join("\n")];

  if (data.ownerLat !== null && data.ownerLng !== null) {
    messages.push(`📍 Ubicación en Google Maps:\n${buildMapsUrl(data.ownerLat, data.ownerLng)}`);
  }

  return messages;
}

// ── Entrega ──────────────────────────────────────────────────

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<Response>;

export type Fetcher = FetchLike;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function sendViaEvolution(
  messages: string[],
  env: BookingEnv,
  fetcher: FetchLike = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${env.EVOLUTION_API_URL!.replace(/\/+$/, "")}/message/sendText/${env.EVOLUTION_INSTANCE}`;
  const headers = { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY! };

  for (const text of messages) {
    let lastStatus = 0;
    let sent = false;
    for (let attempt = 0; attempt < EVOLUTION_RETRIES && !sent; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
      try {
        const res = await fetcher(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ number: env.WHATSAPP_DESTINO, text, delay: 1200 }),
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        });
        lastStatus = res.status;
        sent = res.ok;
      } catch {
        sent = false;
      }
    }
    if (!sent) {
      return {
        ok: false,
        error: `No se pudo entregar la reserva al WhatsApp de la veterinaria (código ${lastStatus || "sin respuesta"}).`,
      };
    }
  }
  return { ok: true };
}

export async function sendToBackupWebhook(
  payload: BookingPayload,
  delivered: boolean,
  env: BookingEnv,
  fetcher: FetchLike = fetch,
): Promise<void> {
  if (!env.BACKUP_WEBHOOK_URL) return;
  try {
    await fetcher(env.BACKUP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, whatsappDelivered: delivered }),
    });
  } catch {
    /* el respaldo nunca rompe el flujo principal */
  }
}

export async function handleBooking(options: {
  body: unknown;
  env: BookingEnv;
  now?: Date;
  fetcher?: FetchLike;
}): Promise<BookingResult> {
  const { body, env, now = new Date() } = options;
  const fetcher = options.fetcher ?? fetch;

  const parsed = bookingPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { ok: false, error: "Datos de reserva inválidos o incompletos." },
    };
  }
  const payload = parsed.data;

  const scheduleError = validateScheduleWindow(payload.date, payload.timeRange, now);
  if (scheduleError) {
    return { status: 400, body: { ok: false, error: scheduleError } };
  }

  if (payload.ownerLat === null || payload.ownerLng === null) {
    return { status: 400, body: { ok: false, error: "Falta la dirección en el mapa." } };
  }

  const branchCoords = BRANCH_COORDS[payload.branch];
  if (!branchCoords) {
    return { status: 400, body: { ok: false, error: "Sede desconocida." } };
  }
  const distanceKm = haversineKm(branchCoords, { lat: payload.ownerLat, lng: payload.ownerLng });
  if (distanceKm > MAX_PICKUP_DISTANCE_KM + DISTANCE_TOLERANCE_KM) {
    return { status: 400, body: { ok: false, error: "Dirección fuera del radio de cobertura." } };
  }

  const normalized: BookingPayload = {
    ...payload,
    mapsUrl: buildMapsUrl(payload.ownerLat, payload.ownerLng),
  };
  const messages = buildBookingMessages(normalized);

  const evolutionReady = !!(
    env.EVOLUTION_API_URL &&
    env.EVOLUTION_API_KEY &&
    env.EVOLUTION_INSTANCE &&
    env.WHATSAPP_DESTINO
  );
  let delivered = false;
  let error: string | undefined;

  if (evolutionReady) {
    const sent = await sendViaEvolution(messages, env, fetcher);
    delivered = sent.ok;
    if (!sent.ok) error = sent.error;
  } else if (env.VITE_N8N_WEBHOOK_URL) {
    try {
      const res = await fetcher(env.VITE_N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      delivered = res.ok;
      if (!res.ok) error = `No se pudo entregar la reserva al WhatsApp de la veterinaria (${res.status}).`;
    } catch {
      error = "No se pudo contactar a la veterinaria. Revisa tu conexión e intenta de nuevo.";
    }
  } else {
    return {
      status: 500,
      body: {
        ok: false,
        error: "El servidor no tiene la configuración de notificaciones. Contacta a la veterinaria.",
      },
    };
  }

  await sendToBackupWebhook(normalized, delivered, env, fetcher);

  if (!delivered) {
    return {
      status: 502,
      body: { ok: false, error: error ?? "No se pudo entregar la reserva. Intenta de nuevo." },
    };
  }

  return { status: 200, body: { ok: true, bookingCode: payload.bookingCode } };
}

// ── Handler (ruta /api/booking) ──

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const MAX_OVERFLOW_ENTRIES = 500;

class RateBucket {
  private hits = new Map<string, number[]>();

  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - WINDOW_MS;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (this.hits.size > MAX_OVERFLOW_ENTRIES) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => t <= cutoff)) this.hits.delete(k);
      }
      if (this.hits.size > MAX_OVERFLOW_ENTRIES) this.hits.clear();
    }

    if (existing.length >= MAX_PER_WINDOW) {
      this.hits.set(key, existing);
      return false;
    }
    existing.push(now);
    this.hits.set(key, existing);
    return true;
  }
}

const bucket = new RateBucket();

export const maxDuration = 30;

function clientIp(req: Req): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return "direct";
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  if (!bucket.allow(clientIp(req))) {
    res.status(429).json({ ok: false, error: "Demasiados envíos desde tu conexión. Espera un minuto e intenta de nuevo." });
    return;
  }

  try {
    const result = await handleBooking({
      body: req.body,
      env: process.env as BookingEnv,
    });
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
