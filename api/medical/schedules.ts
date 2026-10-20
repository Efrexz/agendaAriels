import { z } from "zod/v4";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// Editor de horarios del个人 counter (solo staff):
// GET    /api/medical/schedules               → todos con doctor
// POST   /api/medical/schedules               → { doctorId, weekday, start, end }
// DELETE /api/medical/schedules?id=<uuid>     → quita un bloque

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

const POST_SCHEMA = z.object({
  doctorId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

export default async function handler(req: Req, res: Res) {
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const db = getMedicalDb()!;

  try {
    if (req.method === "GET") {
      const rows = await db.listAllSchedulesWithDoctors();
      res.status(200).json({ ok: true, schedules: rows });
      return;
    }

    if (req.method === "POST") {
      const parsed = POST_SCHEMA.safeParse(req.body);
      if (!parsed.success || parsed.data.endMinute <= parsed.data.startMinute) {
        res.status(400).json({ ok: false, error: "Bloque inválido." });
        return;
      }
      const { doctorId, weekday, startMinute, endMinute } = parsed.data;
      // El doctor debe existir (y de la sede del staff si la tiene asignada: v1 open)
      const doctors = await db.listDoctors(null, null);
      const doctor = doctors.find((d) => d.id === doctorId);
      if (!doctor) {
        res.status(400).json({ ok: false, error: "Doctor no encontrado." });
        return;
      }
      const created = await db.createSchedule(doctorId, weekday, startMinute, endMinute);
      if (created.code === "23505") {
        res.status(409).json({ ok: false, error: "Ya existe ese bloque de horario para ese doctor." });
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
      await db.deleteSchedule(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
