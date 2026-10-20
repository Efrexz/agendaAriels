import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// GET /api/medical/search?q=<código|teléfono|nombre del dueño>
// Búsqueda de citas para el panel (solo staff). Código también acepta CM prefijo.

export const maxDuration = 15;

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    res.status(400).json({ ok: false, error: "Escribe al menos 3 caracteres." });
    return;
  }

  try {
    const db = getMedicalDb()!;
    const upper = q.toUpperCase();
    let results;

    if (/^CM-[A-Z0-9]{5}$/.test(upper)) {
      const one = await db.findApptByCode(upper);
      results = one ? [one] : [];
    } else {
      const digits = q.replace(/\D/g, "");
      if (digits.length >= 6) {
        results = await db.listApptsPatient(digits);
        if (results.length > 0) {
          res.status(200).json({ ok: true, results });
          return;
        }
      }
      // por nombre del dueño: usamos el mismo mecanismo con rango amplio
      results = await db.listApptsRange(null, "2000-01-01", "2999-12-31");
      results = results.filter(
        (a) => a.ownerName.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 20);
    }

    res.status(200).json({ ok: true, results });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
