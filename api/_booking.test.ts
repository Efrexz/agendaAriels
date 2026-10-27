import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bookingPayloadSchema,
  buildBookingMessages,
  buildClientReceiptMessage,
  buildShortVetMessage,
  handleBooking,
  normalizePhoneDest,
  resetBookingDedupe,
  sendViaEvolution,
  validateScheduleWindow,
  type BookingEnv,
  type BookingPayload,
} from "./_booking";
import type { BookingDb, BookingRecord } from "./db";

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
  const calls: Array<{ number: string; text: string }> = [];
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    const parsed = JSON.parse(init.body) as { number: string; text: string };
    calls.push(parsed);
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

  it("acepta teléfono placeholder '-' (cliente recurrente sin celular nuevo)", () => {
    expect(bookingPayloadSchema.parse(payload({ ownerPhone: "-" })).ownerPhone).toBe("-");
  });

  it("rechaza teléfono corto que no sea placeholder", () => {
    expect(bookingPayloadSchema.safeParse(raw({ ownerPhone: "99" })).success).toBe(false);
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

  beforeEach(() => {
    resetBookingDedupe();
  });

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
    // 2 mensajes a la veterinaria (resumen + Maps) + comprobante al cliente
    expect(calls).toHaveLength(3);
    expect(calls[0].text).toContain("*NUEVA RESERVA*");
    expect(calls[0].number).toBe("51986985047");
    expect(calls[1].text).toContain("📍");
    expect(calls[2].number).toBe("51999123456");
    expect(calls[2].text).toContain("¡Reserva registrada, Juan!");
    expect(calls[2].text).toContain("VA-TEST1");
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
    // main (3er intento) + Maps + comprobante al cliente
    expect(calls).toHaveLength(3);
  });

  it("devuelve el mismo código si la misma reserva llega dos veces en 60s (sin reenvío)", async () => {
    const { fn, calls } = fetchOk();
    const body = payload({ ...base, ownerLat: -12.0206, ownerLng: -77.0865 });
    const first = await handleBooking({ body, env: ENV_FULL, now: NOW, fetcher: fn });
    expect(first.status).toBe(200);

    // Doble click: distinto bookingCode (se genera nuevo), mismos datos clave
    const again = await handleBooking({ body: payload({ ...base, ownerLat: -12.0206, ownerLng: -77.0865 }), env: ENV_FULL, now: NOW, fetcher: fn });
    expect(again.status).toBe(200);
    expect(again.body.bookingCode).toBe(first.body.bookingCode);
    // No se volvió a enviar nada a la veterinaria
    expect(calls).toHaveLength(3);
  });

  it("pasado el dedupe de 60s permite reservar de nuevo normalmente", async () => {
    const { fn, calls } = fetchOk();
    const body = payload({ ...base, ownerLat: -12.02, ownerLng: -77.08 });
    await handleBooking({ body, env: ENV_FULL, now: NOW, fetcher: fn });
    const later = await handleBooking({ body, env: ENV_FULL, now: new Date(NOW.getTime() + 120_000), fetcher: fn });
    expect(later.status).toBe(200);
    expect(calls.length).toBeGreaterThan(3);
  });

  it("CLIENT_COPY_ENABLED=false omite el comprobante al cliente", async () => {
    const { fn, calls } = fetchOk();
    const result = await handleBooking({
      body: payload({ ...base, ownerLat: -12.0206, ownerLng: -77.0865 }),
      env: { ...ENV_FULL, CLIENT_COPY_ENABLED: "false" },
      now: NOW,
      fetcher: fn,
    });
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.number === "51986985047")).toBe(true);
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

  it("retorna 502 si Evolution falla todos los reintentos (sin BD: no hay dónde guardar)", async () => {
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

  it("BD-OK + Evolution caído → 200 suave con whatsappDelivered:false (sin duplicados)", async () => {
    const db: BookingDb = {
      isClosed: vi.fn(async () => false),
      insertBooking: vi.fn(async () => ({ code: "00000" })),
      findByCode: vi.fn(async () => null),
      recordStatus: vi.fn(),
      setWhatsappDelivered: vi.fn(),
    } as unknown as BookingDb;
    void db.recordStatus; void db.setWhatsappDelivered;
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
      db,
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.whatsappDelivered).toBe(false);
    expect(result.body.bookingCode).toBe("VA-TEST1");
  });

  it("23505 (duplicado web) + WhatsApp caído + BD-OK → también 200 suave", async () => {
    const db: BookingDb = {
      isClosed: vi.fn(async () => false),
      insertBooking: vi.fn(async () => ({ code: "23505" })),
      findByCode: vi.fn(async () => ({ id: "x", whatsappDelivered: false }) as unknown as BookingRecord),
      recordStatus: vi.fn(),
      setWhatsappDelivered: vi.fn(),
    } as unknown as BookingDb;
    void db.recordStatus; void db.setWhatsappDelivered;
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
      db,
    });
    expect(result.status).toBe(200);
    expect(result.body.whatsappDelivered).toBe(false);
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

  it("respeta el destino explícito (comprobante al cliente)", async () => {
    const seen: Array<{ init: { body: string } }> = [];
    const fn = vi.fn(async (_url: string, init: { body: string }) => {
      seen.push({ init });
      return new Response("{}", { status: 200 });
    });
    await sendViaEvolution(["hola"], ENV_FULL, fn, "51999123456");
    expect(JSON.parse(seen[0].init.body).number).toBe("51999123456");
  });

  it("EVOLUTION_DRY_RUN imprime el mensaje en consola y responde ok", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    const { fn, calls } = fetchOk();
    const ok = await sendViaEvolution(["mensaje de prueba"], { ...ENV_FULL, EVOLUTION_DRY_RUN: "true" }, fn);
    spy.mockRestore();
    expect(ok.ok).toBe(true);
    expect(calls).toHaveLength(0);
    expect(logs.join("\n")).toContain("mensaje de prueba");
    expect(logs.join("\n")).toContain("[booking][DRY-RUN]");
  });
});

