import { describe, it, expect, vi, beforeEach } from "vitest";

// M1 honestidad de WhatsApp en la creación de citas: la respuesta del wizard
// DEBE reflejar la entrega real (verde solo con entrega confirmada) y el
// historial debe marcar el aviso (wa_entregado/wa_fallado) cuando Evolution
// está configurada de verdad; el dry-run no marca.

const db = {
  insertAppointment: vi.fn(),
  getConfig: vi.fn(),
  listDoctors: vi.fn(),
  recordApptStatus: vi.fn(async () => undefined),
  recordWhatsappNotice: vi.fn(async () => undefined),
  listApptsForDoctor: vi.fn(async () => []),
  listDoctorSchedules: vi.fn(async () => [{ weekday: 1, startMinute: 540, endMinute: 780 }]),
  listTimeOff: vi.fn(async () => []),
};
const send = vi.fn();

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => db,
  BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  BRANCH_PHONES: { san_miguel: "519999999" },
  notConfigured: () => false,
}));
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "5199999999",
  sendViaEvolution: send,
}));
vi.mock("../lib-lima.js", () => ({ getLimaDayKey: (d?: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d ?? new Date()) }));
vi.mock("./slots.js", async (load) => ({
  ...(await load<typeof import("./slots.js")>()),
  currentMinuteLima: () => 600,
  weekdayOf: (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay(),
}));
const { handleMedicalCreate, resetMedicalDedupe } = await import("./_create.js");

// Lunes en curso (mocked now), dentro del horario 9:00–13:00 y después de la
// hora mínima simulada (10:30am).
const AHORA = new Date("2026-11-09T15:00:00Z");
const dedupeSafe = () => ({ ...body, petName: "Rex QA " + Math.random().toString(36).slice(2, 7) });
const body = {
  branch: "san_miguel", serviceType: "general", petName: "Rex QA", petType: "perro",
  ownerName: "Dueño QA", ownerPhone: "912345678", ownerEmail: "-", hasOrder: null,
  doctorId: "00000000-0000-4000-8000-000000000111", date: "2026-11-09", startMinute: 660,
};

describe("honestidad de entrega de WhatsApp en creación (M1)", () => {
  beforeEach(() => {
    resetMedicalDedupe(); // cada test es una intención nueva (el dedupe vivía entre tests)
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-prueba.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa-inst");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_DESTINO", "5199999999");
    db.insertAppointment.mockReset().mockResolvedValue({ code: null, id: "id-1" });
    db.getConfig.mockReset().mockResolvedValue({ appt_duration_minutes: "60", payment_info: "-" });
    db.listDoctors.mockReset().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000111", fullName: "Dr. Lunes", active: true, kind: "general", specialtyId: null, specialtyName: null, email: "-", phone: "-" }]);
    db.recordWhatsappNotice.mockReset().mockResolvedValue(undefined);
    db.recordApptStatus.mockReset().mockResolvedValue(undefined);
  });

  it("Evolution entrega → whatsappDelivered:true y marca wa_entregado", async () => {
    send.mockResolvedValue({ ok: true as const });
    const r = await handleMedicalCreate({ body: dedupeSafe(), now: AHORA });
    expect(r.status).toBe(200);
    expect((r.body as { whatsappDelivered?: boolean }).whatsappDelivered).toBe(true);
    expect(db.recordWhatsappNotice).toHaveBeenCalledWith("id-1", true);
  });

  it("Evolution CAÍDA (502) → whatsappDelivered:false y marca wa_fallado (el verde no miente)", async () => {
    send.mockResolvedValue({ ok: false as const, error: "código 502" });
    const r = await handleMedicalCreate({ body: dedupeSafe(), now: AHORA });
    expect(r.status).toBe(200);
    expect((r.body as { whatsappDelivered?: boolean }).whatsappDelivered).toBe(false);
    expect(db.recordWhatsappNotice).toHaveBeenCalledWith("id-1", false);
  });

  it("dry-run responde entregado pero NO marca en el historial", async () => {
    vi.stubEnv("EVOLUTION_DRY_RUN", "true");
    send.mockResolvedValue({ ok: true as const });
    const r = await handleMedicalCreate({ body: dedupeSafe(), now: AHORA });
    expect((r.body as { whatsappDelivered?: boolean }).whatsappDelivered).toBe(true);
    expect(db.recordWhatsappNotice).not.toHaveBeenCalled();
  });

  it("Evolution sin configurar → flag null y sin marca", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "");
    vi.stubEnv("EVOLUTION_API_KEY", "");
    vi.stubEnv("EVOLUTION_INSTANCE", "");
    const r = await handleMedicalCreate({ body: dedupeSafe(), now: AHORA });
    expect(r.status).toBe(200);
    expect((r.body as { whatsappDelivered?: boolean }).whatsappDelivered).toBeNull();
    expect(db.recordWhatsappNotice).not.toHaveBeenCalled();
  });

  it("la marca fallida (best-effort) NO rompe la respuesta de la cita", async () => {
    send.mockResolvedValue({ ok: true as const });
    db.recordWhatsappNotice.mockRejectedValue(new Error("insert falló"));
    const r = await handleMedicalCreate({ body: dedupeSafe(), now: AHORA });
    expect(r.status).toBe(200);
    expect((r.body as { whatsappDelivered?: boolean }).whatsappDelivered).toBe(true);
  });
});
