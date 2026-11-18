// Seeding de doctores especialista REALES (feedback 18/11 del dueño).
// Reemplaza a los ficticios (desactivados, no borrados: las citas QA que los
// referencian quedan coherentes — misma "baja" que hace ⚙ Config). Los
// externos NO llevan horarios (el asignador de especializadas usa hora manual).
// Idempotente: se puede correr varias veces sin duplicar.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter(Boolean).filter(l => /^[A-Z_]+=/.test(l)).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  }));
const SUPA = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const q = async (url, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${url}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
};

// Directorio real (feedback 18/11). Sedes: san_martin=SMP, san_miguel=SM, los_olivos=LO.
// Fisioterapia QUEDA FUERA por decisión del dueño (se agregará más adelante).
const REAL = [
  { name: "Cardiología",   cost: 350, branches: ["san_miguel", "san_martin", "los_olivos"], doctors: ["Dr. Isaac Pérez"] },
  { name: "Dermatología",  cost: 240, branches: ["san_miguel", "san_martin", "los_olivos"], doctors: ["Dr. Renzo Limas"] },
  { name: "Oftalmología",  cost: 220, branches: ["san_miguel"], doctors: ["Dra. Roxana Padilla"] },
  { name: "Neurología",    cost: 150, branches: ["san_miguel", "san_martin", "los_olivos"], doctors: ["Dr. Alejandro Goyzueta"] },
  { name: "Traumatología", cost: 180, branches: ["san_miguel", "san_martin", "los_olivos"], doctors: ["Dr. Juan Carlos Hernandez"] },
  { name: "Nutrición",     cost: 140, branches: ["san_miguel", "san_martin", "los_olivos"], doctors: ["Dra. Katherine Gonzales"] },
  { name: "Etología",      cost: 150, branches: ["san_miguel"], doctors: ["Dra. Nadya Barriga"] },
  { name: "Oncología",     cost: 250, branches: ["san_miguel", "san_martin"], doctors: ["Dr. Ken Candela"] },
  { name: "Neumología",    cost: 250, branches: ["san_miguel"], doctors: ["Dra. Nugent"] },
  { name: "Odontología",   cost: 250, branches: ["san_miguel", "san_martin"], doctors: ["Dr. Jorge Jun"] },
];

// ── PRE ──
const specs = await q("medical_specialties?select=id,name,cost,branches");
console.log(`PRE ✓ ${specs.length} especialidades actuales`);

// Corrección previa: la antigua "Oncologia" (sin tilde) debe renombrarse
// ANTES de crear "Oncología" (UNIQUE por nombre). Si ambas ya existen, la
// antigua se esconde (sedes vacías — nunca aparece en el wizard).
const oldOnc = specs.find((s) => s.name === "Oncologia");
if (oldOnc) {
  if (specs.some((s) => s.name === "Oncología")) {
    await q(`medical_specialties?id=eq.${oldOnc.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ name: "Oncologia (antigua)", branches: [] }) });
    console.log("  ↻ 'Oncologia' antigua escondida (sedes vacías); la correcta es 'Oncología'");
  } else {
    await q(`medical_specialties?id=eq.${oldOnc.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ name: "Oncología" }) });
    console.log("  ↻ 'Oncologia' → 'Oncología'");
  }
}

// ── 1. Especialidades: crear las que falten ──
const byName = new Map(specs.map((s) => [s.name, s]));
for (const spec of REAL) {
  const existing = byName.get(spec.name);
  if (existing) {
    // Actualiza costo + sedes (idempotente, solo si difiere).
    const sameCost = Number(existing.cost) === spec.cost;
    const sameBranches = JSON.stringify([...(existing.branches ?? [])].sort()) === JSON.stringify([...spec.branches].sort());
    if (!sameCost || !sameBranches) {
      await q(`medical_specialties?id=eq.${existing.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ cost: spec.cost, branches: spec.branches }) });
      console.log(`  ↻ ${spec.name}: cost ${existing.cost}→${spec.cost}, sedes actualizadas`);
    } else console.log(`  ✓ ${spec.name} ya coincide`);
  } else {
    await q("medical_specialties", { method: "POST", headers: H, body: JSON.stringify({ name: spec.name, cost: spec.cost, branches: spec.branches }) });
    console.log(`  + ${spec.name} creada (S/ ${spec.cost})`);
  }
}

// Corrección de nombre (era "Oncologia" sin tilde).
const onc = (await q("medical_specialties?name=eq.Oncologia&select=id,name")) ?? [];
for (const s of onc) {
  await q(`medical_specialties?id=eq.${s.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ name: "Oncología" }) });
  console.log("  ↻ 'Oncologia' → 'Oncología'");
}