describe("normalizePhoneDest", () => {
  it("agrega código de país a un celular de 9 dígitos", () => {
    expect(normalizePhoneDest("999-123-456")).toBe("51999123456");
  });

  it("acepta teléfono ya con código de país", () => {
    expect(normalizePhoneDest("+51 999 123 456")).toBe("51999123456");
    expect(normalizePhoneDest("51999123456")).toBe("51999123456");
  });

  it("devuelve null para teléfonos no reconocibles", () => {
    expect(normalizePhoneDest("123")).toBeNull();
    expect(normalizePhoneDest("")).toBeNull();
  });
});

describe("buildClientReceiptMessage", () => {
  it("contiene los datos clave del comprobante", () => {
    const msg = buildClientReceiptMessage(payload());
    expect(msg).toContain("¡Reserva registrada, Juan!");
    expect(msg).toContain("sábado 10 de octubre de 2026");
    expect(msg).toContain("9:00 am – 11:00 am");
    expect(msg).toContain("Sede San Martín de Porres");
    expect(msg).toContain("🐾 Rex – Baño + Corte");
    expect(msg).toContain("Av. Proceres 500");
    expect(msg).toContain("VA-TEST1");
    expect(msg).toContain("+51 986 985 047");
  });
  it("lista todas las mascotas", () => {
    const dos = payload({ pets: [raw().pets, raw().pets].flat() as never });
    const msg = buildClientReceiptMessage(dos);
    const petLines = msg.split("\n").filter((l) => l.startsWith("🐾 ") && l.includes("–"));
    expect(petLines).toHaveLength(2);
  });
  it("con trackingUrl agrega el link de seguimiento", () => {
    const msg = buildClientReceiptMessage(payload(), "https://app.example/estado");
    expect(msg).toContain("en tiempo real");
    expect(msg).toContain("https://app.example/estado");
  });
  it("sin trackingUrl no menciona seguimiento", () => {
    expect(buildClientReceiptMessage(payload())).not.toContain("en tiempo real");
  });
});

describe("buildShortVetMessage", () => {
  it("mensaje corto con código, sede, fecha y mascotas", () => {
    const msg = buildShortVetMessage(payload());
    expect(msg).toContain("NUEVA RESERVA");
    expect(msg).toContain("VA-TEST1");
    expect(msg).toContain("Sede San Martín de Porres");
    expect(msg).toContain("sábado 10 de octubre de 2026");
    expect(msg).toContain("1 mascota: Rex");
    expect(msg).not.toContain("DNI");
    expect(msg).not.toContain("Av. Proceres 500");
  });
  it("incluye el link del panel cuando se pasa la URL", () => {
    const msg = buildShortVetMessage(payload(), "https://app.example/internal");
    expect(msg).toContain("panel interno");
    expect(msg).toContain("https://app.example/internal");
  });
});

// ── Fake de BookingDb para los tests de persistencia ─────────

