// Seeding de doctores especialista FICTICIOS (demo/reemplazo pre go-live real).
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
const SPECIAL = [
  ["Dr. Adrián Nolasco", "722c10b7-7b6d-4ab2-a6b2-ff04dfd16f8b"],
  ["Dra. Claudia Uchiyama", "4c425b9a-357d-464c-a173-7a2ada5647db"],
  ["Dr. Bruno Ccahuana", "0be7a37a-66b2-4e0c-8a0e-7a1718dd9d35"],
  ["Dra. Fiorella Quiroz", "2be1ad0e-6ee2-4c9f-9e6c-eabc60aed6be"],
  ["Dr. Dennys Palomino", "cfe35c25-8ac1-4593-9ec0-794648c8279a"],
];
const BRANCHES = ["san_martin", "los_olivos", "san_miguel"];
const slug = (name) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g,"");
const existing = await q("medical_doctors?kind=eq.especialista&select=full_name,branch");
const have = new Set(existing.map(x => `${x.full_name}|${x.branch}`));
const rows = [];
for (const [full, specialId] of SPECIAL)
  for (const branch of BRANCHES)
    if (!have.has(`${full}|${branch}`)) rows.push({
      full_name: full, branch, kind: "especialista", specialty_id: specialId,
      email: `${slug(full).replace(/\./g, "")}.demo@veterinaria-ariel.local`,
      phone: "999000000", active: true,
    });
if (rows.length > 0) {
  await q("medical_doctors", { method: "POST", headers: H, body: JSON.stringify(rows) });
  console.log(`doctores creados: ${rows.length}`);
} else console.log("doctores: ya existían todos");
// Horarios ficticios (valederos para demo): Lunes 9-13 y Jueves 15-19 por sede
const doctors = await q("medical_doctors?kind=eq.especialista&active=eq.true&select=id,full_name,branch");
const scheds = [];
for (const d of doctors)
  for (const [weekday, s, e] of [[1, 540, 780], [4, 900, 1140]])
    scheds.push({ doctor_id: d.id, weekday, start_minute: s, end_minute: e });
// idempotente: borrar los horarios de demo y reinsertar (los reales del dueño se quedan)
const demoIds = doctors.map(d => d.id);
await q(`medical_schedules?doctor_id=in.(${demoIds.join(",")})&start_minute=in.(540,900)`, { method: "DELETE", headers: H });
await q("medical_schedules", { method: "POST", headers: H, body: JSON.stringify(scheds) });
console.log(`horarios creados: ${scheds.length} (2 por doctor)`);
// resumen:
const finalList = await q("medical_doctors?kind=eq.especialista&active=eq.true&select=full_name,branch");
for (const x of finalList) console.log(" ✓", x.branch.padEnd(11), x.full_name);
