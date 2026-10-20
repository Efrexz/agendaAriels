// Tipos mínimos (equivalentes a @vercel/node sin dependencia extra):
interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  query: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
  setHeader(name: string, value: string): Res;
}

// Los handlers viven en "/api/_*.ts" con sus propios interfaces Req/Res
// (compatible con el runtime de vercel).
type Handler = (req: unknown, res: unknown) => Promise<void> | void;

// ─────────────────────────────────────────────────────────────
// ROUTER CATCH-ALL: una sola función serverless para TODA la API.
// ¿Por qué? El plan Hobby de Vercel permite máx. 12 funciones por
// deploy; consolidadas aquí estamos en 1 con margen para crecer.
// Los handlers viven en archivos con "_": /api/_xxxx.ts (no exponen rutas).
// ─────────────────────────────────────────────────────────────

import bookingHandler from "./_booking.js";
import statusHandler from "./_status.js";
import availabilityHandler from "./_availability.js";
import gDayHandler from "./internal/_day.js";
import gSearchHandler from "./internal/_search.js";
import gStatusHandler from "./internal/_status.js";
import gClosuresHandler from "./internal/_closures.js";
import mDoctorsHandler from "./medical/_doctors.js";
import mSpecialtiesHandler from "./medical/_specialties.js";
import mAvailabilityHandler from "./medical/_availability.js";
import mCreateHandler from "./medical/_create.js";
import mDayHandler from "./medical/_day.js";
import mSearchHandler from "./medical/_search.js";
import mStatusHandler from "./medical/_status.js";
import mAssignHandler from "./medical/_assign.js";
import mSchedulesHandler from "./medical/_schedules.js";
import mConfigHandler from "./medical/_config.js";
import mCatalogHandler from "./medical/_catalog.js";

export const maxDuration = 60;

interface RouteDef {
  handler: Handler;
}

const ROUTES: Record<string, RouteDef> = {
  // OJO: el catch-all api/[...path].ts recibe los segmentos DESPUÉS de /api/
  "POST /booking": { handler: bookingHandler as Handler },
  "GET /status": { handler: statusHandler as Handler },
  "GET /availability": { handler: availabilityHandler as Handler },

  "GET /internal/day": { handler: gDayHandler as Handler },
  "GET /internal/search": { handler: gSearchHandler as Handler },
  "POST /internal/status": { handler: gStatusHandler as Handler },
  "GET /internal/closures": { handler: gClosuresHandler as Handler },
  "POST /internal/closures": { handler: gClosuresHandler as Handler },
  "DELETE /internal/closures": { handler: gClosuresHandler as Handler },

  "GET /medical/doctors": { handler: mDoctorsHandler as Handler },
  "GET /medical/specialties": { handler: mSpecialtiesHandler as Handler },
  "GET /medical/availability": { handler: mAvailabilityHandler as Handler },
  "POST /medical/create": { handler: mCreateHandler as Handler },
  "GET /medical/day": { handler: mDayHandler as Handler },
  "GET /medical/search": { handler: mSearchHandler as Handler },
  "PATCH /medical/status": { handler: mStatusHandler as Handler },
  "POST /medical/assign": { handler: mAssignHandler as Handler },
  "GET /medical/schedules": { handler: mSchedulesHandler as Handler },
  "POST /medical/schedules": { handler: mSchedulesHandler as Handler },
  "DELETE /medical/schedules": { handler: mSchedulesHandler as Handler },
  "GET /medical/config": { handler: mConfigHandler as Handler },
  "PUT /medical/config": { handler: mConfigHandler as Handler },
  "GET /medical/catalog": { handler: mCatalogHandler as Handler },
  "POST /medical/catalog": { handler: mCatalogHandler as Handler },
  "PATCH /medical/catalog": { handler: mCatalogHandler as Handler },
};

export default async function handler(req: Req, res: Res) {
  // Ruta REAL: vercel.json reescribe /api/* aquí con ?apiPath=<ruta>
  const raw = req.query?.apiPath;
  const path = "/" + (Array.isArray(raw) ? raw.join("/") : (raw ?? ""));
  
  const route = ROUTES[`${req.method ?? "GET"} ${path}`];
  if (!route) {
    res.status(404).json({ ok: false, error: "Ruta no encontrada." });
    return;
  }

  // El catch-all recibe los bodies ya parseados por el runtime (req.body),
  // exactamente como las funciones individuales anteriores.
  await route.handler(req, res);
}
