/**
 * Integración del MÓDULO LABORATORIO contra Supabase real:
 * 1) staff temporal → login
 * 2) crear orden LAB-XXXXX (cross-sede Los Olivos → San Miguel, dry-run WhatsApp)
 * 3) flujo completo: recibida → en_laboratorio → resultado_listo (WhatsApp dry-run) → entregada
 * 4) vistas del counter: "En curso" que ve AMBAS sedes (origen+responsable) + búsqueda
 * 5) estatus público /api/lab-status (campos seguros, sin datos sensibles)
 * 6) 401 sin token en listado staff
 * 7) limpieza total.
 * Env: npx tsx --env-file=.env.local scripts/integration-lab.ts
 */
process.env.EVOLUTION_DRY_RUN = "true";

import { LabDb } from "../api/lab/db.js";

const SUPA = String(process.env.SUPABASE_URL ?? "");
const PROJECT = "hflqbiqcpkpdczcvakyy";

interface Res {
  status(code: number): Res;
  json(p: unknown): Res;
  setHeader(): Res;
}

function makeRes() {
  let s = 0;
  let b: unknown;
  const r: Res = {
    status(c: number) { s = c; return r; },
    json(p: unknown) { b = p; return r; },
    setHeader() { return r; },
  };
  return { res: r, last: () => ({ status: s, body: b }) };
}

const authHeaders = { authorization: "" };

