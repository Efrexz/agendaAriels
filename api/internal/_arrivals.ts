import { z } from "zod/v4";
import { getLimaDayKey } from "../lib-lima.js";
import { getMedicalDb, notConfigured, staffGuard } from "../medical/_shared.js";
import { getLabDb } from "../lab/_shared.js";
import { SupabaseBookingDb } from "../db.js";

// GET /api/internal/arrivals  (solo staff)
// Pendientes ACCIONABLES para la campana del navbar (feedback 18/11 del dueño:
// el panel queda abierto en el mostrador y la campana avisa lo que falta):
//  • grooming: reservas de HOY (Lima) pendientes/en camino (aún no recibidas)
//  • consultas: citas en 'solicitud' (por confirmar fecha/hora)
//  • lab: órdenes en 'solicitada' (por verificar orden + coordinar toma)
// Solo conteos (sin datos de dueños) — el detalle vive en cada pestaña.

export const maxDuration = 10;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const SCHEMA = z.object({}).passthrough();
void SCHEMA;

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  try {
    const today = getLimaDayKey();
    let grooming = 0;
    let consultas = 0;
    let lab = 0;

    // Grooming de HOY que esperan (pendiente / en camino de recojo).
    const bookingDb = SupabaseBookingDb.fromEnv(process.env);
    if (bookingDb) {
      const { count } = await bookingDb["client"]
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("service_date", today)
        .in("status", ["pendiente", "en_camino_recojo"]);
      grooming = count ?? 0;
    }

    const medicalDb = getMedicalDb();
    if (medicalDb) {
      const { count } = await medicalDb["client"]
        .from("medical_appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "solicitud");
      consultas = count ?? 0;
    }

    const labDb = getLabDb();
    if (labDb) {
      const { count } = await labDb["client"]
        .from("lab_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "solicitada");
      lab = count ?? 0;
    }

    res.status(200).json({ ok: true, grooming, consultas, lab, total: grooming + consultas + lab });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
