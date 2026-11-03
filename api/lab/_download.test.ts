import { beforeEach, describe, expect, it, vi } from "vitest";
import { newResultToken, resultTokenHash } from "./_access.js";

const db = { findOrderByCode: vi.fn(), findResultAccessHash: vi.fn() };
const sign = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null }));
vi.mock("./_shared.js", () => ({ getLabDb: () => db, notConfigured: () => false }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ createSignedUrl: sign }) } }) }));
const { default: handler } = await import("./_download.js");
const token = newResultToken();
const order = { id: "test-id", resultPath: "test/path", resultPublishedAt: new Date().toISOString() };
function response() {
  return { code: 0, body: {} as Record<string, unknown>, headers: {} as Record<string, string>,
    status(code: number) { this.code = code; return this; },
    json(body: Record<string, unknown>) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; } };
}
describe("descarga privada", () => {
  beforeEach(() => { db.findOrderByCode.mockReset().mockResolvedValue(order); db.findResultAccessHash.mockReset().mockResolvedValue(resultTokenHash(token)); sign.mockClear(); });
  it("solo firma con token válido, sin almacenar la respuesta en caché", async () => {
    const res = response();
    await handler({ method: "POST", body: { code: "LAB-ABCDE", token } }, res);
    expect(res.code).toBe(200);
    expect(res.body.url).toBe("https://storage.test/signed");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(sign).toHaveBeenCalledWith("test/path", 60);
  });
  it("rechaza el código solo, tokens incorrectos o revocados sin firmar", async () => {
    for (const body of [{ code: "LAB-ABCDE" }, { code: "LAB-ABCDE", token: newResultToken() }]) {
      const res = response();
      await handler({ method: "POST", body }, res);
      expect([400, 404]).toContain(res.code);
    }
    db.findResultAccessHash.mockResolvedValue(null);
    const res = response();
    await handler({ method: "POST", body: { code: "LAB-ABCDE", token } }, res);
    expect(res.code).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });
  it("rechaza archivos vencidos o eliminados y no distingue una orden inexistente", async () => {
    for (const value of [null, { ...order, resultPath: null }, { ...order, resultPublishedAt: new Date(Date.now() - 20 * 86400_000).toISOString() }]) {
      db.findOrderByCode.mockResolvedValue(value);
      const res = response();
      await handler({ method: "POST", body: { code: "LAB-ABCDE", token } }, res);
      expect(res.code).toBe(404);
    }
    expect(sign).not.toHaveBeenCalled();
  });
});
