import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  findById: vi.fn(),
  transitionStatus: vi.fn(),
};
const sendMock = vi.fn(async () => ({ ok: true as const }));

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

vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "51917104426",
  sendViaEvolution: sendMock,
}));

const { default: handler } = await import("./_status.js");

function makeRes() {
  const entries: Array<{ s: number; b: unknown }> = [];
  const res = {
    status(code: number) {
      return {
        json(payload: unknown) {
          entries.push({ s: code, b: payload });
          return res;
        },
      };
    },
  };
  return { res, entries };
}

const booking = {
  id: "5eb9cf5e-9e46-4a2c-8a7b-000000000001",
  status: "en_secado",
  ownerPhone: "917-104-426",
  branchLabel: "Sede San Miguel",
  pets: [{ name: "Rocky" }],
};

function reqFor(status: string) {
  return { method: "POST", headers: {}, body: { bookingId: booking.id, status } };
}

describe("PATCH estado del panel (api/internal/status)", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_URL = "https://evo.test";
    process.env.EVOLUTION_API_KEY = "k";
    process.env.EVOLUTION_INSTANCE = "inst";
    dbMock.findById.mockResolvedValue(booking);
    dbMock.transitionStatus.mockReset();
    sendMock.mockClear();
  });

  it("transición ganada: notifica al cliente en estado notificable", async () => {
    dbMock.transitionStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler(reqFor("listo"), res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: true } });
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("carrera perdida (otra PC cambió primero): 200 sin notificar", async () => {
    dbMock.transitionStatus.mockResolvedValue(false);
    const { res, entries } = makeRes();
    await handler(reqFor("listo"), res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false, stale: true } });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("mismo estado repetido (click doble secuencial): no notifica", async () => {
    const { res, entries } = makeRes();
    await handler(reqFor("en_secado"), res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(dbMock.transitionStatus).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("estado de tránsito interno: no manda WhatsApp", async () => {
    dbMock.transitionStatus.mockResolvedValue(true);
    const { res, entries } = makeRes();
    await handler(reqFor("en_bano"), res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, notified: false } });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
