import { z } from "zod/v4";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// Catálogo para el panel (solo staff): doctores + especialidades.
// GET  /api/medical/catalog  → { doctors, specialties }
// POST /api/medical/catalog  → crea doctor ('doctor') o especialidad ('specialty')
// PATCH /api/medical/catalog → edita (activo, costos, branches, nombre…)

export const maxDuration = 15;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const CREATE_DOCTOR = z.object({
  kind: z.literal("doctor"),
  fullName: z.string().trim().min(3).max(80),
  branch: z.enum(["san_martin", "los_olivos", "san_miguel"]),
  doctorKind: z.enum(["general", "especialista"]),
  specialtyId: z.string().uuid().nullable().optional(),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(24).optional(),
});

const CREATE_SPECIALTY = z.object({
  kind: z.literal("specialty"),
  name: z.string().trim().min(3).max(60),
  cost: z.number().min(0).max(100000),
  branches: z.array(z.enum(["san_martin", "los_olivos", "san_miguel"])).min(1),
});

const PATCH_BODY = z.union([
  z.object({
    kind: z.literal("doctor"),
    id: z.string().uuid(),
    fullName: z.string().trim().min(3).max(80).optional(),
    email: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(24).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("specialty"),
    id: z.string().uuid(),
    name: z.string().trim().min(3).max(60).optional(),
    cost: z.number().min(0).max(100000).optional(),
    branches: z.array(z.enum(["san_martin", "los_olivos", "san_miguel"])).min(1).optional(),
    active: z.boolean().optional(),
  }),
]);

export default async function handler(req: Req, res: Res) {
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const db = getMedicalDb()!;

  try {
    if (req.method === "GET") {
      const [doctors, specialties] = await Promise.all([
        db.listDoctors(null, null),
        db.listSpecialties(false),
      ]);
      res.status(200).json({ ok: true, doctors, specialties });
      return;
    }

    if (req.method === "POST") {
      const parsed = z.union([CREATE_DOCTOR, CREATE_SPECIALTY]).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: "Datos inválidos." });
        return;
      }
      if (parsed.data.kind === "doctor") {
        const d = parsed.data;
        // especialistas exigen especialidad; generales la descartan
        const specialtyId = d.doctorKind === "especialista" ? d.specialtyId ?? null : null;
        if (d.doctorKind === "especialista" && !specialtyId) {
          res.status(400).json({ ok: false, error: "El especialista necesita su especialidad." });
          return;
        }
        await db.createDoctor(d.fullName, d.branch, d.doctorKind, specialtyId, d.email ?? "-", d.phone ?? "-");
        res.status(200).json({ ok: true });
        return;
      }
      const s = parsed.data;
      const created = await db.createSpecialty(s.name, s.cost, s.branches);
      if (created.code === "23505") {
        res.status(409).json({ ok: false, error: "Ya existe esa especialidad." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "PATCH") {
      const parsed = PATCH_BODY.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: "Datos inválidos." });
        return;
      }
      if (parsed.data.kind === "doctor") {
        await db.updateDoctor(parsed.data.id, {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          active: parsed.data.active,
        });
      } else {
        await db.updateSpecialty(parsed.data.id, {
          name: parsed.data.name,
          cost: parsed.data.cost,
          branches: parsed.data.branches,
          active: parsed.data.active,
        });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
