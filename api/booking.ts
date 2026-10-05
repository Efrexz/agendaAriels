import { handleBooking, type BookingEnv } from "./_lib";

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
