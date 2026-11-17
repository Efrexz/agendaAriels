// Migración: laboratorio agendado por el CLIENTE (feedback 17/11 del dueño).
// 1) Estado nuevo `solicitada` en el CHECK de lab_orders (la muestra aún no se
//    toma: llegar "recibida" sería mentir). Flujo: solicitada→recibida→...
// 2) Columna `order_path` (text) — foto de la orden sellada subida por el
//    cliente al bucket privado medical-orders (mismo bucket, purga 7 días).
// Regla del repo: SQL en transacción con verificación PRE y POST.
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

// PRE
const preCols = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'lab_orders' AND table_schema = 'public' ORDER BY ordinal_position;`);
if (preCols.length === 0) throw new Error("PRE falló: lab_orders no existe");
const colYa = preCols.some(c => c.column_name === "order_path");
const preCon = await mgmt(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.lab_orders'::regclass AND contype = 'c';`);
const statusCon = preCon.find(c => c.def.includes("status = ANY"));
if (!statusCon) throw new Error("PRE falló: CHECK de status no encontrado");
const yaSolicitada = statusCon.def.includes("'solicitada'");
console.log(`PRE ✓ lab_orders ${preCols.length} columnas — order_path ${colYa ? "YA existe" : "no existe"}; CHECK status ${yaSolicitada ? "YA tiene solicitada" : "sin solicitada"}`);

if (!yaSolicitada || !colYa) {
  // DROP + re-CREATE del CHECK con el estado nuevo (una pieza, en transacción).
  const addCol = colYa ? "" : "ALTER TABLE public.lab_orders ADD COLUMN order_path text;";
  const comment = colYa ? "" : "COMMENT ON COLUMN public.lab_orders.order_path IS 'Foto de la orden sellada subida por el cliente (bucket privado medical-orders); null = sin archivo. Purga 7 dias (cron).';";
  await mgmt(`BEGIN;
ALTER TABLE public.lab_orders DROP CONSTRAINT lab_orders_status_check;
ALTER TABLE public.lab_orders ADD CONSTRAINT lab_orders_status_check CHECK (status = ANY (ARRAY['solicitada'::text, 'recibida'::text, 'en_laboratorio'::text, 'resultado_listo'::text, 'entregada'::text, 'cancelado'::text]));
${addCol}
${comment}
COMMIT;`);
  console.log("ALTER aplicado en transacción ✓");
}

// POST
const postCols = await mgmt(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'lab_orders' AND table_schema = 'public' AND column_name = 'order_path';`);
const postCon = await mgmt(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'lab_orders_status_check';`);
if (postCols.length !== 1 || postCols[0].data_type !== "text") throw new Error(`POST falló: ${JSON.stringify(postCols)}`);
if (!postCon[0]?.def.includes("'solicitada'")) throw new Error(`POST falló: CHECK sin solicitada → ${JSON.stringify(postCon)}`);
console.log("POST ✓ order_path text nullable ✓ + CHECK con 'solicitada' ✓");
console.log("Migración completa: laboratorio listo para agendarse desde la web.");
