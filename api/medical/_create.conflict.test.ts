import { beforeEach, describe, expect, it, vi } from "vitest";
import { MedicalSlotConflictError } from "./errors.js";

const dbMock = vi.hoisted(() => ({
  getConfig: vi.fn(), listDoctors: vi.fn(), listApptsForDoctor: vi.fn(),
  listTimeOff: vi.fn(), listDoctorSchedules: vi.fn(), insertAppointment: vi.fn(),
  recordApptStatus: vi.fn(),
}));

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => dbMock,
  BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  BRANCH_PHONES: { san_miguel: "" },
}));
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => null,
  sendViaEvolution: vi.fn(),
}));

const { handleMedicalCreate, resetMedicalDedupe } = await import("./_create.js");
const doctorId = "5eb9cf5e-9e46-4a2c-8a7b-000000000002";
const body = {
  branch: "san_miguel", serviceType: "general", date: "2026-10-21", startMinute: 540,
  doctorId, petName: "Mascota", petType: "Perro", ownerName: "Cliente Prueba", ownerPhone: "999111222",
};

describe("creación médica ante una reserva simultánea", () => {
  beforeEach(() => {
    resetMedicalDedupe();
    dbMock.getConfig.mockReset().mockResolvedValue({ appt_duration_minutes: "60" });
    dbMock.listDoctors.mockReset().mockResolvedValue([{ id: doctorId, active: true, kind: "general", fullName: "Doctor de prueba" }]);
    dbMock.listApptsForDoctor.mockReset().mockResolvedValue([]);
    dbMock.listTimeOff.mockReset().mockResolvedValue([]);
    dbMock.listDoctorSchedules.mockReset().mockResolvedValue([{ weekday: 3, startMinute: 540, endMinute: 780 }]);
    dbMock.insertAppointment.mockReset();
    dbMock.recordApptStatus.mockReset();
  });

  it("traduce el rechazo atómico de la base a 409, sin crear historial", async () => {
    dbMock.insertAppointment.mockRejectedValue(new MedicalSlotConflictError());
    const result = await handleMedicalCreate({ body, now: new Date("2026-10-20T15:00:00Z") });
    expect(result).toMatchObject({ status: 409, body: { ok: false } });
    expect(dbMock.insertAppointment).toHaveBeenCalledOnce();
    expect(dbMock.recordApptStatus).not.toHaveBeenCalled();
  });

  it("un conflicto de código sigue reintentando y no se confunde con horario ocupado", async () => {
    dbMock.insertAppointment.mockResolvedValueOnce({ code: "23505", id: null }).mockResolvedValueOnce({ code: null, id: "id-prueba" });
    const result = await handleMedicalCreate({ body, now: new Date("2026-10-20T15:00:00Z") });
    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    expect(dbMock.insertAppointment).toHaveBeenCalledTimes(2);
  });
});
