import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  findOrderById: vi.fn(),
  transitionOrderStatus: vi.fn(),
};
const sendMock = vi.fn(async () => ({ ok: true as const }));

vi.mock("./db.js", () => ({
  isValidLabStatus: (s: string) =>
    ["recibida", "en_laboratorio", "resultado_listo", "entregada", "cancelado"].includes(s),
  default: undefined,
}));

vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "51917104426",
  sendViaEvolution: sendMock,
}));

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
  LAB_BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
}));

const { default: handler } = await import("./_status.js");

const order = {
  id: "9eb9cf5e-9e46-4a2c-8a7b-000000000011", // uuid v4 válido (zod v4 exige nibbles correctos)
  orderCode: "LAB-K6TQ2",
  status: "en_laboratorio",
  ownerPhone: "917-104-426",
  petName: "Boby",
  examType: "Perfil prequirúrgico",
  labName: "LabVet Centro",
  ownerName: "Juan Prueba",
  sedeResponsable: "san_miguel",
  createdAt: "2026-10-22T10:00:00Z",
  updatedAt: "2026-10-22T11:00:00Z",
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

describe("PATCH /api/internal/lab/status (estados laboratorio)", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_URL = "https://evo.test";
    process.env.EVOLUTION_API_KEY = "k";
    process.env.EVOLUTION_INSTANCE = "inst";
    dbMock.findOrderById.mockClear();
    dbMock.findOrderById.mockResolvedValue(order);
    dbMock.transitionOrderStatus.mockReset();
    sendMock.mockClear();
  });

  it("resultado_listo ganado: registra y envía WhatsApp al dueño", async () => {
    dbMock.transitionOrderStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "resultado_listo" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: true } });
    expect(sendMock).toHaveBeenCalledOnce();
    const text = sendMock.mock.calls[0][0][0] as string;
    expect(text).toContain("LAB-K6TQ2");
    expect(text).toContain("Boby");
  });

  it("carrera perdida: sin notificación y stale", async () => {
    dbMock.transitionOrderStatus.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "resultado_listo" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false, stale: true } });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("mismo estado repetido: no transition ni notifica", async () => {
    dbMock.findOrderById.mockResolvedValue({ ...order, status: "resultado_listo" });
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "resultado_listo" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(dbMock.transitionOrderStatus).not.toHaveBeenCalled();
  });

  it("transition sin WhatsApp (en_laboratorio)", async () => {
    dbMock.transitionOrderStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "en_laboratorio" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("estado desconocido: 400 sin tocar BD", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "en_camino" } }, res);
    expect(entries[0]).toMatchObject({ s: 400 });
    expect(dbMock.findOrderById).not.toHaveBeenCalled();
  });

  it("orden no existe: 404", async () => {
    dbMock.findOrderById.mockResolvedValue(null);
    const { res, entries } = makeRes();
    await handler({ method: "PATCH", headers: {}, body: { id: order.id, status: "entregada" } }, res);
    expect(entries[0]).toMatchObject({ s: 404 });
  });
});
