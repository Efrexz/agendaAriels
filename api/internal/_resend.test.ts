import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  findById: vi.fn(),
  setWhatsappDelivered: vi.fn(),
};
const sendMock = vi.fn(async () => ({ ok: true as const }));
const receiptMock = vi.fn(async () => ({ outcome: "sent" as const, reason: undefined }));

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
  buildShortVetMessage: () => "short",
  buildBookingMessages: () => ["full1", "full2"],
  buildClientReceiptMessage: () => "receipt",
  normalizePhoneDest: () => "51917104426",
  sendViaEvolution: sendMock,
  sendClientReceipt: receiptMock,
}));

const { default: handler } = await import("./_resend.js");

const record = (() => {
  let n = 0;
  return () => {
    n += 1;
    const id = `5eb9cf5e-9e46-4a2c-8a7b-00000000000${n}`;
    return {
      id,
      bookingCode: "VA-ABCDE",
      status: "pendiente",
      branch: "san_miguel",
      branchLabel: "Sede San Miguel",
      serviceDate: "2026-10-22",
      timeSlot: "9-11",
      ownerName: "Rosa Quispe",
      ownerDni: "-",
      ownerPhone: "917-104-426",
      ownerEmail: "-",
      ownerAddress: "Av. Brigida Silva 272",
      ownerLat: -12.07,
      ownerLng: -77.09,
      mapsUrl: null,
      hasHistory: false,
      registeredPetName: "Rocky",
      registeredPhone: "-",
      petBirthDate: "-",
      petSpecies: "Perro",
      petBreed: "Criollo",
      petCastrated: false,
      mobilityPhoneDifferent: false,
      mobilityPhone: "-",
      pets: [{ name: "Rocky" }],
      createdAt: "2026-10-21T15:00:00Z",
      whatsappDelivered: false,
    } as const;
  };
})();

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

describe("POST /api/internal/resend", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_URL = "https://evo.test";
    process.env.EVOLUTION_API_KEY = "k";
    process.env.EVOLUTION_INSTANCE = "inst";
    process.env.WHATSAPP_DESTINO = "51917104426";
    dbMock.findById.mockReset();
    dbMock.setWhatsappDelivered.mockReset();
    sendMock.mockClear().mockResolvedValue({ ok: true as const });
    receiptMock.mockClear();
  });

  it("reenvía a la veterinaria y marca whatsapp_delivered=true", async () => {
    const r = record() as { id: string };
    dbMock.findById.mockResolvedValue(r);
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { bookingId: r.id } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, resent: true } });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(dbMock.setWhatsappDelivered).toHaveBeenCalledWith(r.id, true);
    expect(receiptMock).toHaveBeenCalledOnce(); // comprobante al cliente también
  });

  it("si el aviso ya se entregó antes: no reenvía nada", async () => {
    const r = record() as { id: string };
    dbMock.findById.mockResolvedValue({ ...r, whatsappDelivered: true });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { bookingId: r.id } }, res);
    expect(entries[0]).toMatchObject({ s: 200, b: { ok: true, resent: false } });
    expect(sendMock).not.toHaveBeenCalled();
    expect(dbMock.setWhatsappDelivered).not.toHaveBeenCalled();
  });

  it("reserva inexistente: 404", async () => {
    const r = record() as { id: string };
    dbMock.findById.mockResolvedValue(null);
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { bookingId: r.id } }, res);
    expect(entries[0]?.s).toBe(404);
  });

  it("Evolution cae: 502 y NO marca entregado", async () => {
    const r = record() as { id: string };
    dbMock.findById.mockResolvedValue(r);
    sendMock.mockResolvedValue({ ok: false as const, error: "boom" });
    const { res, entries } = makeRes();
    await handler({ method: "POST", headers: {}, body: { bookingId: r.id } }, res);
    expect(entries[0]).toMatchObject({ s: 502, b: { ok: false } });
    expect(dbMock.setWhatsappDelivered).not.toHaveBeenCalled();
  });
});
