import { describe, it, expect, vi, beforeEach } from "vitest";
import { MedicalSlotConflictError } from "./errors.js";

const dbMock = {
  findApptById: vi.fn(),
  transitionApptStatus: vi.fn(),
};
const sendMock = vi.fn(async () => ({ ok: true as const }));

vi.mock("./db.js", () => ({
  isValidMedicalStatus: (s: string) =>
    ["solicitud", "pagado", "asignada", "confirmada", "en_consulta", "atendida", "no_llego", "cancelado"].includes(s),
  default: undefined,
}));

vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "51917104426",
  sendViaEvolution: sendMock,
}));

vi.mock("./slots.js", () => ({ minuteToTime: (m: number) => `${Math.floor(m / 60)}:00` }));

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
  BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  BRANCH_PHONES: { san_miguel: "51954599221" },
}));

const { default: handler } = await import("./_status.js");

const appt = {
  id: "5eb9cf5e-9e46-4a2c-8a7b-000000000001",
  status: "asignada",
  ownerPhone: "999777666",
  branch: "san_miguel",
  doctorName: "Dr. Especialista",
  specialtyName: "Cardiología",
  petName: "Kira",
  ownerName: "Rosa Quispe",
  appointmentCode: "CM-AAAAA",
  needsOrder: false,
  apptDate: "2026-10-22",
  startMinute: 600,
};

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

describe("PATCH /api/medical/status (estados médicos)", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_URL = "https://evo.test";
    process.env.EVOLUTION_API_KEY = "k";
    process.env.EVOLUTION_INSTANCE = "inst";
    dbMock.findApptById.mockResolvedValue(appt);
    dbMock.transitionApptStatus.mockReset();
    sendMock.mockClear();
  });

  it("confirmada ganada: registra y envía WhatsApp de confirmación", async () => {
    dbMock.transitionApptStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: appt.id, status: "confirmada" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: true } });
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("carrera perdida: informa conflicto sin notificación", async () => {
    dbMock.transitionApptStatus.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: appt.id, status: "confirmada" } }, res);
    expect(entries[0]).toMatchObject({ s: 409, b: { ok: false } });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("mismo estado repetido: no notifica ni re-timeline", async () => {
    dbMock.findApptById.mockResolvedValue({ ...appt, status: "confirmada" });
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: appt.id, status: "confirmada" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(dbMock.transitionApptStatus).not.toHaveBeenCalled();
  });

  it("estado de tránsito (en_consulta): guarda sin WhatsApp", async () => {
    dbMock.transitionApptStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: appt.id, status: "en_consulta" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("si otro registro ocupa el horario, no reactiva ni notifica", async () => {
    dbMock.findApptById.mockResolvedValue({ ...appt, status: "cancelado" });
    dbMock.transitionApptStatus.mockRejectedValue(new MedicalSlotConflictError());
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: appt.id, status: "confirmada" } }, res);
    expect(entries[0]).toMatchObject({ s: 409, b: { ok: false } });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// Feedback 17/11 del dueño: la tolerancia y su consecuencia dependen del tipo
// de consulta (general: entra el siguiente; especializada: agenda reservada
// del doctor externo + regla de 24h con penalización).
const { buildConfirmationMessage } = await import("./_status.js");

describe("buildConfirmationMessage — tolerancia por tipo de consulta", () => {
  const base = {
    apptDate: "2026-11-20",
    startMinute: 540,
    branchLabel: "Sede San Miguel",
    doctorName: "Dr. Ejemplo",
    specialtyName: null,
    petName: "Kira",
    ownerName: "Rosa Quispe",
    appointmentCode: "CM-TOL01",
    needsOrder: false,
    branchPhone: "51954599221",
  };

  it("GENERAL: tolerancia 10 min + se atiende al siguiente en espera", () => {
    const msg = buildConfirmationMessage(base);
    expect(msg).toContain("tolerancia es de 10 minutos y luego atendemos al siguiente en espera");
    expect(msg).not.toContain("penalización");
  });

  it("ESPECIALIZADA: agenda reservada del externo + regla de 24h con penalización", () => {
    const msg = buildConfirmationMessage({ ...base, specialtyName: "Cardiología" });
    expect(msg).toContain("tolerancia es de 10 minutos");
    expect(msg).toContain("reserva un espacio en su agenda");
    expect(msg).toContain("24 horas de anticipación");
    expect(msg).toContain("penalización");
    expect(msg).not.toContain("atendemos al siguiente");
  });
});