function fakeDb(overrides: Partial<BookingDb> = {}): BookingDb & { calls: string[] } {
  const calls: string[] = [];
  const record: BookingRecord = {
    id: "test-id",
    bookingCode: "VA-TEST1",
    branch: "san_martin",
    branchLabel: "Sede San Martín de Porres",
    serviceDate: "2026-10-10",
    timeSlot: "9-11",
    ownerName: "Juan Pérez",
    ownerDni: "12345678",
    ownerPhone: "999-123-456",
    ownerEmail: "-",
    ownerAddress: "Av. Proceres 500",
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
    pets: [],
    status: "pendiente",
    createdAt: NOW.toISOString(),
    whatsappDelivered: false,
  };
  return {
    calls,
    insertBooking: vi.fn(async () => {
      calls.push("insert");
      return { code: null };
    }),
    findByCode: vi.fn(async () => {
      calls.push("findByCode");
      return record;
    }),
    listClosures: vi.fn(async () => []),
    isClosed: vi.fn(async () => {
      calls.push("isClosed");
      return false;
    }),
    recordStatus: vi.fn(async () => {}),
    transitionStatus: vi.fn(async () => {
      calls.push("transition");
      return true;
    }),
    countBookingsFor: vi.fn(async () => 0),
    setWhatsappDelivered: vi.fn(async () => {
      calls.push("delivered");
    }),
    listStatusUpdates: vi.fn(async () => []),
    listUpdatesForBookings: vi.fn(async () => []),
    findById: vi.fn(async () => record),
    searchBookings: vi.fn(async () => []),
    createClosure: vi.fn(async () => ({ code: null })),
    deleteClosure: vi.fn(async () => {}),
    listClosuresBetween: vi.fn(async () => []),
    ...overrides,
  } as BookingDb & { calls: string[] };
}

describe("handleBooking con BD", () => {
  const base = { date: "2026-10-10", timeRange: "9-11" as const };
  const coords = { ownerLat: -12.0206, ownerLng: -77.0865 };

  beforeEach(() => {
    resetBookingDedupe();
  });

  it("guarda la reserva ANTES de enviar el WhatsApp", async () => {
    const { fn } = fetchOk();
    const db = fakeDb();
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
      db,
    });
    expect(result.status).toBe(200);
    expect(db.calls).toEqual(["isClosed", "insert", "findByCode", "delivered"]);
  });

  it("rechaza con 400 si el día/franja está cerrado", async () => {
    const db = fakeDb();
    db.isClosed = vi.fn(async () => {
      db.calls.push("isClosed");
      return true;
    });
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fetchOk().fn,
      db,
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/disponibilidad/);
    expect(db.calls).toEqual(["isClosed"]);
  });

  it("código duplicado con aviso YA entregado: 200 sin reenviar a la veterinaria", async () => {
    const { fn, calls } = fetchOk();
    const db = fakeDb({
      insertBooking: vi.fn(async () => ({ code: "23505" as const })),
      findByCode: vi.fn(async () => ({
        id: "test-id",
        whatsappDelivered: true,
      } as unknown as BookingRecord)),
    } as Partial<BookingDb>);
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
      db,
    });
    expect(result.status).toBe(200);
    expect(result.body.bookingCode).toBe("VA-TEST1");
    expect(calls).toHaveLength(0); // nada enviado
  });

  it("código duplicado con aviso NO entregado: reenvía a la veterinaria", async () => {
    const { fn, calls } = fetchOk();
    const db = fakeDb({
      insertBooking: vi.fn(async () => ({ code: "23505" as const })),
    });
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
      db,
    });
    expect(result.status).toBe(200);
    expect(calls.length).toBeGreaterThanOrEqual(1); // se reenviaron los mensajes
    expect(db.calls).toContain("delivered"); // y quedó marcado como entregado
  });

  it("BD caída: la reserva sigue por WhatsApp (comportamiento anterior)", async () => {
    const { fn, calls } = fetchOk();
    const db = fakeDb({
      insertBooking: vi.fn(async () => {
        throw new Error("supabase down");
      }),
    });
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: ENV_FULL,
      now: NOW,
      fetcher: fn,
      db,
    });
    warn.mockRestore();
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(3); // flujo completo por WhatsApp
  });

  it("VET_MESSAGE_MODE=short envía un solo mensaje corto a la veterinaria", async () => {
    const { fn, calls } = fetchOk();
    const result = await handleBooking({
      body: payload({ ...base, ...coords }),
      env: { ...ENV_FULL, VET_MESSAGE_MODE: "short", INTERNAL_PANEL_URL: "https://app.example/internal" },
      now: NOW,
      fetcher: fn,
      db: fakeDb(),
    });
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(2); // corto + comprobante del cliente
    expect(calls[0].text).toContain("panel interno");
    expect(calls[0].text).not.toContain("DNI");
  });

  it("TRACKING_ENABLED=true agrega el link de seguimiento al comprobante", async () => {
    const { fn, calls } = fetchOk();
    await handleBooking({
      body: payload({ ...base, ...coords }),
      env: { ...ENV_FULL, TRACKING_ENABLED: "true" },
      now: NOW,
      fetcher: fn,
      origin: "https://app.example",
      db: fakeDb(),
    });
    const receipt = calls[calls.length - 1];
    expect(receipt.number).toBe("51999123456");
    expect(receipt.text).toContain("https://app.example/estado");
  });
});
