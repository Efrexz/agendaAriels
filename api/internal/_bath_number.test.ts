import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del endpoint /internal/bath-number: guarda el número de baño
// (turno del cuaderno del spa) por mascota sin tocar estados ni WhatsApp.

const bookingMock = {
  id: "00000000-0000-4000-8000-0000000000BB",
  status: "recibido",
  pets: [{ name: "Manolo" }, { name: "Kira" }],
  petStatus: null,
  bathNumbers: null as Record<string, { n: number; by: string; at: string }> | null,
};

const dbMock = {
  findById: vi.fn(async () => bookingMock),
  setBathNumber: vi.fn(async () => undefined),
};

vi.mock("../db.js", () => ({
  SupabaseBookingDb: { fromEnv: () => dbMock },
}));

vi.mock("./_verify.js", () => ({
  bearerFrom: () => "Bearer token",
  unauthorized: (res: { status(code: number): { json(p: unknown): void } }) => {
    res.status(401).json({ ok: false });
  },
  verifyStaff: vi.fn(async () => ({ email: "vet_ariel@hotmail.com" })),
}));

const { default: handler } = await import("./_bath_number.js");

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

describe("/internal/bath-number", () => {
  beforeEach(() => {
    dbMock.findById.mockClear();
    dbMock.setBathNumber.mockClear();
    bookingMock.bathNumbers = null;
  });

  it("guarda el número con quién/cuándo (patrón G1 {n, by, at})", async () => {
    const r = await call({ bookingId: bookingMock.id, petIndex: 1, number: 20 });
    expect(r.status).toBe(200);
    expect(dbMock.setBathNumber).toHaveBeenCalledWith(
      bookingMock.id,
      1,
      expect.objectContaining({ n: 20, by: "vet_ariel@hotmail.com" }),
      null,
    );
  });

  it("null quita el número de esa mascota (reset)", async () => {
    await call({ bookingId: bookingMock.id, petIndex: 0, number: null });
    expect(dbMock.setBathNumber).toHaveBeenCalledWith(bookingMock.id, 0, null, null);
  });

  it("rechaza número inválido (0, negativo, decimal, texto) con 400", async () => {
    for (const number of [0, -3, 2.5, "20", 10000]) {
      await call({ bookingId: bookingMock.id, petIndex: 0, number });
    }
    expect(dbMock.setBathNumber).not.toHaveBeenCalled();
  });

  it("rechaza mascota inexistente en la reserva (index fuera de rango)", async () => {
    const r = await call({ bookingId: bookingMock.id, petIndex: 5, number: 7 });
    expect(r.status).toBe(400);
    expect(dbMock.setBathNumber).not.toHaveBeenCalled();
  });

  it("passthrough de bathNumbers actual al guardar (merge server-side)", async () => {
    bookingMock.bathNumbers = { "0": { n: 5, by: "otro@x", at: "t" } };
    await call({ bookingId: bookingMock.id, petIndex: 1, number: 6 });
    expect(dbMock.setBathNumber).toHaveBeenCalledWith(
      bookingMock.id,
      1,
      expect.objectContaining({ n: 6 }),
      bookingMock.bathNumbers,
    );
  });
});
