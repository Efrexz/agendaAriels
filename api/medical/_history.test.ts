import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests de /api/medical/history (historial del panel de consultas).
const dbMock = {
  listApptsRange: vi.fn(async () => []),
  listApptStatusUpdatesMany: vi.fn(async () => ({})),
};

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => dbMock,
  notConfigured: () => false,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
  BRANCH_PHONES: {},
}));

const { default: handler } = await import("./_history.js");

function reqWith(qs: string) {
  return { method: "GET", url: `https://x.local/api/medical/history?${qs}`, headers: {} as Record<string, string> };
}
function resSpy() {
  const out: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
      return res;
    },
  };
  return { res, out };
}

beforeEach(() => {
  dbMock.listApptsRange.mockReset();
  dbMock.listApptStatusUpdatesMany.mockClear();
  dbMock.listApptsRange.mockResolvedValue([]);
});

describe("GET /api/medical/history", () => {
  it("rango válido devuelve ok y delega en listApptsRange (con canceladas)", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25&branch=san_miguel"), res);
    expect(out.status).toBe(200);
    expect((out.body as { ok: boolean }).ok).toBe(true);
    expect(dbMock.listApptsRange).toHaveBeenCalledWith("san_miguel", "2026-09-25", "2026-10-25", true);
  });

  it("rango mayor a un mes es 400", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-01-01&to=2026-12-31"), res);
    expect(out.status).toBe(400);
    expect((out.body as { error: string }).error).toContain("un mes");
  });

  it("from > to es 400", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-10-25&to=2026-09-25"), res);
    expect(out.status).toBe(400);
  });

  it("sin sesión (staffGuard null) es 401", async () => {
    const { staffGuard } = await import("./_shared.js") as unknown as { staffGuard: ReturnType<typeof vi.fn> };
    // El guard REAL escribe el 401 — el mock lo replica para el test.
    staffGuard.mockImplementationOnce(async (_req: unknown, res2: { status(n: number): { json: (p: unknown) => unknown } }) => {
      res2.status(401).json({ ok: false, error: "Sesión no válida." });
      return null;
    });
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25"), res);
    expect(out.status).toBe(401);
  });
});
