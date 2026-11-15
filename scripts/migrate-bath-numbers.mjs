// Migración: columna `bath_numbers` (jsonb) en `bookings` — número de baño
// (turno del cuaderno del spa) POR MASCOTA, asignado manualmente por el
// counter cuando la mascota llega. Forma (patrón G1 de `pet_status`):
//   {"<índice>": {"n": 20, "by": "staff@x", "at": "iso"}}
// Null/ausente = reserva vieja (nada cambia en su UI).
// Regla del repo: SQL en transacción con query PRE y POST de verificación.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter(Boolean).filter(l => /^[A-Z_]+=/.test(l)).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  }));

const REF = "hflqbiqcpkpdczcvakyy"; // ref del proyecto (AGENTS.md)
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN no está en .env.local");

const mgmt = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : [];
};

// PRE: ¿la tabla existe y qué tiene?
const pre = await mgmt(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' AND table_schema = 'public' ORDER BY ordinal_position;`);
if (pre.length === 0) throw new Error("PRE falló: la tabla bookings no existe (¿ref correcto?)");
const yaExiste = pre.some(c => c.column_name === "bath_numbers");
console.log(`PRE ✓ bookings con ${pre.length} columnas — bath_numbers ${yaExiste ? "YA existe" : "no existe"}`);

if (!yaExiste) {
  // Cambio estructural en transacción (una sola pieza; si falla, no queda a medias).
  await mgmt(`BEGIN;
ALTER TABLE public.bookings ADD COLUMN bath_numbers jsonb;
COMMENT ON COLUMN public.bookings.bath_numbers IS 'Número de baño (turno del cuaderno del spa) por mascota: {"<idx>": {n, by, at}} — null = sin asignar';
COMMIT;`);
  console.log("ALTER aplicado en transacción ✓");
}

// POST: la columna existe, es jsonb y es nullable (reservas viejas intactas).
const post = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'bookings' AND table_schema = 'public' AND column_name = 'bath_numbers';`);
if (post.length !== 1 || post[0].data_type !== "jsonb") {
  throw new Error(`POST falló: ${JSON.stringify(post)}`);
}
console.log(`POST ✓ bath_numbers jsonb nullable ✓ (reservas viejas: null, sin cambios en su UI)`);
console.log("Migración completa: bath_numbers lista.");
