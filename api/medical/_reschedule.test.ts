import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del endpoint /api/medical/reschedule: cambia horario (y doctor) de
// una cita CONFIRMADA con las mismas candadas de la asignación; el envío de
// WhatsApp es best-effort y registra su entrega.

const apptMock = {
  id: "00000000-0000-4000-8000-0000000000CC",
  status: "confirmada",
  branch: "san_miguel",
  serviceType: "general",
  ownerPhone: "999111222",
  ownerName: "Juan Pérez",
  petName: "Rex",
  specialtyName: null,
  doctorId: "11111111-1111-4111-8111-111111111111",
  apptDate: "2026-11-20",
  startMinute: 540,
  durationMinutes: 60,
  appointmentCode: "CM-TEST1",
};

const dbMock = {
  findApptById: vi.fn(async () => apptMock),
  listDoctors: vi.fn(async () => [
    { id: "11111111-1111-4111-8111-111111111111", fullName: "Dr. Uno", branch: "san_miguel", kind: "general", active: true },
    { id: "22222222-2222-4222-8222-222222222222", fullName: "Dr. Dos", branch: "san_miguel", kind: "general", active: true },
  ]),
  getConfig: vi.fn(async () => ({ appt_duration_minutes: "60" })),
  listDoctorSchedules: vi.fn(async () => [{ weekday: 5, startMinute: 540, endMinute: 780 }]),
  listBusyForDoctor: vi.fn(async () => []),
  listTimeOff: vi.fn(async () => []),
  assignAppt: vi.fn(async () => true),
  recordApptStatus: vi.fn(async () => undefined),
  recordWhatsappNotice: vi.fn(async () => undefined),
};

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => dbMock,
  notConfigured: () => false,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
  BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  BRANCH_PHONES: { san_miguel: "+51 999 000 000" },
}));

const sendViaEvolution = vi.fn(async () => ({ ok: true }) as const);
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: (v: string) => v,
  sendViaEvolution,
}));

// getLimaDayKey / slots: hoy fijo "2026-11-16" (viernes) para determinismo.
vi.mock("../lib-lima.js", () => ({ getLimaDayKey: () => "2026-11-16" }));
vi.mock("./slots.js", () => ({
  currentMinuteLima: () => 480,
  weekdayOf: (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay(),
}));

const { default: handler } = await import("./_reschedule.js");

function call(body: unknown) {
  const out: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
      return res;
    },
  };
  return handler({ method: "PATCH", headers: {}, body }, res as never).then(() => out);
}

const NEW = { id: apptMock.id, doctorId: "22222222-2222-4222-8222-222222222222", apptDate: "2026-11-20", startMinute: 600 };

describe("/api/medical/reschedule", () => {
  beforeEach(() => {
    for (const m of Object.values(dbMock)) if (vi.isMockFunction(m)) m.mockClear();
    sendViaEvolution.mockClear();
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-qa.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    Object.assign(apptMock, { status: "confirmada", apptDate: "2026-11-20", startMinute: 540, doctorId: "11111111-1111-4111-8111-111111111111" });
  });

  it("mueve la cita, registra 'reprogramada' y avisa por WhatsApp", async () => {
    const r = await call(NEW);
    expect(r.status).toBe(200);
    expect(dbMock.assignAppt).toHaveBeenCalledWith(
      apptMock.id,
      expect.objectContaining({ apptDate: "2026-11-20", startMinute: 600 }),
      "vet_ariel@hotmail.com",
      null,
      "confirmada",
    );
    expect(dbMock.recordApptStatus).toHaveBeenCalledWith(apptMock.id, "reprogramada", "vet_ariel@hotmail.com");
    expect(sendViaEvolution).toHaveBeenCalledTimes(1);
    const text = sendViaEvolution.mock.calls[0][0][0] as string;
    expect(text).toMatch(/Cambiamos el horario/i);
    expect(text).toMatch(/Nueva cita/i);
    expect(dbMock.recordWhatsappNotice).toHaveBeenCalledWith(apptMock.id, true);
  });

  it("rechaza citas que no están confirmadas (409)", async () => {
    apptMock.status = "en_consulta";
    const r = await call(NEW);
    expect(r.status).toBe(409);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("rechaza no-op (mismo horario y doctor)", async () => {
    const r = await call({ ...NEW, doctorId: apptMock.doctorId, startMinute: 540 });
    expect(r.status).toBe(400);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("rechaza hora fuera del horario del doctor (409)", async () => {
    const r = await call({ ...NEW, startMinute: 900 }); // horario 9:00–13:00
    expect(r.status).toBe(409);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("rechaza solapamiento con OTRA cita (409) y no avisa", async () => {
    dbMock.listBusyForDoctor.mockResolvedValueOnce([{ id: "otra", startMinute: 590, durationMinutes: 60 }]);
    const r = await call(NEW);
    expect(r.status).toBe(409);
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it("moverla sobre sí misma NO es conflicto (excluye la propia cita)", async () => {
    // 540→560 se cruzan consigo misma: el mock de busy excluye por id.
    const r = await call({ ...NEW, doctorId: apptMock.doctorId, startMinute: 560 });
    expect(r.status).toBe(200);
    expect(dbMock.listBusyForDoctor).toHaveBeenCalledWith(apptMock.doctorId, "2026-11-20", apptMock.id);
  });

  it("rechaza doctor de tipo incorrecto para el servicio (400)", async () => {
    apptMock.serviceType = "especializada";
    const r = await call(NEW); // Dr. Dos es kind general
    expect(r.status).toBe(400);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });
});
