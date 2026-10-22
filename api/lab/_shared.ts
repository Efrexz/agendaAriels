import { LabDb } from "./db.js";
import { bearerFrom, type StaffUser, verifyStaff } from "../internal/_verify.js";

// Núcleo compartido de los endpoints /api/internal/lab/* y /api/lab-status.
// (Los archivos con prefijo _ no se exponen como rutas en Vercel.)

let cachedDb: LabDb | null | undefined;

export function getLabDb(): LabDb | null {
  if (cachedDb === undefined) {
    cachedDb = LabDb.fromEnv(process.env);
    if (!cachedDb) console.warn("[lab] Supabase no configurado");
  }
  return cachedDb;
}

export function notConfigured(res: { status(n: number): { json(p: unknown): unknown } }): boolean {
  if (!getLabDb()) {
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

export const LAB_BRANCHES = ["san_martin", "los_olivos", "san_miguel"] as const;
export type LabBranch = (typeof LAB_BRANCHES)[number];

export function isLabBranch(v: string): v is LabBranch {
  return (LAB_BRANCHES as readonly string[]).includes(v);
}

// Réplica de BRANCH_LABELS (el lab no depende del módulo médico).
export const LAB_BRANCH_LABELS: Record<string, string> = {
  san_martin: "Sede San Martín de Porres",
  los_olivos: "Sede Los Olivos",
  san_miguel: "Sede San Miguel",
};

export const LAB_BRANCH_PHONES: Record<string, string> = {
  san_martin: "+51 986 985 047",
  los_olivos: "+51 932 719 342",
  san_miguel: "+51 954 599 221",
};

// Teléfonos en BD formateados con guiones (consistencia con grooming/médico,
// ver api/medical/_create.ts formatPhoneForDb: "917-104-426").
export function formatPhoneForDb(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^51/, "").slice(-9);
  return digits.length === 9
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : phone;
}
