import { MedicalDb } from "./db.js";
import { bearerFrom, type StaffUser, verifyStaff } from "../internal/_verify.js";

// Núcleo compartido de los endpoints /api/medical/*.
// (Los archivos con prefijo _ no se exponen como rutas en Vercel.)

let cachedDb: MedicalDb | null | undefined;

export function getMedicalDb(): MedicalDb | null {
  if (cachedDb === undefined) {
    cachedDb = MedicalDb.fromEnv(process.env);
    if (!cachedDb) console.warn("[medical] Supabase no configurado");
  }
  return cachedDb;
}

export function notConfigured(res: { status(n: number): { json(p: unknown): unknown } }): boolean {
  if (!getMedicalDb()) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return true;
  }
  return false;
}

export async function staffGuard(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status(n: number): { json(p: unknown): unknown } },
): Promise<StaffUser | null> {
  const staff = await verifyStaff(bearerFrom(req.headers));
  if (!staff) {
    res.status(401).json({ ok: false, error: "Sesión no válida. Ingresa al panel de nuevo." });
    return null;
  }
  return staff;
}

// Teléfonos de contacto por sede (réplica lo del wizard: src/data/branches.ts).
export const BRANCH_PHONES: Record<string, string> = {
  san_martin: "+51 986 985 047",
  los_olivos: "+51 932 719 342",
  san_miguel: "+51 954 599 221",
};

export const BRANCH_LABELS: Record<string, string> = {
  san_martin: "Sede San Martín de Porres",
  los_olivos: "Sede Los Olivos",
  san_miguel: "Sede San Miguel",
};
