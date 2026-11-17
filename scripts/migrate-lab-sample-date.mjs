// Migración: fecha de toma de muestra para órdenes de lab (feedback 18/11
// del dueño). El counter la fija al coordinar con el cliente — SIN hora
// (la toma la hace cualquier personal). Columna `sample_date date` nullable.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter(Boolean).filter(l => /^[A-Z_]+=/.test(l)).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  }));

const REF = "hflqbiqcpkpdczcvakyy";
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

const pre = await mgmt(`SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_orders' AND table_schema = 'public';`);
if (pre.length === 0) throw new Error("PRE falló: lab_orders no existe");
const ya = pre.some(c => c.column_name === "sample_date");
console.log(`PRE ✓ lab_orders ${pre.length} columnas — sample_date ${ya ? "YA existe" : "no existe"}`);

if (!ya) {
  await mgmt(`BEGIN;
ALTER TABLE public.lab_orders ADD COLUMN sample_date date;
COMMENT ON COLUMN public.lab_orders.sample_date IS 'Fecha de toma de muestra coordinada por el counter (SIN hora — la toma la hace cualquier personal); null = por coordinar';
COMMIT;`);
  console.log("ALTER aplicado en transacción ✓");
}
const post = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'lab_orders' AND table_schema = 'public' AND column_name = 'sample_date';`);
if (post.length !== 1 || post[0].data_type !== "date") throw new Error(`POST falló: ${JSON.stringify(post)}`);
console.log("POST ✓ sample_date date nullable ✓");
console.log("Migración completa: fecha de toma de muestra lista.");
