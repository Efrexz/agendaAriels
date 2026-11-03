import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseBookingDb } from "./db.js";
import { LabDb } from "./lab/db.js";
import { MedicalDb } from "./medical/db.js";
import { MedicalSlotConflictError } from "./medical/errors.js";

describe("API de transiciones transaccionales", () => {
  it.each([
    ["grooming", "api_grooming_transition"],
    ["laboratorio", "api_lab_transition"],
    ["médico", "api_medical_transition"],
  ])("%s ejecuta una única función y no confirma errores", async (kind, name) => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const run = kind === "grooming"
      ? () => new SupabaseBookingDb(client).transitionStatus("id", "anterior", "nuevo", "personal")
      : kind === "laboratorio"
        ? () => new LabDb(client).transitionOrderStatus("id", "anterior", "nuevo", "personal")
        : () => new MedicalDb(client).transitionApptStatus("id", "anterior", "nuevo", "personal");
    await expect(run()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(name, { p_id: "id", p_from: "anterior", p_to: "nuevo", p_actor: "personal" });
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(run()).resolves.toBe(false);
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(run()).rejects.toThrow("respuesta inválida");
    rpc.mockResolvedValue({ data: null, error: { message: "historial rechazado" } });
    await expect(run()).rejects.toThrow();
  });

  it("el conflicto de solapamiento médico conserva su error específico", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23P01", message: "overlap" } });
    const db = new MedicalDb({ rpc } as unknown as SupabaseClient);
    await expect(db.transitionApptStatus("id", "cancelado", "confirmada", "personal")).rejects.toBeInstanceOf(MedicalSlotConflictError);
  });

  it("el historial inicial médico no vuelve a escribir el estado de la cita", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    const db = new MedicalDb({ from } as unknown as SupabaseClient);
    await db.recordApptStatus("id", "confirmada", "sistema");
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("medical_status_updates");
    expect(insert).toHaveBeenCalledWith({ appointment_id: "id", status: "confirmada", created_by: "sistema" });
  });
});
