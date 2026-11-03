import { beforeEach, describe, expect, it, vi } from "vitest";
const db = { findOrderById: vi.fn(), rotateResultAccess: vi.fn() };
const staff = vi.fn();
const send = vi.fn();
vi.mock("./_shared.js", () => ({ getLabDb: () => db, notConfigured: () => false, staffGuard: staff }));
vi.mock("./_access.js", async (load) => ({ ...(await load<typeof import("./_access.js")>()), sendResultLink: send }));
const { default: handler } = await import("./_resend_result.js");
const id = "9eb9cf5e-9e46-4a2c-8a7b-000000000031";
const order = { id, orderCode: "LAB-ABCDE", resultPath: "path", resultPublishedAt: new Date().toISOString() };
function response() {
  return { code: 0, body: {} as Record<string, unknown>, status(code: number) { this.code = code; return this; }, json(body: Record<string, unknown>) { this.body = body; return this; }, setHeader() {} };
}
describe("reenvío privado", () => {
  beforeEach(() => { staff.mockReset().mockResolvedValue({ email: "staff@example.test" }); db.findOrderById.mockReset().mockResolvedValue(order); db.rotateResultAccess.mockReset().mockResolvedValue(true); send.mockReset().mockResolvedValue(true); });
  it("exige sesión del personal", async () => {
    staff.mockResolvedValue(null);
    await handler({ method: "POST", headers: {}, body: { id } }, response());
    expect(db.rotateResultAccess).not.toHaveBeenCalled();
  });
  it("rota la huella y notifica sin exponer el token en la respuesta", async () => {
    const res = response();
    await handler({ method: "POST", headers: {}, body: { id } }, res);
    expect(res.code).toBe(200);
    expect(res.body).toEqual({ ok: true, notified: true });
    expect(db.rotateResultAccess).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(JSON.stringify(res.body)).not.toContain(send.mock.calls[0][1]);
  });
  it("no envía si el archivo cambió durante el reenvío", async () => {
    db.rotateResultAccess.mockResolvedValue(false);
    const res = response();
    await handler({ method: "POST", headers: {}, body: { id } }, res);
    expect(res.code).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
  it("informa si el envío falló", async () => {
    send.mockResolvedValue(false);
    const res = response();
    await handler({ method: "POST", headers: {}, body: { id } }, res);
    expect(res.body).toEqual({ ok: true, notified: false });
  });
});
