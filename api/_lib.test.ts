import { describe, it, expect, vi } from "vitest";
import {
  bookingPayloadSchema,
  buildBookingMessages,
  handleBooking,
  sendViaEvolution,
  validateScheduleWindow,
  type BookingEnv,
  type BookingPayload,
} from "./_lib";

const NOW = new Date("2026-10-05T15:00:00Z");

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bookingCode: "VA-TEST1",
    submittedAt: "2026-10-05T15:00:00.000Z",
    branch: "san_martin",
    branchLabel: "Sede San Martín de Porres",
    branchPhone: "+51 986 985 047",
    pets: [
      {
        name: "Rex",
        type: "Perro",
        service: "Baño + Corte",
        size: "Mediano",
        bathType: "Hidratado Premium",
        corteType: "Corte Rapado",
        corteSpecs: "-",
        extras: ["Antipulgas (Pipeta Fip Forte, 1 mes)"],
        perfume: "🍓 Frutal",
        notes: "Cuidado con la oreja",
        corteImage: null,
      },
    ],
    date: "2026-10-10",
    dateLabel: "sábado 10 de octubre de 2026",
    timeRange: "9-11",
    timeRangeLabel: "9:00 am – 11:00 am",
    ownerName: "Juan Pérez",
    ownerDni: "12345678",
    ownerPhone: "999-123-456",
    ownerAddress: "Av. Proceres 500",
    ownerLat: null,
    ownerLng: null,
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
    ownerEmail: "-",
    ...overrides,
  };
}

function payload(overrides: Partial<BookingPayload> = {}): BookingPayload {
  return bookingPayloadSchema.parse(raw(overrides as Record<string, unknown>));
}

const ENV_FULL: BookingEnv = {
  EVOLUTION_API_URL: "https://evo.example:10000",
  EVOLUTION_API_KEY: "test-key",
  EVOLUTION_INSTANCE: "celEfrain",
  WHATSAPP_DESTINO: "51986985047",
};

function fetchOk() {
  const calls: string[] = [];
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body).text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  return { fn, calls };
}

function fetchFailingTwice() {
  const calls: string[] = [];
  let attempts = 0;
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    attempts++;
    if (attempts <= 2) throw new Error("network down");
    calls.push(JSON.parse(init.body).text);
    return new Response("{}", { status: 200 });
  });
  return { fn, calls };
}

describe("bookingPayloadSchema", () => {
  it("acepta un payload válido", () => {
    expect(bookingPayloadSchema.parse(payload())).toBeTruthy();
  });

  it("rechaza sede desconocida", () => {
    expect(bookingPayloadSchema.safeParse(raw({ branch: "hack" })).success).toBe(false);
  });

  it("rechaza más de 8 mascotas", () => {
    const basePet = raw().pets;
    const pets = Array.from({ length: 9 }, () => basePet);
    expect(bookingPayloadSchema.safeParse(raw({ pets })).success).toBe(false);
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(bookingPayloadSchema.safeParse(raw({ ownerLat: 200 })).success).toBe(false);
  });

  it("rechaza email inválido", () => {
    expect(bookingPayloadSchema.safeParse(raw({ ownerEmail: "no-es-email" })).success).toBe(false);
  });

  it("acepta email placeholder '-'", () => {
    expect(bookingPayloadSchema.parse(payload({ ownerEmail: "-" })).ownerEmail).toBe("-");
  });

  it("rechaza imagen que no viene de Cloudinary", () => {
    const bad = payload();
    bad.pets[0] = { ...bad.pets[0], corteImage: "https://evil.example/imagen" };
    expect(bookingPayloadSchema.safeParse(bad).success).toBe(false);
  });
});

describe("validateScheduleWindow", () => {
  it("rechaza fecha pasada", () => {
    expect(validateScheduleWindow("2026-10-04", "9-11", NOW)).toMatch(/pasó/);
  });

  it("rechaza fecha más allá de 14 días", () => {
    expect(validateScheduleWindow("2026-10-20", "9-11", NOW)).toMatch(/14 días/);
  });

  it("acepta fecha dentro de la ventana", () => {
    expect(validateScheduleWindow("2026-10-10", "9-11", NOW)).toBeNull();
  });

  it("bloquea franja de hoy que ya inició y acepta la vigente", () => {
    const today = new Date("2026-10-05T00:00:00Z");
    const t15 = new Date("2026-10-05T15:00:00Z");
    expect(validateScheduleWindow("2026-10-05", "9-11", t15)).toMatch(/inició/);
    expect(validateScheduleWindow("2026-10-05", "11-14", t15)).toBeNull();
    expect(validateScheduleWindow(today.toISOString().slice(0, 10), "9-11", t15)).toMatch(/inició/);
  });
});

