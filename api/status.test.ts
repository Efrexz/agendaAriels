import { describe, it, expect, vi } from "vitest";
import type { BookingDb } from "../db.js";

const record = {
  id: "test-id",
  bookingCode: "VA-ABCDE",
  status: "en_bano",
  serviceDate: "2026-10-21",
  timeSlot: "9-11",
  branchLabel: "Sede San Miguel",
  createdAt: "2026-10-21T15:00:00Z",
  pets: [{ name: "Rocky", type: "Perro", service: "baño" }],
  timeline: [],
};

const db = {
  findByCode: vi.fn(async () => record),
  listStatusUpdates: vi.fn(async () => [
    { status: "recibido", createdBy: "vet_ariel@hotmail.com", createdAt: "2026-10-21T15:05:00Z" },
    { status: "en_bano", createdBy: "vet_ariel@hotmail.com", createdAt: "2026-10-21T15:30:00Z" },
  ]),
} as unknown as BookingDb;

describe("buildStatusResponse (página pública /estado)", () => {
  it("expone solo campos seguros y SIN email del staff en el timeline", async () => {
    const { buildStatusResponse } = await import("./_status.js");
    const result = await buildStatusResponse(db, "VA-ABCDE");
    const body = JSON.stringify(result.body);
    expect(result.status).toBe(200);
    expect(body).not.toContain("hotmail.com");
    expect(body).not.toContain("owner_phone");
    expect(body).not.toContain("owner_dni");
    expect(body).not.toContain("ownerAddress");
    const parsed = result.body as { booking: { timeline: Array<{ status: string; createdAt: string }> } };
    expect(parsed.booking.timeline[0]).toEqual({
      status: "recibido",
      createdAt: "2026-10-21T15:05:00Z",
    });
  });
});
