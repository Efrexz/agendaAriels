// Horarios demo COMPLETOS para los doctores especialista FICTICIOS (demo pre go-live):
// lunes a sábado, mañana 9:00-13:00 y tarde 15:00-19:00. Domingo fuera.
// Solo toca doctores ficticios (email *.local) — los reales del dueño no se tocan.
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

// 1) Solo doctores FICTICIOS (email .local), activos, especialistas de demo
const demo = await q("medical_doctors?kind=eq.especialista&active=eq.true&email=like.*.local&select=id,full_name,branch,email");
if (!demo.length) throw new Error("no hay doctores demo (.local) — nada que tocar");
console.log(`doctores demo: ${demo.length}`);

// 2) Borrar TODOS sus horarios (son 100% ficticios) e insertar el horario completo
const ids = demo.map(d => d.id);
await q(`medical_schedules?doctor_id=in.(${ids.join(",")})`, { method: "DELETE", headers: H });

const scheds = [];
for (const d of demo)
  for (const weekday of [1, 2, 3, 4, 5, 6]) // lun-sáb (domingo 0 fuera)
    for (const [s, e] of [[540, 780], [900, 1140]]) // mañana 9-13 · tarde 15-19
      scheds.push({ doctor_id: d.id, weekday, start_minute: s, end_minute: e });

for (let i = 0; i < scheds.length; i += 100) {
  await q("medical_schedules", { method: "POST", headers: H, body: JSON.stringify(scheds.slice(i, i + 100)) });
}
console.log(`horarios insertados: ${scheds.length} (${demo.length} doctores × 6 días × 2 bloques)`);

// 3) Verificación POST: filas por doctor + domingo en cero
const after = await q(`medical_schedules?doctor_id=in.(${ids.join(",")})&select=doctor_id,weekday,start_minute`);
const byDow = {};
for (const r of after) byDow[r.weekday] = (byDow[r.weekday] ?? 0) + 1;
console.log("filas por día (0=domingo … 6=sábado):", JSON.stringify(byDow));
if (byDow[0]) throw new Error("HAY horarios en domingo — revisar");
if (after.length !== demo.length * 12) throw new Error(`conteo inesperado: ${after.length}`);
console.log("verificación OK: sin domingo, 2 bloques por día");
