import { BRANCH_LABELS, getMedicalDb, notConfigured } from "./_shared.js";

// GET /api/medical/doctors?sede=<id>[&kind=general|especialista]
// Doctores disponibles de una sede (público, para el wizard médico).
// Solo publica nombre, tipo y especialidad — nunca teléfonos personales.

export const maxDuration = 10;

interface Req {
  method?: string;
  url?: string;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
  setHeader(name: string, value: string): Res;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const branch = url.searchParams.get("sede") ?? "";
  if (!(branch in BRANCH_LABELS)) {
    res.status(400).json({ ok: false, error: "Sede inválida." });
    return;
  }
  const kind = url.searchParams.get("kind");
  const kindFilter = kind === "general" || kind === "especialista" ? kind : null;

  try {
    const db = getMedicalDb()!;
    const doctors = await db.listDoctors(branch, kindFilter);
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      ok: true,
      doctors: doctors
        .filter((d) => d.active)
        .map((d) => ({
          id: d.id,
          name: d.fullName,
          kind: d.kind,
          specialty: d.specialtyName,
        })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
