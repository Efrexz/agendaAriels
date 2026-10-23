import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  findOrderByCode: vi.fn(),
  listStatusUpdatesMany: vi.fn(),
};

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => null),
  LAB_BRANCH_PHONES: { san_miguel: "+51 954 599 221" },
}));

const { default: handler, buildLabStatusResponse } = await import("./_public_status.js");

const order = {
  id: "9eb9cf5e-9e46-4a2c-8a7b-000000000021",
  orderCode: "LAB-ZK9W4",
  status: "en_laboratorio",
  // Campos sensibleis que NUNCA deben salir al público:
  ownerPhone: "917-104-426",
  ownerName: "Juan Prueba",
  doctorName: "Dra. Katherin",
  paidNotes: "S/ 150",
  notes: "pagó en caja",
  labName: "LabVet Centro",
  resultPath: null,
  resultName: null,
  resultPublishedAt: null,
};

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) { return { json(payload: unknown) { entries.push({ s: code, b: payload }); return res; } }; },
  };
  return { res, entries };
}

describe("GET /api/lab-status (estatus público del examen)", () => {
  beforeEach(() => {
    dbMock.findOrderByCode.mockReset();
    dbMock.listStatusUpdatesMany.mockReset();
    dbMock.listStatusUpdatesMany.mockResolvedValue({});
  });

  it("devuelve solo campos seguros (sin teléfono, dueño, médico, notas ni laboratorio)", async () => {
    dbMock.findOrderByCode.mockResolvedValue(order);
    const { status, body } = await buildLabStatusResponse(dbMock as never, order.orderCode);
    expect(status).toBe(200);
    const o = (body as { order: Record<string, unknown> }).order;
    expect(o.orderCode).toBe(order.orderCode);
    expect(o.petName).toBe(order.petName);
    expect(o.status).toBe(order.status);
    expect(JSON.stringify(body)).not.toContain(ownerPhonePattern());
    expect(JSON.stringify(body)).not.toContain("Juan Prueba");
    expect(JSON.stringify(body)).not.toContain("Dra. Katherin");
    expect(JSON.stringify(body)).not.toContain("S/ 150");
    expect(JSON.stringify(body)).not.toContain("LabVet Centro");
  });

  it("incluye la timeline de estados", async () => {
    dbMock.findOrderByCode.mockResolvedValue(order);
    dbMock.listStatusUpdatesMany.mockResolvedValue({
      [order.id]: [{ status: "recibida", createdBy: "vet_ariel@hotmail.com", createdAt: "2026-10-22T10:00:00Z" }],
    });
    const { body } = await buildLabStatusResponse(dbMock as never, order.orderCode);
    const o = (body as { order: { timeline: unknown[] } }).order;
    expect(o.timeline).toHaveLength(1);
  });

  it("404 sin distinción de causa", async () => {
    dbMock.findOrderByCode.mockResolvedValue(null);
    const { status, body } = await buildLabStatusResponse(dbMock as never, "LAB-XXXXX");
    expect(status).toBe(404);
    expect((body as { ok: boolean }).ok).toBe(false);
  });

  it("código mal formado: 400", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "GET", url: "/api/lab-status?code=VA-ABC12", headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 400 });
    expect(dbMock.findOrderByCode).not.toHaveBeenCalled();
  });

  it("código válido llegó al handler y consulta BD", async () => {
    dbMock.findOrderByCode.mockResolvedValue(order);
    const { res, entries } = makeRes();
    await handler({ method: "GET", url: "/api/lab-status?code=lab-zk9w4", headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200 });
    expect(dbMock.findOrderByCode).toHaveBeenCalledWith("LAB-ZK9W4");
  });
});

function ownerPhonePattern(): string {
  return "917-104-426";
}
