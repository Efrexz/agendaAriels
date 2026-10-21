import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  findApptById: vi.fn(),
  listDoctors: vi.fn(),
  listApptsForDoctor: vi.fn(),
  listTimeOff: vi.fn(),
  listDoctorSchedules: vi.fn(),
  getConfig: vi.fn(),
  assignAppt: vi.fn(),
};

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
}));

const { default: handler } = await import("./_assign.js");

const appt = {
  id: "5eb9cf5e-9e46-4a2c-8a7b-000000000001",
  serviceType: "especializada",
  status: "pagado",
  branch: "san_miguel",
  durationMinutes: 0, // citas por asignar guardan 0
};

const doctor = { id: "5eb9cf5e-9e46-4a2c-8a7b-000000000002", active: true, kind: "especialista" };

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) {
      return {
        json(payload: unknown) {
          entries.push({ s: code, b: payload });
          return res;
        },
      };
    },
  };
  return { res, entries };
}

function limaPlus(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" })
    .format(new Date(Date.now() + days * 86_400_000));
}

describe("POST /api/medical/assign (asignación con duración real)", () => {
  beforeEach(() => {
    dbMock.findApptById.mockResolvedValue(appt);
    dbMock.listDoctors.mockResolvedValue([doctor]);
    dbMock.listApptsForDoctor.mockResolvedValue([]);
    dbMock.listTimeOff.mockResolvedValue([]);
    dbMock.listDoctorSchedules.mockResolvedValue([{ weekday: 3, startMinute: 540, endMinute: 780 }]);
    dbMock.getConfig.mockResolvedValue({ appt_duration_minutes: "60" });
    dbMock.assignAppt.mockReset().mockResolvedValue(undefined);
  });

  it("asigna en slot libre y FIJA duration_minutes de config (antes era 0)", async () => {
    const date = limaPlus(1);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    dbMock.listDoctorSchedules.mockResolvedValue([{ weekday, startMinute: 540, endMinute: 780 }]);
    const { res, entries } = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { id: appt.id, doctorId: doctor.id, apptDate: date, startMinute: 540 } },
      res,
    );
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, status: "asignada" } });
    const patch = dbMock.assignAppt.mock.calls[0][1] as { durationMinutes?: number };
    expect(patch.durationMinutes).toBe(60);
  });

  it("bloquea slot ocupado aunque la cita existente tenga duración 0 (bug original)", async () => {
    const date = limaPlus(1);
    dbMock.listApptsForDoctor.mockResolvedValue([{ startMinute: 540, durationMinutes: 0 }]);
    const { res, entries } = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { id: appt.id, doctorId: doctor.id, apptDate: date, startMinute: 540 } },
      res,
    );
    expect(entries[0]?.s).toBe(409);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("rechaza hora fuera del horario semanal del doctor", async () => {
    const date = limaPlus(1);
    const { res, entries } = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { id: appt.id, doctorId: doctor.id, apptDate: date, startMinute: 1340 } },
      res,
    );
    expect(entries[0]?.s).toBe(409);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("rechaza fecha pasada", async () => {
    const { res, entries } = makeRes();
    await handler(
      {
        method: "POST", headers: {},
        body: { id: appt.id, doctorId: doctor.id, apptDate: "2020-01-01", startMinute: 540 },
      },
      res,
    );
    expect(entries[0]?.s).toBe(400);
    expect(dbMock.assignAppt).not.toHaveBeenCalled();
  });

  it("exige pagado (estado solicitud → 409 'verifica el pago')", async () => {
    dbMock.findApptById.mockResolvedValue({ ...appt, status: "solicitud" });
    const { res, entries } = makeRes();
    await handler(
      {
        method: "POST", headers: {},
        body: { id: appt.id, doctorId: doctor.id, apptDate: limaPlus(1), startMinute: 540 },
      },
      res,
    );
    expect(entries[0]?.s).toBe(409);
    expect(JSON.stringify(entries[0]?.b)).toMatch(/pago/i);
  });
});
