import { BRANCH_LABELS, getMedicalDb, notConfigured } from "./_shared.js";

// GET /api/medical/specialties?sede=<id>
// Especialidades ACTIVAS (público). Costo visible solo al elegirla en el wizard.

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

function isBranch(v: string): boolean {
  return v in BRANCH_LABELS;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const branch = url.searchParams.get("sede") ?? "";

  try {
    const db = getMedicalDb()!;
    let list = await db.listSpecialties(true);
    if (isBranch(branch)) {
      list = list.filter((s) => s.branches.includes(branch));
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({
      ok: true,
      specialties: list.map((s) => ({
        id: s.id,
        name: s.name,
        branches: s.branches,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
