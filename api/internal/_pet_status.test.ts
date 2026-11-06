import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del endpoint G1 /internal/pet-status: guarda el estado por mascota
// sin tocar la cascada general, valida mascota existente y respeta privacidad.

const bookingMock = {
  id: "00000000-0000-4000-8000-0000000000AA",
  status: "en_bano",
  ownerPhone: "999111222",
  branchLabel: "Sede San Miguel",
  pets: [{ name: "Manolo" }, { name: "Kira" }, { name: "Mia" }],
  petStatus: null as Record<string, { s: string; by: string; at: string }> | null,
};

const dbMock = {
  findById: vi.fn(async () => bookingMock),
  setPetStatus: vi.fn(async () => undefined),
  transitionStatus: vi.fn(async () => true),
  updateStatus: vi.fn(async () => undefined),
};

vi.mock("../db.js", () => ({
  SupabaseBookingDb: { fromEnv: () => dbMock },
}));

const sendViaEvolution = vi.fn(async () => ({ ok: true }) as const);

vi.mock("./_verify.js", () => ({
  bearerFrom: () => "Bearer token",
  unauthorized: (res: { status(code: number): { json(p: unknown): void } }) => {
    res.status(401).json({ ok: false });
  },
  verifyStaff: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
}));

vi.mock("../_booking.js", () => ({
  normalizePhoneDest: (v: string) => v,
  sendViaEvolution,
}));

const { default: handler } = await import("./_pet_status.js");

function call(body: unknown) {
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
  return handler({ method: "POST", headers: {}, body }, res as never).then(() => out);
}

describe("G1 /internal/pet-status", () => {
  beforeEach(() => {
    dbMock.findById.mockClear();
    dbMock.setPetStatus.mockClear();
    dbMock.updateStatus.mockClear();
    dbMock.transitionStatus.mockClear();
    sendViaEvolution.mockClear();
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-qa.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    bookingMock.petStatus = null;
  });

  it("guarda el estado por mascota y NO cambia el estado general", async () => {
    const r = await call({ bookingId: bookingMock.id, petIndex: 2, status: "listo" });
    expect(r.status).toBe(200);
    expect(dbMock.setPetStatus).toHaveBeenCalledWith(
      bookingMock.id,
      2,
      expect.objectContaining({ s: "listo", by: "vet_ariel@hotmail.com" }),
      null,
    );
    expect(dbMock.updateStatus).not.toHaveBeenCalled();
  });

  it("rechaza mascota inexistente en la reserva (index fuera de rango)", async () => {
    await call({ bookingId: bookingMock.id, petIndex: 5, status: "bano" });
    expect(dbMock.setPetStatus).not.toHaveBeenCalled();
  });

  it("permit reset con estado vacío ''", async () => {
    await call({ bookingId: bookingMock.id, petIndex: 0, status: "" });
    expect(dbMock.setPetStatus).toHaveBeenCalledWith(
      bookingMock.id,
      0,
      expect.objectContaining({ s: "" }),
      null,
    );
  });

  it("rechaza datos inválidos (estado desconocido) con 400", async () => {
    const r = await call({ bookingId: bookingMock.id, petIndex: 0, status: "volando" });
    expect(r.status).toBe(400);
  });

  it("passthrough petStatus actual al guardar (merge server-side)", async () => {
    bookingMock.petStatus = { "1": { s: "bano", by: "otro@x", at: "t" } };
    await call({ bookingId: bookingMock.id, petIndex: 0, status: "bano" });
    expect(dbMock.setPetStatus).toHaveBeenCalledWith(
      bookingMock.id,
      0,
      expect.anything(),
      bookingMock.petStatus,
    );
  });

  it("TODAS listas → transición global a 'listo' + UN solo WhatsApp final", async () => {
    bookingMock.status = "en_corte";
    bookingMock.petStatus = { "0": { s: "listo", by: "x", at: "t" }, "1": { s: "listo", by: "x", at: "t" } }; // Mia falta
    await call({ bookingId: bookingMock.id, petIndex: 2, status: "listo" });
    expect(dbMock.transitionStatus).toHaveBeenCalledWith(
      bookingMock.id,
      "en_corte",
      "listo",
      "vet_ariel@hotmail.com",
    );
    expect(sendViaEvolution).toHaveBeenCalledTimes(1);
    const text = sendViaEvolution.mock.calls[0][0][0] as string;
    expect(text).toMatch(/listo/i);
  });

  it("falta una mascota por iniciar → NO avanza el global (ni avisa)", async () => {
    bookingMock.status = "en_corte";
    await call({ bookingId: bookingMock.id, petIndex: 0, status: "corte" });
    expect(dbMock.transitionStatus).not.toHaveBeenCalled();
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it("deriva 'en_secado' si la fase menor es secado (sin WhatsApp en ese paso)", async () => {
    bookingMock.status = "en_bano";
    bookingMock.petStatus = { "0": { s: "secado", by: "x", at: "t" }, "2": { s: "secado", by: "x", at: "t" } };
    await call({ bookingId: bookingMock.id, petIndex: 1, status: "secado" });
    expect(dbMock.transitionStatus).toHaveBeenCalledWith(bookingMock.id, "en_bano", "en_secado", "vet_ariel@hotmail.com");
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });
});
