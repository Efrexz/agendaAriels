/**
 * Prueba de integración end-to-end de los endpoints internos contra el
 * proyecto Supabase real: crea un usuario staff temporal, hace login,
 * llama a los handlers y limpia al final. WhatsApp en DRY-RUN (no envía).
 */
import { SupabaseBookingDb } from "../api/db";

const env = { ...process.env } as Record<string, string>;
env.EVOLUTION_DRY_RUN = "true";

const URL = env.SUPABASE_URL!;
const ANON = env.SUPABASE_ANON_KEY!;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;

const EMAIL = `staff-test-${Date.now()}@example.com`;
const PASSWORD = "StaffTest-2026-tmp";

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
  setHeader(name: string, value: string): Res;
}

function makeRes(): { res: Res; last: () => { status: number; body: unknown } } {
  let status = 0;
  let body: unknown;
  const r: Res = {
    status(code: number) {
      status = code;
      return r;
    },
    json(p: unknown) {
      body = p;
      return r;
    },
    setHeader() {
      return r;
    },
  } as Res;
  return { res: r, last: () => ({ status, body }) };
}

async function main() {
  // 1. Crear usuario staff temporal
  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const createdBody = (await created.json()) as { id?: string; msg?: string; message?: string };
  if (!created.ok) {
    console.log("crear usuario falló:", created.status, JSON.stringify(createdBody));
    return;
  }
  const userId = createdBody.id!;

  try {
    // 2. Login (grant password con key anon)
    const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const loginBody = (await login.json()) as { access_token?: string };
    if (!login.ok || !loginBody.access_token) throw new Error(`login falló (${login.status})`);
    const token = loginBody.access_token;
    console.log("1. login OK");

    const authHeaders = { authorization: `Bearer ${token}` };

    // 3. /api/internal/day → luego con una reserva insertada
    const day = await import("../api/internal/_day");
    const { res, last } = makeRes();
    await day.default(
      { method: "GET", url: "/api/internal/day?date=2026-10-25", headers: authHeaders },
      res,
    );
    // Sanity del formato — el tipo se reconstruye con cast
    const dayBody = last().body as { ok: boolean; bookings?: unknown[] };
    console.log("2. day sin reserva:", last().status, dayBody.ok, "reservas:", dayBody.bookings?.length ?? 0);
    if (last().status !== 200) return;

    // Sin token → 401
    const day2 = await import("../api/internal/_day");
    const r2 = makeRes();
    await day2.default({ method: "GET", url: "/api/internal/day?date=2026-10-25", headers: {} }, r2.res);
    console.log("3. day sin token (esperado 401):", r2.last().status);
    if (r2.last().status !== 401) return;

    // 4. Insertar reserva de prueba y consultarla por código
    const db = SupabaseBookingDb.fromEnv({ SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE })!;
    const record = {
      bookingCode: "VA-IT123",
      branch: "san_martin",
      branchLabel: "Sede San Martín de Porres",
      serviceDate: "2026-10-25",
      timeSlot: "9-11",
      ownerName: "Int Test",
      ownerDni: "-",
      ownerPhone: "999888777",
      ownerEmail: "-",
      ownerAddress: "Av Test 123",
      ownerLat: -12.0206,
      ownerLng: -77.0865,
      mapsUrl: null,
      hasHistory: null,
      registeredPetName: "-",
      registeredPhone: "-",
      petBirthDate: "-",
      petSpecies: "-",
      petBreed: "-",
      petCastrated: false,
      mobilityPhoneDifferent: false,
      mobilityPhone: "-",
      pets: [
        {
          name: "Luna",
          type: "Perro",
          service: "Baño",
          size: "Grande",
          bathType: "Tradicional",
          corteType: "-",
          corteSpecs: "-",
          extras: [],
          perfume: "-",
          notes: "-",
          corteImage: null,
        },
      ],
    };
    await db.insertBooking(record);

    const r3 = makeRes();
    await day.default({ method: "GET", url: "/api/internal/day?date=2026-10-25", headers: authHeaders }, r3.res);
    const dayBody3 = r3.last().body as { bookings: Array<{ id: string; bookingCode: string; status: string }> };
    console.log(
      "4. day con reserva:",
      r3.last().status,
      dayBody3.bookings.map((b) => `${b.bookingCode}=${b.status}`),
    );
    if (r3.last().status !== 200 || dayBody3.bookings[0].bookingCode !== "VA-IT123") return;
    const bookingId = dayBody3.bookings[0].id;

    // 5. Cambiar estado → en_bano (no notificable) y listo (notificable con dry-run)
    const statusMod = await import("../api/internal/_status");
    const r4 = makeRes();
    await statusMod.default(
      { method: "POST", headers: authHeaders, body: { bookingId, status: "en_bano" } },
      r4.res,
    );
    console.log("5. status en_bano:", r4.last().status, JSON.stringify(r4.last().body));

    const r5 = makeRes();
    await statusMod.default(
      { method: "POST", headers: authHeaders, body: { bookingId, status: "listo" } },
      r5.res,
    );
    console.log("6. status listo (notifica en dry-run):", r5.last().status, JSON.stringify(r5.last().body));

    // 6. /api/status público con el código → status 'listo'
    const statusApi = await import("../api/_status");
    const r6 = makeRes();
    await statusApi.default(
      { method: "GET", url: "/api/status?code=VA-IT123", headers: {} },
      r6.res,
    );
    const pub = r6.last().body as { booking?: { status: string; ownerName?: string } };
    console.log("7. /api/status:", r6.last().status, "status:", pub.booking?.status, "sin ownerName:", pub.booking?.ownerName === undefined);
    if (r6.last().status !== 200 || pub.booking?.status !== "listo") return;

    // 7. Cierres: cerrar día → listar → /api/availability → reabrir
    const closuresMod = await import("../api/internal/_closures");
    const availMod = await import("../api/_availability");

    const r7 = makeRes();
    await closuresMod.default(
      { method: "POST", headers: authHeaders, body: { branch: "san_miguel", date: "2026-10-26", timeSlot: null, reason: "test" } },
      r7.res,
    );
    console.log("8. cerrar día:", r7.last().status, JSON.stringify(r7.last().body));

    const r8 = makeRes();
    await availMod.default({ method: "GET", headers: {} }, r8.res);
    const avail = r8.last().body as { closures: Array<{ branch: string; date: string }> };
    console.log("9. /api/availability:", r8.last().status, JSON.stringify(avail.closures));

    const r9 = makeRes();
    await closuresMod.default({ method: "GET", url: "/api/internal/closures", headers: authHeaders }, r9.res);
    const list = r9.last().body as { closures: Array<{ id: string; closureDate: string }> };
    const id = list.closures.find((c) => c.closureDate === "2026-10-26")?.id;
    if (!id) {
      console.error("no se encontró el cierre para reabrir");
      return;
    }

    const r10 = makeRes();
    await closuresMod.default({ method: "DELETE", url: `/api/internal/closures?id=${id}`, headers: authHeaders }, r10.res);
    console.log("10. reabrir:", r10.last().status);

    // 8. Búsqueda
    const searchMod = await import("../api/internal/_search");
    const r11 = makeRes();
    await searchMod.default({ method: "GET", url: "/api/internal/search?q=999888777", headers: authHeaders }, r11.res);
    const found = r11.last().body as { results: Array<{ bookingCode: string }> };
    console.log("11. buscar por teléfono:", r11.last().status, found.results.map((b) => b.bookingCode));

    // 9. Reenvío de avisos (reserva con entregado=true → no vuelve a enviar)
    const resendMod = await import("../api/internal/_resend");
    const r12 = makeRes();
    await resendMod.default(
      { method: "POST", headers: authHeaders, body: { bookingId } },
      r12.res,
    );
    const resend = r12.last().body as { ok: boolean; resent: boolean };
    console.log("12. resend (flag no entregado → reenvía):", r12.last().status, JSON.stringify(r12.last().body));
    if (r12.last().status !== 200 || resend.resent !== true) return;

    console.log("INTEGRACIÓN OK");
  } finally {
    // Limpiar: reserva de prueba
    await fetch("https://api.supabase.com/v1/projects/hflqbiqcpkpdczcvakyy/database/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "delete from public.bookings where booking_code='VA-IT123'" }),
    }).then((r) => console.log("limpieza reserva:", r.status));
  }

  // Eliminar usuario temporal
  const del = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
  });
  console.log("usuario temporal eliminado:", del.status);

  // Barrido: elimina usuarios de prueba de corridos anteriores que quedaron huérfanos
  const list = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
  });
  if (list.ok) {
    const users = ((await list.json()) as { users: Array<{ id: string; email: string }> }).users
      .filter((u) => u.email.startsWith("staff-test-"));
    for (const u of users) {
      const d = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
      });
      console.log("huérfano eliminado:", u.email, d.status);
    }
  }
}

main().catch((err) => {
  console.error("FALLO:", err);
  process.exit(1);
});
