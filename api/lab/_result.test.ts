import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db.js", () => ({
  default: undefined,
}));

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet@clinic.com" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed.test/x?sig=1" }, error: null })),
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  })),
}));

const dbMock = {
  findOrderById: vi.fn(),
  setResultFile: vi.fn(async () => undefined),
  clearResultFile: vi.fn(async () => undefined),
};

const { default: handler } = await import("./_result.js");

const orderId = "9eb9cf5e-9e46-4a2c-8a7b-000000000031";

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) { return { json(payload: unknown) { entries.push({ s: code, b: payload }); return res; } }; },
  };
  return { res, entries };
}

const UPLOAD_BODY = {
  id: orderId,
  path: `${orderId}/LAB-K6TQ2-resultado-1.pdf`,
  name: "resultado impreso.pdf",
  mime: "application/pdf",
  size: 500_000,
};

describe("POST/GET/DELETE /api/internal/lab/result", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://supa.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    dbMock.findOrderById.mockReset();
    dbMock.setResultFile.mockClear();
    dbMock.clearResultFile.mockClear();
  });

  it("POST feliz con orden en resultado_listo: registra archivo", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", resultPath: null, orderCode: "LAB-K6TQ2",
    });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true } });
    expect(dbMock.setResultFile).toHaveBeenCalledOnce();
  });

  it("POST rechaza path fuera de la carpeta de la orden (403/400)", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: null });
    const { res, entries } = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { ...UPLOAD_BODY, path: `OtroId/fichero.pdf` } },
      res,
    );
    expect(entries[0]).toMatchObject({ s: 400 });
    expect(dbMock.setResultFile).not.toHaveBeenCalled();
  });

  it("POST con orden en 'entregada': 409 (ya cerrada)", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "entregada", resultPath: null });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 409 });
  });

  it("POST rechaza mime prohibido y tamaño mayor a 25 MB", async () => {
    const { res, entries } = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { ...UPLOAD_BODY, mime: "application/zip" } },
      res,
    );
    expect(entries[0]).toMatchObject({ s: 400 });
    await handler(
      { method: "POST", headers: {}, body: { ...UPLOAD_BODY, size: 30 * 1024 * 1024 } },
      res,
    );
    expect(entries[1]).toMatchObject({ s: 400 });
    expect(dbMock.setResultFile).not.toHaveBeenCalled();
  });

  it("GET genera URL firmada para el staff si hay archivo", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId,
      status: "resultado_listo",
      orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2.pdf`,
      resultName: "res.pdf",
      resultPublishedAt: new Date().toISOString(),
    });
    const { res, entries } = makeRes();
    await handler({ method: "GET", url: `/api/internal/lab/result?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200 });
    expect((entries[0].b as { url: string }).url).toContain("signed");
  });

  it("GET sin archivo publicado: 404", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: null });
    const { res, entries } = makeRes();
    await handler({ method: "GET", url: `/api/internal/lab/result?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 404 });
  });

  it("DELETE limpia columnas y borra del storage", async () => {
    process.env.SUPABASE_URL = "https://supa.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    dbMock.findOrderById.mockResolvedValue({
      id: orderId,
      status: "resultado_listo",
      orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2.pdf`,
      resultName: "res.pdf",
      resultPublishedAt: new Date().toISOString(),
    });
    const { res, entries } = makeRes();
    await handler({ method: "DELETE", url: `/api/internal/lab/result?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true } });
    expect(dbMock.clearResultFile).toHaveBeenCalledOnce();
  });
});