async function main() {
  const EMAIL = `staff-lab-${Date.now()}@example.com`;
  const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const created = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "LabTest-2026-tmp", email_confirm: true }),
  });
  if (!created.ok) throw new Error("crear staff falló");
  const userId = ((await created.json()) as { id: string }).id;
  try {
    const ANON = String(process.env.SUPABASE_ANON_KEY ?? "");
    const login = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: "LabTest-2026-tmp" }),
    });
    const token = ((await login.json()) as { access_token: string }).access_token;
    authHeaders.authorization = `Bearer ${token}`;
    console.log("1. login staff OK");

    const db = LabDb.fromEnv({ SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: SERVICE })!;

    // ── Creación cross-sede ──
    const createMod = await import("../api/lab/_create.js");
    const r1 = makeRes();
    await createMod.default(
      { method: "POST", headers: authHeaders, body: {
        sedeOrigen: "los_olivos", sedeResponsable: "san_miguel",
        labName: "LabPrueba Externo", examType: "Perfil pre-order",
        petName: "Rocky Prueba", petType: "Perro",
        ownerName: "Lab Test", ownerPhone: "999777777",
      } }, r1.res,
    );
    const b1 = r1.last().body as { ok?: boolean; orderCode?: string; notified?: boolean };
    const code1 = b1.orderCode ?? "";
    console.log("2. nueva orden cross-sede:", r1.last().status, code1,
      /^LAB-[A-Z0-9]{5}$/.test(code1) ? "FORMATO OK" : "FORMATO MAL", "wa(dry-run):", b1.notified);
    if (r1.last().status !== 200 || !/^LAB-[A-Z0-9]{5}$/.test(code1)) throw new Error("creación falló");

    // dedupe: misma petición al instante → mismo código, sin segunda inserción
    const r1b = makeRes();
    await createMod.default(
      { method: "POST", headers: authHeaders, body: {
        sedeOrigen: "los_olivos", sedeResponsable: "san_miguel",
        labName: "LabPrueba Externo", examType: "Perfil pre-order",
        petName: "Rocky Prueba", petType: "Perro",
        ownerName: "Lab Test", ownerPhone: "999777777",
      } }, r1b.res,
    );
    const codeDup = (r1b.last().body as { orderCode: string }).orderCode;
    console.log("3. dedupe doble click (mismo código):", codeDup === code1 ? "OK" : `FALLO(${codeDup})`);
    if (codeDup !== code1) throw new Error("dedupe falló");

    // sin teléfono válido → 400
    const r1c = makeRes();
    await createMod.default(
      { method: "POST", headers: authHeaders, body: {
        sedeOrigen: "los_olivos", sedeResponsable: "los_olivos", labName: "X", examType: "Hematología",
        petName: "Otra Prueba", ownerName: "Lab Test 2", ownerPhone: "12",
      } }, r1c.res,
    );
    console.log("4. teléfono inválido (esperado 400):", r1c.last().status);
    if (r1c.last().status !== 400) throw new Error("aceptó teléfono corto");

    // ── Vistas del counter (cross-sede) ──
    const listMod = await import("../api/lab/_list.js");
    const r2 = makeRes();
    await listMod.default({ method: "GET", url: "/api/internal/lab/list?view=active&sede=los_olivos", headers: authHeaders }, r2.res);
    const lo = (r2.last().body as { orders: Array<{ orderCode: string }> }).orders.some((o) => o.orderCode === code1);
    console.log("5. En curso vista por sede ORIGEN (Los Olivos):", lo ? "VE_LA_ORDEN" : "NO_Aparece");
    if (!lo) throw new Error("sede origen no ve la orden");

    const r2b = makeRes();
    await listMod.default({ method: "GET", url: "/api/internal/lab/list?view=active&sede=san_miguel", headers: authHeaders }, r2b.res);
    const sm = (r2b.last().body as { orders: Array<{ orderCode: string }> }).orders.some((o) => o.orderCode === code1);
    console.log("6. En curso vista por sede RESPONSABLE (San Miguel):", sm ? "VE_LA_ORDEN" : "NO_Aparece");
    if (!sm) throw new Error("sede responsable no ve la orden");

    const r2c = makeRes();
    await listMod.default({ method: "GET", url: "/api/internal/lab/list?view=today&sede=los_olivos", headers: authHeaders }, r2c.res);
    console.log("7. vista HOY:", r2c.last().status, ((r2c.last().body as { orders: Array<{ orderCode: string }> }).orders).length, "orden(es)");

    const r2d = makeRes();
    await listMod.default({ method: "GET", url: "/api/internal/lab/list?view=active&q=999777777", headers: authHeaders }, r2d.res);
    const tel = ((r2d.last().body as { orders: Array<{ orderCode: string }> }).orders).some((o) => o.orderCode === code1);
    console.log("8. búsqueda por TELÉFONO:", tel ? "OK" : "FALLO", r2d.last().status);
    if (!tel) throw new Error("búsqueda por teléfono falló");

    // ── Catálogo global (exam/labs): GET + agregar + duplicado idempotente ──
    const catMod = await import("../api/lab/_catalog.js");
    const r2e = makeRes();
    await catMod.default({ method: "GET", headers: authHeaders, body: undefined }, r2e.res);
    const cat0 = r2e.last().body as { exams: string[]; labs: string[] };
    console.log("8b. catálogo:", r2e.last().status, `${cat0.labs.length} labs / ${cat0.exams.length} exámenes`,
      cat0.labs.includes("Hemovet") ? "(Hemovet presente)" : "(FALTA Hemovet)");
    if (r2e.last().status !== 200 || !cat0.labs.includes("Hemovet")) throw new Error("catálogo GET falló");

    const NEW_EXAM = "Perfil Integration Lab";
    const r2f = makeRes();
    await catMod.default({ method: "POST", headers: authHeaders, body: { kind: "exam", name: NEW_EXAM } }, r2f.res);
    const r2g = makeRes();
    await catMod.default({ method: "POST", headers: authHeaders, body: { kind: "exam", name: NEW_EXAM } }, r2g.res);
    const nameAdd = (r2f.last().body as { name: string }).name;
    const nameDup = (r2g.last().body as { name: string }).name;
    console.log("8c. agregar examen nuevo + duplicado idempotente:", nameAdd === NEW_EXAM && nameDup === NEW_EXAM ? "OK" : "FALLO");
    if (nameAdd !== NEW_EXAM || nameDup !== NEW_EXAM) throw new Error("catálogo POST falló");

    // ── Flujo de estados + WhatsApp al quedar listo (dry-run) ──
    const order = (await db.findOrderByCode(code1))!;
    const statusMod = await import("../api/lab/_status.js");
    for (const to of ["en_laboratorio", "resultado_listo", "entregada"]) {
      const r3 = makeRes();
      await statusMod.default({ method: "PATCH", headers: authHeaders, body: { id: order.id, status: to } }, r3.res);
      const body = r3.last().body as { ok: boolean; notified?: boolean }
      console.log(`9. → ${to}:`, r3.last().status, to === "resultado_listo" ? `notified=${body.notified}` : "");
      if (r3.last().status !== 200 || !body.ok) throw new Error(`transición ${to} falló`);
    }

    // ── Estatus público ──
    const pubMod = await import("../api/lab/_public_status.js");
    const r4 = makeRes();
    await pubMod.default({ method: "GET", url: `/api/lab-status?code=${code1}`, headers: {} }, r4.res);
    const b4 = r4.last().body as { ok: boolean; order: Record<string, unknown> };
    const raw = JSON.stringify(b4);
    console.log("10. estatus público:", r4.last().status, "campos:", Object.keys(b4.order ?? {}).join(","));
    const safe = b4.ok
      && !raw.includes("999777777")
      && !raw.includes("Lab Test")
      && !raw.includes("LabPrueba")
      && String(b4.order.timeline?.length >= 3);
    console.log("11. sin datos sensibles + timeline:", safe ? "OK" : "FALLO");
    if (!safe) throw new Error("fuga de datos o timeline incompleta");

    // ── 401 sin token ──
    const r5 = makeRes();
    await listMod.default({ method: "GET", url: "/api/internal/lab/list", headers: {} }, r5.res);
    console.log("12. listado sin token (esperado 401):", r5.last().status);
    if (r5.last().status !== 401) throw new Error("devió datos privados");

    // ── RESULTADO al cliente (Storage privado + URL firmada + purga 20 días) ──
    const { createClient } = await import("@supabase/supabase-js");
    const service = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

    const rA = makeRes();
    await createMod.default(
      { method: "POST", headers: authHeaders, body: {
        sedeOrigen: "san_martin", sedeResponsable: "san_martin",
        labName: "LabPrueba Externo", examType: "Perfil pre-order",
        petName: "Nina Prueba", petType: "Gato",
        ownerName: "Lab Test Dos", ownerPhone: "999777888",
      } }, rA.res,
    );
    const codeA = (rA.last().body as { orderCode: string }).orderCode;
    const orderA = (await db.findOrderByCode(codeA))!;
    console.log("13. orden 2 creada:", codeA, orderA.id ? "id OK" : "id MAL");

    const rA2 = makeRes();
    await statusMod.default({ method: "PATCH", headers: authHeaders, body: { id: orderA.id, status: "resultado_listo" } }, rA2.res);
    if (rA2.last().status !== 200) throw new Error("→ resultado_listo falló");

    const pdfBytes = Uint8Array.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n".split("").map((c) => c.charCodeAt(0)),
    );
    const pathA = `${orderA.id}/${codeA}-resultado-${Date.now()}.pdf`;
    const up = await service.storage.from("lab-results").upload(pathA, pdfBytes, { contentType: "application/pdf" });
    if (up.error) throw new Error(`upload storage falló: ${up.error.message}`);
    console.log("14. PDF subido al bucket privado:", up.data?.path === pathA ? "OK" : "MAL");

    const resultMod = await import("../api/lab/_result.js");
    const rB = makeRes();
    await resultMod.default(
      { method: "POST", headers: authHeaders, body: { id: orderA.id, path: pathA, name: "resultado-prueba.pdf", mime: "application/pdf", size: pdfBytes.length } },
      rB.res,
    );
    console.log("15. registrar resultado:", rB.last().status);
    if (rB.last().status !== 200) throw new Error("publicar resultado falló");

    const rC = makeRes();
    await pubMod.default({ method: "GET", url: `/api/lab-status?code=${codeA}`, headers: {} }, rC.res);
    const bC = rC.last().body as { order: { resultFile?: { url: string; name: string }; resultExpired?: boolean } };
    const linkOk = !!bC.order.resultFile?.url && !bC.order.resultExpired;
    console.log("16. /estado ve el resultado (URL firmada):", linkOk ? "OK" : "FALLO", bC.order.resultFile?.name ?? "");
    if (!linkOk) throw new Error("resultado no llegó al cliente");

    // Forzar expiración y correr el cron de purga
    await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `update public.lab_orders set result_published_at = now() - interval '21 days' where order_code = '${codeA}'` }),
    });
    const purgeMod = await import("../api/lab/_purge.js");
    const rD = makeRes();
    await purgeMod.default(
      { method: "GET", headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {} },
      rD.res,
    );
    const bD = rD.last().body as { ok: boolean; expired: number; purged: number; failed: number };
    console.log("17. cron purge:", rD.last().status, JSON.stringify(bD));
    if (rD.last().status !== 200 || bD.purged < 1 || bD.failed > 0) throw new Error("purga falló");

    const rE = makeRes();
    await pubMod.default({ method: "GET", url: `/api/lab-status?code=${codeA}`, headers: {} }, rE.res);
    const bE = rE.last().body as { order: { resultFile?: unknown; resultExpired?: boolean; status: string } };
    const expiredOk = bE.order.resultExpired === true && !bE.order.resultFile && bE.order.status === "entregada";
    console.log("18. expirado: aviso + orden 'entregada':", expiredOk ? "OK" : `FALLO(${bE.order.status}/${bE.order.resultExpired})`);
    if (!expiredOk) throw new Error("expiración no reflejada");

    console.log("\n✅ INTEGRACIÓN LAB COMPLETA");
  } finally {
    // ── Limpieza ──
    await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "delete from public.lab_orders where owner_name like '%Test' or pet_name like '%Prueba%'; delete from public.lab_exam_types where name like 'Perfil Integration%';" }),
    });
    await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" },
    });
    console.log("🧹 limpieza (ordenes test + staff temporal) OK");
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
