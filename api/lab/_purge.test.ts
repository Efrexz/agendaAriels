import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { listExpiredResults: vi.fn(), finalizePurge: vi.fn() },
  remove: vi.fn(),
}));
vi.mock("./_shared.js", () => ({ getLabDb: () => mocks.db, notConfigured: () => false }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ remove: mocks.remove }) } }) }));
const { default: handler } = await import("./_purge.js");
const order = { id: "qa", orderCode: "LAB-ABCDE", status: "resultado_listo", resultPath: "qa/file.pdf", resultPublishedAt: "2026-01-01T00:00:00Z" };
function response() {
  return { code: 0, body: {} as Record<string, unknown>, status(code: number) { this.code = code; return this; }, json(body: Record<string, unknown>) { this.body = body; return this; } };
}
describe("purga simulada de resultados", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    mocks.db.listExpiredResults.mockReset().mockResolvedValue([order]);
    mocks.db.finalizePurge.mockReset().mockResolvedValue(true);
    mocks.remove.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("solo limpia la referencia después de borrar el archivo", async () => {
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer qa-secret" } }, res);
    expect(res.body).toMatchObject({ purged: 1, failed: 0 });
    expect(mocks.db.finalizePurge).toHaveBeenCalledWith(order.id, order.status, order.resultPath, order.resultPublishedAt);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.db.finalizePurge.mock.invocationCallOrder[0]);
  });
  it("conserva la referencia si Storage devuelve error", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "falló" } });
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer qa-secret" } }, res);
    expect(res.body).toMatchObject({ ok: false, purged: 0, failed: 1 });
    expect(mocks.db.finalizePurge).not.toHaveBeenCalled();
  });
  it("cuenta como cambiado si se reemplazó el archivo durante la purga", async () => {
    mocks.db.finalizePurge.mockResolvedValue(false);
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer qa-secret" } }, res);
    expect(res.body).toMatchObject({ purged: 0, changed: 1, failed: 0 });
  });
});
