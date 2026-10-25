import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests de /api/internal/history (historial del panel grooming).
const dbMock = {
  listBookingsRange: vi.fn(async () => []),
  listUpdatesForBookings: vi.fn(async () => ({})),
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

const { default: handler } = await import("./_history.js");

function reqWith(qs: string) {
  return { method: "GET", url: `https://x.local/api/internal/history?${qs}`, headers: {} as Record<string, string> };
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
  dbMock.listBookingsRange.mockClear();
  dbMock.listUpdatesForBookings.mockClear();
});

describe("GET /api/internal/history", () => {
  it("rango válido devuelve ok y delega en listBookingsRange", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25&branch=los_olivos"), res);
    expect(out.status).toBe(200);
    expect((out.body as { ok: boolean }).ok).toBe(true);
    expect(dbMock.listBookingsRange).toHaveBeenCalledWith("los_olivos", "2026-09-25", "2026-10-25");
  });

  it("branch=all no filtra sede (null)", async () => {
    const { res } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25&branch=all"), res);
    expect(dbMock.listBookingsRange).toHaveBeenCalledWith(null, "2026-09-25", "2026-10-25");
  });

  it("rango inválido (from > to) es 400", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-10-25&to=2026-09-25"), res);
    expect(out.status).toBe(400);
  });

  it("rango mayor a un mes es 400", async () => {
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-01-01&to=2026-12-31"), res);
    expect(out.status).toBe(400);
    expect((out.body as { error: string }).error).toContain("máximo");
  });

  it("incluye las canceladas (no filtra status en la consulta)", async () => {
    dbMock.listBookingsRange.mockResolvedValueOnce([
      { id: "b1", bookingCode: "VA-XXXXX", status: "cancelado", branch: "san_miguel", branchLabel: "Sede San Miguel", serviceDate: "2026-10-24", timeSlot: "9-11", ownerName: "Ana", ownerPhone: "999", ownerEmail: "-", ownerAddress: "-", ownerLat: null, ownerLng: null, mapsUrl: null, hasHistory: null, registeredPetName: "-", registeredPhone: "-", petBirthDate: "-", petSpecies: "-", petBreed: "-", petCastrated: false, mobilityPhoneDifferent: false, mobilityPhone: "-", pets: [], createdAt: "2026-10-24T12:00:00Z", updatedAt: "2026-10-24T12:00:00Z" },
    ]);
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25"), res);
    expect(out.status).toBe(200);
    expect((out.body as { bookings: unknown[] }).bookings).toHaveLength(1);
  });

  it("sin sesión es 401", async () => {
    const { verifyStaff } = await import("./_verify.js");
    (verifyStaff as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const { res, out } = resSpy();
    await handler(reqWith("from=2026-09-25&to=2026-10-25"), res);
    expect(out.status).toBe(401);
  });
});
