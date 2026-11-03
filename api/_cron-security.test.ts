import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  medicalDb: { listApptsByDate: vi.fn() },
  labDb: { listExpiredResults: vi.fn() },
  getMedicalDb: vi.fn(),
  getLabDb: vi.fn(),
  notConfigured: vi.fn(),
  send: vi.fn(),
  storageClient: vi.fn(),
}));

vi.mock("./medical/_shared.js", () => ({
  BRANCH_LABELS: {}, getMedicalDb: mocks.getMedicalDb,
}));
vi.mock("./lab/_shared.js", () => ({
  getLabDb: mocks.getLabDb, notConfigured: mocks.notConfigured,
}));
vi.mock("./_booking.js", () => ({
  sendViaEvolution: mocks.send, normalizePhoneDest: () => null,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.storageClient }));

const { default: reminders } = await import("./medical/_reminders.js");
const { default: purge } = await import("./lab/_purge.js");

function makeRes() {
  const entries: Array<{ status: number; body: unknown }> = [];
  const res = { status(status: number) { return { json(body: unknown) { entries.push({ status, body }); return res; } }; } };
  return { res, entries };
}

describe.each([["recordatorios", reminders], ["purga", purge]] as const)("seguridad del cron de %s", (_name, handler) => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
    mocks.getMedicalDb.mockReset().mockReturnValue(mocks.medicalDb);
    mocks.getLabDb.mockReset().mockReturnValue(mocks.labDb);
    mocks.notConfigured.mockReset().mockReturnValue(false);
    mocks.medicalDb.listApptsByDate.mockReset().mockResolvedValue([]);
    mocks.labDb.listExpiredResults.mockReset().mockResolvedValue([]);
    mocks.send.mockReset();
    mocks.storageClient.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["sin secreto configurado", "", "Bearer secreto-de-prueba"],
    ["sin autorización", "secreto-de-prueba", undefined],
    ["con secreto incorrecto", "secreto-de-prueba", "Bearer incorrecto"],
  ])("rechaza %s sin acceder a datos ni enviar mensajes", async (_case, secret, authorization) => {
    vi.stubEnv("CRON_SECRET", secret);
    const { res, entries } = makeRes();
    await handler({ method: "GET", headers: { authorization } }, res);
    expect(entries[0]).toMatchObject({ status: 401, body: { ok: false } });
    expect(mocks.getMedicalDb).not.toHaveBeenCalled();
    expect(mocks.getLabDb).not.toHaveBeenCalled();
    expect(mocks.storageClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("acepta el secreto correcto y no realiza acciones cuando no hay registros", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "GET", headers: { authorization: "Bearer secreto-de-prueba" } }, res);
    expect(entries[0]).toMatchObject({ status: 200, body: { ok: true } });
    expect(mocks.storageClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rechaza otros métodos", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: { authorization: "Bearer secreto-de-prueba" } }, res);
    expect(entries[0]).toMatchObject({ status: 405 });
    expect(mocks.getMedicalDb).not.toHaveBeenCalled();
    expect(mocks.getLabDb).not.toHaveBeenCalled();
  });
});
