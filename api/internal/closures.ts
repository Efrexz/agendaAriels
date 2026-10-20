import { z } from "zod/v4";
import { SupabaseBookingDb } from "../db";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify";

// ─────────────────────────────────────────────────────────────
// POST   /api/internal/closures  { branch, date, timeSlot|null, reason }
// DELETE /api/internal/closures?id=<uuid>
// Cierra/abre días o franjas por sede → calendario público "Ocupado".
// Requiere sesión del staff (JWT de Supabase Auth).
// ─────────────────────────────────────────────────────────────

const CREATE_SCHEMA = z.object({
  branch: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.enum(["9-11", "11-14"]).nullable(),
  reason: z.string().max(120).default(""),
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getLimaDayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

function toDate(from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + 30);
  return base.toISOString().slice(0, 10);
}

export const maxDuration = 15;

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

export default async function handler(req: Req, res: Res) {
  const staff = await verifyStaff(bearerFrom(req.headers));
  if (!staff) {
    unauthorized(res);
    return;
  }

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    if (req.method === "GET") {
      // Lista de cierres próximos (hoy → +30 días) para gestionarlos en el panel.
      const from = getLimaDayKey();
      const to = toDate(from);
      const closures = await db.listClosuresBetween(from, to);
      res.status(200).json({ ok: true, closures });
      return;
    }

    if (req.method === "POST") {
      const parsed = CREATE_SCHEMA.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: "Datos inválidos." });
        return;
      }
      const created = await db.createClosure({
        branch: parsed.data.branch,
        closureDate: parsed.data.date,
        timeSlot: parsed.data.timeSlot,
        reason: parsed.data.reason,
        createdBy: staff.email,
      });
      if (created.code === "23505") {
        res.status(409).json({ ok: false, error: "Ese día/franja ya está cerrado." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url ?? "/", "https://placeholder.local");
      const id = url.searchParams.get("id") ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        res.status(400).json({ ok: false, error: "Id inválido." });
        return;
      }
      await db.deleteClosure(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
