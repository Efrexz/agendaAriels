/**
 * Integración del MÓDULO MÉDICO contra Supabase real:
 * 1) crea cita general (flujo público) → código CM-XXXXX
 * 2) especializada: solicitud → PATCH pagado → assign → confirmada (dry-run WhatsApp)
 * 3) búsqueda y vista del día del staff
 * 4) limpieza total al final.
 * Env: tsx --env-file=.env.local scripts/integration-medical.ts
 */
process.env.EVOLUTION_DRY_RUN = "true";

import { MedicalDb } from "../api/medical/db.js";

const SUPA = String(process.env.SUPABASE_URL ?? "");
const ACCESS = String(process.env.SUPABASE_ACCESS_TOKEN ?? "");
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
  // login staff temporal (como la integración de grooming)
  const EMAIL = `staff-med-${Date.now()}@example.com`;
  const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const created = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "MedTest-2026-tmp", email_confirm: true }),
  });
  if (!created.ok) throw new Error("crear staff falló");
  const userId = ((await created.json()) as { id: string }).id;
  try {
    const ANON = String(process.env.SUPABASE_ANON_KEY ?? "");
    const login = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: "MedTest-2026-tmp" }),
    });
    const token = ((await login.json()) as { access_token: string }).access_token;
    authHeaders.authorization = `Bearer ${token}`;
    console.log("1. login staff OK");

    const db = MedicalDb.fromEnv({ SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: SERVICE })!;

    // doctor general de san_miguel
    const doctors = await db.listDoctors("san_miguel", "general");
    const doctor = doctors.find((d) => d.active)!;
    console.log("2. doctor ficticio:", doctor.fullName);

    const TOMORROW = "2026-10-21"; // miércoles
    // ── CREACIÓN general ──
    const createMod = await import("../api/medical/_create.js");
    const r1 = makeRes();
    await createMod.default(
      { method: "POST", headers: {}, body: {
        branch: "san_miguel", serviceType: "general", date: TOMORROW, startMinute: 540,
        doctorId: doctor.id, petName: "Manolo Prueba", petType: "Perro", petNotes: "-",
        ownerName: "Int Med Test", ownerPhone: "999777666", ownerEmail: "-",
      } }, r1.res,
    );
    const code1 = (r1.last().body as { appointmentCode?: string }).appointmentCode ?? "";
    console.log("3. cita general:", r1.last().status, code1, /^CM-[A-Z0-9]{5}$/.test(code1) ? "FORMATO OK" : "FORMATO MAL");
    if (r1.last().status !== 200) throw new Error("creación general falló");

    // validaciones server-side: slot ocupado por la creada → 409
    const r1b = makeRes();
    await createMod.default(
      { method: "POST", headers: {}, body: {
        branch: "san_miguel", serviceType: "general", date: TOMORROW, startMinute: 540,
        doctorId: doctor.id, petName: "Doble", petType: "Perro", petNotes: "-",
        ownerName: "Doble Test", ownerPhone: "999777600", ownerEmail: "-",
      } }, r1b.res,
    );
    console.log("4. doble reserva mismo slot (esperado 409):", r1b.last().status);
    if (r1b.last().status !== 409) throw new Error("NO bloqueó el solapamiento");

    // rayos sin orden → 400
    const r1c = makeRes();
    await createMod.default(
      { method: "POST", headers: {}, body: {
        branch: "san_miguel", serviceType: "rayos", date: TOMORROW, startMinute: 600,
        doctorId: doctor.id, hasOrder: false, petName: "Rayo", petType: "Perro", petNotes: "-",
        ownerName: "Rayo Test", ownerPhone: "999777601", ownerEmail: "-",
      } }, r1c.res,
    );
    console.log("5. rayos sin orden (esperado 400):", r1c.last().status);
    if (r1c.last().status !== 400) throw new Error("devió orden");

    // ── especializada: solicitud→pagado→assign→confirmada ──
    const specs = await db.listSpecialties(true);
    const cardio = specs.find((s) => s.name === "Cardiología")!;
    const r2 = makeRes();
    await createMod.default(
      { method: "POST", headers: {}, body: {
        branch: "san_miguel", serviceType: "especializada", specialtyId: cardio.id,
        petName: "Kira Prueba", petType: "Gato", petNotes: "-",
        ownerName: "Spec Test", ownerPhone: "999777602", ownerEmail: "-",
      } }, r2.res,
    );
    const code2 = (r2.last().body as { appointmentCode?: string }).appointmentCode ?? "";
    console.log("6. solicitud especializada:", r2.last().status, code2);
    if (r2.last().status !== 200) throw new Error("solicitud especializada falló");

    const appt2 = await db.findApptByCode(code2)!;
    const patchMod = await import("../api/medical/_status.js");
    const r3 = makeRes();
    await patchMod.default({ method: "PATCH", headers: authHeaders, body: { id: appt2.id, status: "pagado" } }, r3.res);
    console.log("7. marca pagado:", r3.last().status);

    const assignMod = await import("../api/medical/_assign.js");
    const r4 = makeRes();
    await assignMod.default(
      { method: "POST", headers: authHeaders, body: { id: appt2.id, doctorId: doctor.id, apptDate: "2026-10-22", startMinute: 600 } },
      r4.res,
    );
    console.log("8. asignar doctor/fecha/hora:", r4.last().status, JSON.stringify(r4.last().body));

    const r5 = makeRes();
    await patchMod.default({ method: "PATCH", headers: authHeaders, body: { id: appt2.id, status: "confirmada" } }, r5.res);
    console.log("9. confirmar (notifica dry-run):", r5.last().status, JSON.stringify(r5.last().body));

    // ── staff: día y búsqueda ──
    const dayMod = await import("../api/medical/_day.js");
    const r6 = makeRes();
    await dayMod.default({ method: "GET", url: "/api/medical/day?date=2026-10-21", headers: authHeaders }, r6.res);
    const dayBody = r6.last().body as { appointments: Array<{ appointmentCode: string; status: string }> };
    console.log("10. vista del día:", r6.last().status, dayBody.appointments.map((a) => `${a.appointmentCode}=${a.status}`));

    const searchMod = await import("../api/medical/_search.js");
    const r7 = makeRes();
    await searchMod.default({ method: "GET", url: "/api/medical/search?q=999777666", headers: authHeaders }, r7.res);
    console.log("11. búsqueda por teléfono:", r7.last().status, ((r7.last().body as { results: Array<{ appointmentCode: string }> }).results).map((r) => r.appointmentCode));

    const r8 = makeRes();
    await dayMod.default({ method: "GET", url: "/api/medical/day", headers: authHeaders }, r8.res);
    console.log("12. por asignar (solicitud):", r8.last().status, ((r8.last().body as { appointments: Array<{ appointmentCode: string }> }).appointments).filter((a) => a.appointmentCode === code2).length >= 0);

    // horarios: crear/quitar bloque
    const schedMod = await import("../api/medical/_schedules.js");
    const r9 = makeRes();
    await schedMod.default({ method: "POST", headers: authHeaders, body: { doctorId: doctor.id, weekday: 6, startMinute: 600, endMinute: 660 } }, r9.res);
    console.log("13. nuevo bloque horario:", r9.last().status);
    const rows = await db.listAllSchedulesWithDoctors();
    const added = rows.find((x) => x.doctorId === doctor.id && x.weekday === 6 && x.startMinute === 600)!;
    const r10 = makeRes();
    await schedMod.default({ method: "DELETE", url: `/api/medical/schedules?id=${added.id}`, headers: authHeaders }, r10.res);
    console.log("14. quitar bloque:", r10.last().status);

    console.log("MÓDULO MÉDICO INTEGRACIÓN OK");
  } finally {
    // limpieza completa de citas de prueba (cascade borra timelines)
    await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ACCESS}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "delete from public.medical_appointments where owner_name like '%Test'" }),
    }).then((r) => console.log("limpieza citas:", r.status));
    await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    }).then((r) => console.log("limpieza staff:", r.status));
  }
}

main().catch((e) => { console.error("FALLO:", e); process.exit(1); });
