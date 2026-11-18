import { describe, it, expect, vi, beforeEach } from "vitest";
const removeMock = vi.hoisted(() => vi.fn());

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
        remove: removeMock,
      }),
    },
  })),
}));

const dbMock = {
  findOrderById: vi.fn(),
  setResultFile: vi.fn(async () => true),
  clearResultFile: vi.fn(async () => true),
  listExtraResults: vi.fn(async () => []),
  addExtraResult: vi.fn(async () => "extra-1"),
  removeExtraResult: vi.fn(async () => true),
  listExtraPaths: vi.fn(async () => []),
  deleteExtraResultsOfOrder: vi.fn(async () => undefined),
};
const sendResultMock = vi.fn(async () => true);
vi.mock("./_access.js", async (load) => ({ ...(await load<typeof import("./_access.js")>()), sendResultLink: sendResultMock }));

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
    dbMock.setResultFile.mockReset().mockResolvedValue(true);
    dbMock.clearResultFile.mockReset().mockResolvedValue(true);
    dbMock.listExtraResults.mockReset().mockResolvedValue([]);
    dbMock.addExtraResult.mockReset().mockResolvedValue("extra-1");
    dbMock.removeExtraResult.mockReset().mockResolvedValue(true);
    dbMock.listExtraPaths.mockReset().mockResolvedValue([]);
    dbMock.deleteExtraResultsOfOrder.mockReset().mockResolvedValue(undefined);
    removeMock.mockReset().mockResolvedValue({ error: null });
    sendResultMock.mockReset().mockResolvedValue(true);
  });

  it("POST feliz con orden en resultado_listo: registra archivo", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", resultPath: null, orderCode: "LAB-K6TQ2",
    });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: true } });
    expect(dbMock.setResultFile).toHaveBeenCalledOnce();
    expect(sendResultMock).toHaveBeenCalledOnce();
    expect(dbMock.setResultFile.mock.calls[0][3]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(entries)).not.toContain(sendResultMock.mock.calls[0][1]);
  });

  it("si no se puede enviar, conserva el resultado publicado e informa al panel", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: null, orderCode: "LAB-K6TQ2" });
    sendResultMock.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(dbMock.setResultFile).toHaveBeenCalledOnce();
  });

  it("si la orden cambió, no envía un enlace para el archivo que no se publicó", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: null, orderCode: "LAB-K6TQ2" });
    dbMock.setResultFile.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 409 });
    expect(sendResultMock).not.toHaveBeenCalled();
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
    expect(dbMock.clearResultFile).toHaveBeenCalledWith(orderId, `${orderId}/LAB-K6TQ2.pdf`);
  });

  it("DELETE conserva la referencia si Storage devuelve un error", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: `${orderId}/file.pdf` });
    removeMock.mockResolvedValue({ error: { message: "falló" } });
    const { res, entries } = makeRes();
    await handler({ method: "DELETE", url: `/?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 503, b: { ok: false } });
    expect(dbMock.clearResultFile).not.toHaveBeenCalled();
  });

  it("DELETE avisa si otro archivo reemplazó al eliminado", async () => {
    dbMock.findOrderById.mockResolvedValue({ id: orderId, status: "resultado_listo", resultPath: `${orderId}/file.pdf` });
    dbMock.clearResultFile.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler({ method: "DELETE", url: `/?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 409, b: { ok: false } });
  });

  // ── Feedback 17/11: VARIOS exámenes por orden (resultados adicionales) ──

  it("POST con resultado ya publicado SIN replace → registra ADICIONAL (sin token ni enlace)", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2-resultado-1.pdf`,
    });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...UPLOAD_BODY, path: `${orderId}/LAB-K6TQ2-resultado-2.pdf` } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false, added: true } });
    expect(dbMock.addExtraResult).toHaveBeenCalledOnce();
    expect(dbMock.setResultFile).not.toHaveBeenCalled();
    expect(sendResultMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled(); // NO borra el primero
  });

  it("POST con replace: true reemplaza el principal como siempre (nuevo token + enlace)", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2-resultado-1.pdf`,
    });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...UPLOAD_BODY, path: `${orderId}/LAB-K6TQ2-resultado-2.pdf`, replace: true } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: true, added: false } });
    expect(dbMock.setResultFile).toHaveBeenCalledOnce();
    expect(removeMock).toHaveBeenCalledOnce();
    expect(dbMock.addExtraResult).not.toHaveBeenCalled();
  });

  it("POST adicional duplicado (mismo path o ya registrado): 409", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2-resultado-1.pdf`,
    });
    const { res, entries } = makeRes();
    // mismo path que el principal
    await handler({ method: "POST", headers: {}, body: UPLOAD_BODY }, res);
    expect(entries[0]).toMatchObject({ s: 409 });
    // addExtraResult rechaza por UNIQUE
    dbMock.addExtraResult.mockResolvedValue(null);
    await handler({ method: "POST", headers: {}, body: { ...UPLOAD_BODY, path: `${orderId}/LAB-K6TQ2-resultado-2.pdf` } }, res);
    expect(entries[1]).toMatchObject({ s: 409 });
  });

  it("POST adicional rechaza al llegar al tope de 5", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2-resultado-1.pdf`,
    });
    dbMock.listExtraResults.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, path: `${orderId}/x${i}.pdf`, name: "x", publishedAt: new Date().toISOString() })),
    );
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...UPLOAD_BODY, path: `${orderId}/LAB-K6TQ2-resultado-2.pdf` } }, res);
    expect(entries[0]).toMatchObject({ s: 409 });
    expect(dbMock.addExtraResult).not.toHaveBeenCalled();
  });

  it("GET devuelve la lista completa (principal + adicionales) con URLs firmadas", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/LAB-K6TQ2.pdf`, resultName: "res.pdf",
      resultPublishedAt: new Date().toISOString(),
    });
    dbMock.listExtraResults.mockResolvedValue([
      { id: "9eb9cf5e-9e46-4a2c-8a7b-000000000099", path: `${orderId}/extra.pdf`, name: "extra.pdf", publishedAt: new Date().toISOString() },
    ]);
    const { res, entries } = makeRes();
    await handler({ method: "GET", url: `/api/internal/lab/result?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200 });
    const body = entries[0].b as { results: Array<{ id: string }>; url: string };
    expect(body.url).toContain("signed");
    expect(body.results.map((r) => r.id)).toEqual(["principal", "9eb9cf5e-9e46-4a2c-8a7b-000000000099"]);
  });

  it("DELETE ?result= borra un adicional (storage + registro) sin tocar el principal", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/principal.pdf`, resultName: "p.pdf",
      resultPublishedAt: new Date().toISOString(),
    });
    dbMock.listExtraResults.mockResolvedValue([
      { id: "9eb9cf5e-9e46-4a2c-8a7b-000000000099", path: `${orderId}/extra.pdf`, name: "extra.pdf", publishedAt: new Date().toISOString() },
    ]);
    const { res, entries } = makeRes();
    await handler({ method: "DELETE", url: `/?id=${orderId}&result=9eb9cf5e-9e46-4a2c-8a7b-000000000099`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true } });
    expect(dbMock.removeExtraResult).toHaveBeenCalledWith(orderId, "9eb9cf5e-9e46-4a2c-8a7b-000000000099", `${orderId}/extra.pdf`);
    expect(dbMock.clearResultFile).not.toHaveBeenCalled();
  });

  it("DELETE del principal también elimina los adicionales (mismo ciclo de publicación)", async () => {
    dbMock.findOrderById.mockResolvedValue({
      id: orderId, status: "resultado_listo", orderCode: "LAB-K6TQ2",
      resultPath: `${orderId}/principal.pdf`, resultName: "p.pdf",
      resultPublishedAt: new Date().toISOString(),
    });
    dbMock.listExtraPaths.mockResolvedValue([`${orderId}/extra.pdf`]);
    const { res, entries } = makeRes();
    await handler({ method: "DELETE", url: `/?id=${orderId}`, headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true } });
    expect(removeMock).toHaveBeenCalled();
    expect(dbMock.deleteExtraResultsOfOrder).toHaveBeenCalledWith(orderId);
  });
});
