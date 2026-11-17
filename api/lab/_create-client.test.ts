import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del endpoint público /api/lab/create-client: solicitudes de examen
// desde la web — crean lab_orders en estado 'solicitada' (la muestra aún no
// se toma) con labName "Por asignar" y avisos best-effort.

const dbMock = {
  insertOrder: vi.fn(async () => ({ code: null, id: "order-id-1" })),
  recordOrderStatus: vi.fn(async () => undefined),
};

vi.mock("./_shared.js", () => ({
  getLabDb: () => dbMock,
  isLabBranch: (b: string) => ["san_martin", "los_olivos", "san_miguel"].includes(b),
  LAB_BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  formatPhoneForDb: (v: string) => v,
  notConfigured: () => false,
  staffGuard: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
}));

const send = vi.fn(async () => ({ ok: true }) as const);
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: (v: string) => v,
  sendViaEvolution: send,
}));

const { default: handler } = await import("./_create-client.js");

function call(body: unknown, ip = "1.2.3.4") {
  const out: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(payload: unknown) { out.body = payload; return res; },
  };
  return handler(
    { method: "POST", headers: { "x-forwarded-for": ip }, body },
    res as never,
  ).then(() => out);
}

const BODY = {
  sede: "san_miguel",
  examType: "Perfil hepático",
  petName: "Rex",
  petType: "Perro",
  ownerName: "Juan Pérez",
  ownerPhone: "999111222",
};

describe("/api/lab/create-client", () => {
  beforeEach(() => {
    dbMock.insertOrder.mockClear();
    dbMock.recordOrderStatus.mockClear();
    send.mockClear();
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-qa.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
  });

  it("crea la orden en 'solicitada' con labName Por asignar y avisos al counter+cliente", async () => {
    const r = await call(BODY);
    expect(r.status).toBe(200);
    const row = dbMock.insertOrder.mock.calls[0][0];
    expect(row.status).toBe("solicitada");
    expect(row.labName).toBe("Por asignar");
    expect(row.sedeOrigen).toBe(row.sedeResponsable);
    expect(row.createdBy).toBe("cliente-web");
    expect(dbMock.recordOrderStatus).toHaveBeenCalledWith("order-id-1", "solicitada", "sistema");
    // 2 envíos: alerta counter + mensaje cliente (sin WHATSAPP_DESTINO el
    // counter no sale; aquí el mock de env no lo tiene → solo cliente)
    const texts = send.mock.calls.map((c) => c[0][0] as string);
    const clientText = texts.find((t) => t.includes("Solicitud de examen recibida"));
    expect(clientText).toBeTruthy();
    expect(clientText).toMatch(/S\/ 25/);
    expect(clientText).toMatch(/estado\?code=LAB-/);
    expect(clientText).not.toMatch(/Laboratorio: /); // sin lab externo (decisión del dueño)
  });

  it("rechaza payload inválido (examen corto) con 400", async () => {
    const r = await call({ ...BODY, examType: "x" });
    expect(r.status).toBe(400);
    expect(dbMock.insertOrder).not.toHaveBeenCalled();
  });

  it("rechaza sede inválida con 400", async () => {
    const r = await call({ ...BODY, sede: "marte" });
    expect(r.status).toBe(400);
    expect(dbMock.insertOrder).not.toHaveBeenCalled();
  });
});