// ── 2. Especialidades frescas (con los ids de las nuevas) ──
const specsFresh = await q("medical_specialties?select=id,name,cost,branches");
const specId = new Map(specsFresh.map((s) => [s.name, s.id]));

// ── 3. Desactivar ficticios + borrar sus horarios demo ──
const ficticios = await q("medical_doctors?email=like.*.demo@veterinaria-ariel.local&active=eq.true&select=id,full_name");
if (ficticios.length > 0) {
  const ids = ficticios.map((d) => d.id);
  await q(`medical_schedules?doctor_id=in.(${ids.join(",")})`, { method: "DELETE", headers: H });
  await q(`medical_doctors?email=like.*.demo@veterinaria-ariel.local&active=eq.true`, { method: "PATCH", headers: H, body: JSON.stringify({ active: false }) });
  console.log(`ficticios desactivados: ${ficticios.length} (+ horarios demo borrados)`);
} else console.log("ficticios: ya estaban desactivados");

// ── 4. Doctores reales (una fila por especialidad × sede) ──
const doctorsExisting = await q("medical_doctors?kind=eq.especialista&select=full_name,branch,active");
const have = new Set(doctorsExisting.filter((d) => d.active).map((x) => `${x.full_name}|${x.branch}`));
const slug = (name) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, "").slice(0, 24);
const rows = [];
for (const spec of REAL) {
  const specialId = specId.get(spec.name);
  if (!specialId) throw new Error(`Especialidad ${spec.name} no encontrada tras el insert`);
  for (const branch of spec.branches) {
    for (const full of spec.doctors) {
      if (have.has(`${full}|${branch}`)) continue;
      rows.push({
        full_name: full, branch, kind: "especialista", specialty_id: specialId,
        email: `${slug(full)}@veterinaria-ariel.local`,
        phone: "999000000", active: true,
      });
    }
  }
}
if (rows.length > 0) {
  await q("medical_doctors", { method: "POST", headers: H, body: JSON.stringify(rows) });
  console.log(`doctores reales creados: ${rows.length}`);
} else console.log("doctores reales: ya existían todos");

// ── POST ──
const finalSpecs = await q("medical_specialties?select=name,cost,branches&order=name");const finalDocs = await q("medical_doctors?kind=eq.especialista&active=eq.true&select=full_name,branch,specialty_id,email");
const specNameById = new Map((await q("medical_specialties?select=id,name")).map((s) => [s.id, s.name]));
console.log("== POST: especialistas activos por sede ==");
for (const d of finalDocs) console.log(" ✓", d.branch.padEnd(11), d.full_name, `(${specNameById.get(d.specialty_id) ?? "?"})`);
const esperados = REAL.reduce((n, s) => n + s.branches.length * s.doctors.length, 0);
if (finalDocs.length !== esperados) throw new Error(`POST falló: esperados ${esperados} especialistas activos, hay ${finalDocs.length}`);
const faltantes = REAL.filter((s) => !finalSpecs.some((x) => x.name === s.name));
if (faltantes.length > 0) throw new Error(`POST falló: faltan especialidades ${faltantes.map((s) => s.name).join(", ")}`);
console.log(`POST ✓ ${finalDocs.length} especialistas activos, ${finalSpecs.length} especialidades ✓`);
console.log("Seeding de especialistas reales completo.");