describe("buildBookingMessages", () => {
  it("arma el mensaje principal con todas las secciones (cliente nuevo)", () => {
    const withCoords = payload({
      hasHistory: false,
      ownerLat: -12.0206,
      ownerLng: -77.0865,
      mobilityPhoneDifferent: true,
      mobilityPhone: "987-654-321",
    });
    const messages = buildBookingMessages(withCoords);
    const main = messages[0];

    expect(main).toContain("*NUEVA RESERVA*");
    expect(main).toContain("Código: VA-TEST1");
    expect(main).toContain("*CLIENTE*");
    expect(main).toContain("Celular alterno: 987-654-321");
    expect(main).toContain("DNI: 12345678");
    expect(main).toContain("Dirección: Av. Proceres 500");
    expect(main).toContain("*RECOJO*");
    expect(main).toContain("Fecha: sábado 10 de octubre de 2026");
    expect(main).toContain("*MASCOTAS*");
    expect(main).toContain("*1. REX*");
    expect(main).toContain("Corte:");
    expect(main).toContain("Corte Rapado");
    expect(main).toContain("Extras:");
    expect(main).toContain("• Antipulgas (Pipeta Fip Forte, 1 mes)");
    expect(main).toContain("Perfume: 🍓 Frutal");
    expect(main).toContain("Observaciones: Cuidado con la oreja");
    expect(main).toContain("*REGISTRO NUEVO*");
    expect(main).toContain("Castrado: No");

    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain("📍 Ubicación en Google Maps:");
    expect(messages[1]).toContain("-12.0206");
  });

  it("no agrega Maps si no hay coordenadas (defensa en profundidad del servidor)", () => {
    const messages = buildBookingMessages(payload());
    expect(messages).toHaveLength(1);
  });

  it("cliente con historial no incluye bloque REGISTRO", () => {
    const messages = buildBookingMessages(payload({ hasHistory: true }));
    expect(messages[0]).not.toContain("REGISTRO");
  });
});

describe("handleBooking", () => {
  const base = { date: "2026-10-10", timeRange: "9-11" as const };

  it("retorna 400 con payload inválido", async () => {
    const result = await handleBooking({ body: { foo: 1 }, env: ENV_FULL, now: NOW });
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
  });

  it("retorna 400 con fecha fuera de ventana", async () => {
    const result = await handleBooking({
      body: payload({ date: "2026-10-01" }),
      env: ENV_FULL,
      now: NOW,
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/pasó/);
  });

  it("retorna 400 sin coordenadas (sin pin en el mapa)", async () => {
    const result = await handleBooking({ body: payload(base), env: ENV_FULL, now: NOW });
    expect(result.status).toBe(400);
  });

  it("retorna 400 fuera del radio de cobertura", async () => {
    const result = await handleBooking({
      body: payload({ ...base, ownerLat: -12.5, ownerLng: -77.5 }),
      env: ENV_FULL,
      now: NOW,
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/cobertura/);
  });

  it("retorna 500 sin configuración de servidor", async () => {
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: {},
      now: NOW,
    });
    expect(result.status).toBe(500);
  });

  it("entrega por Evolution y responde 200 con código", async () => {
    const { fn, calls } = fetchOk();
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, bookingCode: "VA-TEST1" });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("*NUEVA RESERVA*");
    expect(calls[1]).toContain("📍");
  });

  it("reintenta ante fallos de red y entrega al 3er intento", async () => {
    const { fn, calls } = fetchFailingTwice();
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("usa el fallback n8n si no hay Evolution configurada", async () => {
    const { fn, calls } = fetchOk();
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: { VITE_N8N_WEBHOOK_URL: "https://tunnel.example/webhook/booking" },
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("retorna 502 si Evolution falla todos los reintentos", async () => {
    const fn = vi.fn(async () => new Response("{}", { status: 503 }));
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
  });

  it("respaldó en BACKUP_WEBHOOK_URL cuando Evolution falló", async () => {
    const backupCalls: unknown[] = [];
    const fn = vi.fn(async (url: string, init: { body: string }) => {
      if (url.includes("backup")) {
        backupCalls.push(JSON.parse(init.body));
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 503 });
    });
    const result = await handleBooking({
      body: payload({
        ...base,
        ownerLat: -12.0206,
        ownerLng: -77.0865,
      }),
      env: { ...ENV_FULL, BACKUP_WEBHOOK_URL: "https://backup.example" },
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(502);
    expect(backupCalls).toHaveLength(1);
  });
});

describe("sendViaEvolution", () => {
  it("construye POST con apikey y body de Evolution", async () => {
    const seen: Array<{ url: string; init: { headers: Record<string, string>; body: string } }> = [];
    const fn = vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
      seen.push({ url, init });
      return new Response("{}", { status: 200 });
    });
    const ok = await sendViaEvolution(["hola"], ENV_FULL, fn);
    expect(ok.ok).toBe(true);
    expect(seen[0].url).toBe("https://evo.example:10000/message/sendText/celEfrain");
    expect(seen[0].init.headers.apikey).toBe("test-key");
    const parsed = JSON.parse(seen[0].init.body);
    expect(parsed.number).toBe("51986985047");
    expect(parsed.text).toBe("hola");
  });
});
