import { describe, it, expect, vi, beforeEach } from "vitest";

const db = {
  insertAppointment: vi.fn(),
  getConfig: vi.fn(),
  listDoctors: vi.fn(),
  recordApptStatus: vi.fn(async () => undefined),
  listApptsForDoctor: vi.fn(async () => []),
  listDoctorSchedules: vi.fn(async () => [{ weekday: 1, startMinute: 540, endMinute: 780 }]),
  listTimeOff: vi.fn(async () => []),
};
const send = vi.fn(async () => true as const);

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
const { handleMedicalCreate, buildNextWeekRequestMessage } = await import("./_create.js");

const base = {
  branch: "san_miguel", serviceType: "general", petName: "Rex QA", petType: "perro",
  ownerName: "Dueño Solicitud QA", ownerPhone: "912345678", ownerEmail: "-", hasOrder: null,
};

describe("solicitud de próxima semana (M2 opción B)", () => {
  beforeEach(() => {
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-prueba.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa-inst");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_DESTINO", "5199999999");
    db.insertAppointment.mockReset().mockResolvedValue({ code: null, id: "id-1" });
    db.getConfig.mockReset().mockResolvedValue({ appt_duration_minutes: "60", payment_info: "-" });
    db.listDoctors.mockReset().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000111", fullName: "Dr. Lunes", active: true, kind: "general", specialtyId: null, specialtyName: null, email: "-", phone: "-" }]);
    send.mockReset().mockResolvedValue({ ok: true as const });
  });

  it("día de la próxima semana: status solicitud, sin hora, aviso honesto y flag requested", async () => {
    const { body, status } = await handleMedicalCreate({ body: { ...base, doctorId: "00000000-0000-4000-8000-000000000111", date: "2026-11-17", startMinute: null }, now: new Date("2026-11-09T15:00:00Z") });
    expect(status).toBe(200);
    expect((body as { requested: boolean }).requested).toBe(true);
    expect(db.insertAppointment.mock.calls[0][0]).toMatchObject({ status: "solicitud", startMinute: null, durationMinutes: 0, doctorId: "00000000-0000-4000-8000-000000000111", apptDate: "2026-11-17" });
    expect(db.recordApptStatus).toHaveBeenCalledWith("id-1", "solicitud", "sistema");
    // El ticket al cliente existe y jamás promete cita confirmada
    const texto = send.mock.calls.find((c) => c[3] === "5199999999")?.[0][0] as string;
    expect(texto).toContain("Solicitud recibida");
    expect(texto).not.toMatch(/Cita\s+(agendada|confirmada)/i);
  });

  it("más allá de la próxima semana: 400 con mensaje de ventana", async () => {
    const { status, body } = await handleMedicalCreate({ body: { ...base, doctorId: "00000000-0000-4000-8000-000000000111", date: "2026-11-23" }, now: new Date("2026-11-09T15:00:00Z") });
    expect(status).toBe(400);
    expect(String((body as { error: string }).error)).toContain("se publica cada lunes");
    expect(db.insertAppointment).not.toHaveBeenCalled();
  });

  it("solicitud con hora se rechaza: la hora la fija el counter", async () => {
    const { status, body } = await handleMedicalCreate({ body: { ...base, doctorId: "00000000-0000-4000-8000-000000000111", date: "2026-11-17", startMinute: 540 }, now: new Date("2026-11-09T15:00:00Z") });
    expect(status).toBe(400);
    expect(String((body as { error: string }).error)).toContain("Deja tu día preferido sin hora");
  });

  it("semana en curso sigue el flujo original confirmada (no cambia)", async () => {
    const hoyISO = "2026-11-09";
    const { body } = await handleMedicalCreate({ body: { ...base, doctorId: "00000000-0000-4000-8000-000000000111", date: hoyISO, startMinute: 660 }, now: new Date(new Date("2026-11-09T17:03:00Z").getTime()) });
    console.log("DEBUG-BODY", JSON.stringify(body));
    expect((body as { requested: boolean }).requested).toBe(false);
    expect(db.insertAppointment.mock.calls[0][0]).toMatchObject({ status: "confirmada" });
  });
});

describe("mensaje al cliente", () => {
  it("no usa lenguaje de cita confirmada", () => {
    const t = buildNextWeekRequestMessage({ ownerName: "Ana", petName: "Rex" }, "CM-QAW1", { doctor: "Dr. Lunes" });
    expect(t).toContain("CM-QAW1");
    expect(t).not.toMatch(/confirmad/i);
  });
});
