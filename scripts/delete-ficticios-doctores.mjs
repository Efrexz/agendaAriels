// Limpieza FINAL de doctores ficticios (acuerdo del dueño 18/11):
//  1. borra las citas médicas que referencian doctores de prueba (+ su timeline)
//  2. borra horarios/ausencias de los ficticios
//  3. borra las filas de doctores ficticios (email *.demo@veterinaria-ariel.local)
// Resultado: solo los 22 especialistas REALES. Idempotente.
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

// PRE: doctores ficticios presentes
const fict = await q("medical_doctors?email=like.*.demo@veterinaria-ariel.local&select=id,full_name,branch");
console.log(`PRE ✓ doctores ficticios presentes: ${fict.length}`);
if (fict.length === 0) {
  console.log("Nada por hacer: no quedan ficticios.");
  process.exit(0);
}
const ids = fict.map((d) => d.id);

// 1. Citas que los referencian (acuerdo del dueño: se ELIMINAN)
const citas = await q(`medical_appointments?doctor_id=in.(${ids.join(",")})&select=id,appointment_code,status,service_type`);
console.log(`citas con doctores de prueba: ${citas.length}`);
for (const c of citas) console.log(`   🗑 ${c.appointment_code} (${c.status}, ${c.service_type})`);
if (citas.length > 0) {
  const citaIds = citas.map((c) => c.id);
  await q(`medical_status_updates?appointment_id=in.(${citaIds.join(",")})`, { method: "DELETE", headers: H });
  const del = await q(`medical_appointments?id=in.(${citaIds.join(",")})`, { method: "DELETE", headers: H });
  console.log(`citas eliminadas ✓ (${Array.isArray(del) ? del.length : citaIds.length})`);
}

// 2. Horarios y ausencias de los ficticios
await q(`medical_schedules?doctor_id=in.(${ids.join(",")})`, { method: "DELETE", headers: H });
await q(`medical_time_off?doctor_id=in.(${ids.join(",")})`, { method: "DELETE", headers: H });
console.log("horarios/ausencias de ficticios borrados ✓");

// 3. Borrar las filas de doctores ficticios
const delDocs = await q(`medical_doctors?id=in.(${ids.join(",")})`, { method: "DELETE", headers: H });
console.log(`doctores ficticios eliminados: ${Array.isArray(delDocs) ? delDocs.length : ids.length}`);

// POST: solo reales
const quedan = await q("medical_doctors?email=like.*.demo@veterinaria-ariel.local&select=id");
if (quedan.length > 0) throw new Error(`POST falló: aún quedan ${quedan.length} ficticios`);
const activos = await q("medical_doctors?active=eq.true&kind=eq.especialista&select=full_name,branch");
console.log(`POST ✓ 0 ficticios · ${activos.length} especialistas activos (reales)`);
console.log("Limpieza completa.");
