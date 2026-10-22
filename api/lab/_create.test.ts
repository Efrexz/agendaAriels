import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  insertOrder: vi.fn(),
  recordOrderStatus: vi.fn(async () => undefined),
};
const sendMock = vi.fn(async () => ({ ok: true as const }));

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
  isLabBranch: (v: string) => ["san_martin", "los_olivos", "san_miguel"].includes(v),
  LAB_BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  formatPhoneForDb: (p: string) => {
    const digits = p.replace(/\D/g, "").replace(/^51/, "").slice(-9);
    return digits.length === 9 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : p;
  },
}));

vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "51917104426",
  sendViaEvolution: sendMock,
}));

const { default: handler } = await import("./_create.js");

const payload = {
  sedeResponsable: "san_miguel",
  sedeOrigen: "los_olivos",
  labName: "LabVet Centro",
  examType: "Perfil prequirúrgico",
  petName: "Boby",
  ownerName: "Juan Prueba",
  ownerPhone: "917104426",
};

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) { return { json(payload: unknown) { entries.push({ s: code, b: payload }); return res; } }; },
  };
  return { res, entries };
}

describe("POST /api/internal/lab/create", () => {
  beforeEach(() => {
    process.env.EVOLUTION_DRY_RUN = "true";
    dbMock.insertOrder.mockReset();
    dbMock.insertOrder.mockResolvedValue({ code: null, id: "5eb9cf5e-9e46-4a2c-8a7b-000000000012" });
    dbMock.recordOrderStatus.mockClear();
    sendMock.mockClear();
  });

  it("feliz: insert + timeline + WhatsApp con código LAB-", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: payload }, res);
    expect(entries[0]).toMatchObject({ s: 200 });
    const body = entries[0].b as { ok: boolean; orderCode: string; notified: boolean };
    expect(body.ok).toBe(true);
    expect(body.orderCode).toMatch(/^LAB-[A-Z0-9]{5}$/);
    expect(dbMock.insertOrder).toHaveBeenCalledOnce();
    expect(dbMock.recordOrderStatus).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0][0] as string).toContain(body.orderCode);
    expect(body.notified).toBe(true);
  });

  it("teléfono demasiado corto: 400 sin insertar", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...payload, ownerPhone: "12" } }, res);
    expect(entries[0]).toMatchObject({ s: 400 });
    expect(dbMock.insertOrder).not.toHaveBeenCalled();
  });

  it("petName corto: 400", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...payload, petName: "B" } }, res);
    expect(entries[0]).toMatchObject({ s: 400 });
  });

  it("23505 en código: reintenta con otro código y registra igual", async () => {
    let calls = 0;
    dbMock.insertOrder.mockImplementation(async () => {
      calls += 1;
      return calls === 1
        ? { code: "23505" as const, id: null }
        : { code: null, id: "5eb9cf5e-9e46-4a2c-8a7b-000000000013" };
    });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...payload, petName: "Rocky" } }, res);
    expect((entries[0].b as { ok: boolean }).ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("dedupe 60s: segunda petición idéntica devuelve el mismo código sin reinsertar", async () => {
    const p = { ...payload, petName: "Luna" };
    const first = await (async () => {
      const { res, entries } = makeRes();
      await handler({ method: "POST", headers: {}, body: p }, res);
      return (entries[0].b as { orderCode: string }).orderCode;
    })();
    const second = await (async () => {
      const { res, entries } = makeRes();
      await handler({ method: "POST", headers: {}, body: p }, res);
      return (entries[0].b as { orderCode: string }).orderCode;
    })();
    expect(second).toBe(first);
    expect(dbMock.insertOrder).toHaveBeenCalledOnce();
  });
});
