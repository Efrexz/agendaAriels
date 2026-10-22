import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  listCatalog: vi.fn(async () => ({ exams: ["Hematología"], labs: ["Hemovet"] })),
  addCatalogItem: vi.fn(async (_kind: string, name: string) => name),
};

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  notConfigured: () => undefined,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
}));

const { default: handler } = await import("./_catalog.js");

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) { return { json(payload: unknown) { entries.push({ s: code, b: payload }); return res; } }; },
  };
  return { res, entries };
}

describe("GET/POST /api/internal/lab/catalog", () => {
  beforeEach(() => {
    dbMock.listCatalog.mockClear();
    dbMock.addCatalogItem.mockClear();
    dbMock.addCatalogItem.mockImplementation(async (_k: string, name: string) => name);
  });

  it("GET devuelve examenes y labs", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, exams: ["Hematología"], labs: ["Hemovet"] } });
  });

  it("POST exam nuevo: agrega y devuelve el nombre", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { kind: "exam", name: "Perfil tiroideo" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, name: "Perfil tiroideo" } });
    expect(dbMock.addCatalogItem).toHaveBeenCalledWith("exam", "Perfil tiroideo");
  });

  it("POST duplicado: el repository devuelve el existente sin error", async () => {
    dbMock.addCatalogItem.mockImplementation(async () => "Hemovet"); // 23505 → existente
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { kind: "lab", name: "Hemovet" } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, name: "Hemovet" } });
  });

  it("nombre demasiado corto: 400 sin tocar BD", async () => {
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { kind: "exam", name: "X" } }, res);
    expect(entries[0]).toMatchObject({ s: 400 });
    expect(dbMock.addCatalogItem).not.toHaveBeenCalled();
  });
});
