// Migración: VARIOS exámenes por orden de lab (feedback 17/11 del dueño).
// Un paciente puede hacerse 2-3 exámenes y el counter sube un PDF por cada uno.
// El PRIMER resultado conserva su flujo intacto (result_path + token + ventana
// de 20 días en lab_orders). Esta tabla guarda los ADICIONALES (2..N) — el
// acceso sigue siendo el MISMO enlace/token de la orden y la misma ventana.
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

// PRE: lab_orders existe y la tabla nueva todavía no.
const pre = await mgmt(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`);
if (!pre.some(t => t.table_name === "lab_orders")) throw new Error("PRE falló: lab_orders no existe");
const yaExiste = pre.some(t => t.table_name === "lab_extra_results");
console.log(`PRE ✓ lab_orders existe — lab_extra_results ${yaExiste ? "YA existe" : "no existe"}`);

if (!yaExiste) {
  await mgmt(`BEGIN;
CREATE TABLE public.lab_extra_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'counter',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, path)
);
COMMENT ON TABLE public.lab_extra_results IS 'Resultados ADICIONALES (2..N) de una orden de lab. El 1º vive en lab_orders.result_path; estos comparten el token y la ventana de 20 días de la orden.';
ALTER TABLE public.lab_extra_results ENABLE ROW LEVEL SECURITY;
COMMIT;`);
  console.log("CREATE TABLE aplicado en transacción ✓");
}

// POST: la tabla existe, RLS activo y SIN policies (deny-all: solo service_role).
const post = await mgmt(`SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = 'public'
  WHERE c.table_name = 'lab_extra_results' AND c.table_schema = 'public';`);
const cols = new Set(post.map(r => r.column_name));
for (const col of ["id", "order_id", "path", "name", "published_at", "created_by"]) {
  if (!cols.has(col)) throw new Error(`POST falló: falta columna ${col}`);
}
const rls = await mgmt(`SELECT relrowsecurity FROM pg_class WHERE relname = 'lab_extra_results' AND relnamespace = 'public'::regnamespace;`);
if (rls[0]?.relrowsecurity !== true) throw new Error("POST falló: RLS no activo");
const policies = await mgmt(`SELECT policyname FROM pg_policies WHERE tablename = 'lab_extra_results';`);
if (policies.length > 0) throw new Error(`POST falló: policies inesperadas ${JSON.stringify(policies)}`);
console.log("POST ✓ lab_extra_results con columnas completas, RLS activo y deny-all ✓");
console.log("Migración completa: resultados adicionales de lab listos.");
