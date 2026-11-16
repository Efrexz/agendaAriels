// Migración: órdenes de rayos/eco subidas por el cliente (feedback 16/11).
// 1) Columna `order_path` (text) en medical_appointments — ruta del archivo
//    dentro del bucket privado; null = sin archivo.
// 2) Bucket privado `medical-orders` (Storage) — SOLO service_role: el
//    público jamás lee; el staff accede vía URL firmada efímera (900 s).
// Regla del repo: SQL en transacción con verificación PRE y POST.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter(Boolean).filter(l => /^[A-Z_]+=/.test(l)).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  }));

const REF = "hflqbiqcpkpdczcvakyy";
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!TOKEN || !SERVICE) throw new Error("Faltan SUPABASE_ACCESS_TOKEN/SERVICE_ROLE en .env.local");

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

// PRE: ¿existe la columna?
const pre = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'medical_appointments' AND table_schema = 'public' ORDER BY ordinal_position;`);
if (pre.length === 0) throw new Error("PRE falló: medical_appointments no existe");
const yaExiste = pre.some(c => c.column_name === "order_path");
console.log(`PRE ✓ medical_appointments con ${pre.length} columnas — order_path ${yaExiste ? "YA existe" : "no existe"}`);

if (!yaExiste) {
  await mgmt(`BEGIN;
ALTER TABLE public.medical_appointments ADD COLUMN order_path text;
COMMENT ON COLUMN public.medical_appointments.order_path IS 'Ruta de la orden de rayos/eco subida por el cliente (bucket privado medical-orders); null = sin archivo. Purge: 7 días (cron).';
COMMIT;`);
  console.log("ALTER aplicado en transacción ✓");
}
const post = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'medical_appointments' AND table_schema = 'public' AND column_name = 'order_path';`);
if (post.length !== 1 || post[0].data_type !== "text") throw new Error(`POST falló: ${JSON.stringify(post)}`);
console.log("POST ✓ order_path text nullable ✓");

// Bucket privado medical-orders (idempotente)
const H = { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const list = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, { headers: { Authorization: `Bearer ${SERVICE}` } });
const buckets = await list.json();
const exists = Array.isArray(buckets) && buckets.some(b => b.name === "medical-orders");
if (!exists) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST", headers: H,
    body: JSON.stringify({ name: "medical-orders", public: false, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] }),
  });
  if (!res.ok) throw new Error(`crear bucket: ${res.status} ${await res.text()}`);
  console.log("Bucket medical-orders creado (privado) ✓");
} else {
  console.log("Bucket medical-orders ya existía ✓");
}
console.log("Migración completa: order_path + bucket medical-orders listos.");
