import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MedicalDb, type MedicalAppointmentInput } from "./db.js";
import { MedicalSlotConflictError } from "./errors.js";

const row: MedicalAppointmentInput = {
  appointmentCode: "CM-TEST1", branch: "san_miguel", serviceType: "general", specialtyId: null,
  doctorId: "doctor", apptDate: "2026-11-02", startMinute: 540, durationMinutes: 60,
  needsOrder: false, hasOrder: null, status: "confirmada", petName: "Mascota", petType: "Perro",
  petNotes: "-", ownerName: "Cliente", ownerPhone: "999111222", ownerEmail: "-",
  paymentNotes: "-", createdByClient: true, createdBy: "-",
};

describe("MedicalDb: conflictos atómicos", () => {
  it("distingue exclusión de solapamiento de colisión de código al insertar", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23P01", message: "overlap" } });
    const client = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) };
    const db = new MedicalDb(client as unknown as SupabaseClient);
    await expect(db.insertAppointment(row)).rejects.toBeInstanceOf(MedicalSlotConflictError);
    single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    await expect(db.insertAppointment(row)).resolves.toEqual({ code: "23505", id: null });
  });

  it("la asignación condiciona al estado previo observado y no registra historial si otro usuario ya la cambió", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const client = { rpc };
    const db = new MedicalDb(client as unknown as SupabaseClient);
    await expect(db.assignAppt("id", { doctorId: "doctor" }, "staff", "asignada", "pagado")).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith("api_medical_assign", { p_id: "id", p_patch: { doctor_id: "doctor" }, p_status: "asignada", p_actor: "staff", p_from: "pagado" });
  });

  it("desde una SOLICITUD de próxima semana también puede asignar (p_from solicitud)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const db = new MedicalDb({ rpc } as unknown as SupabaseClient);
    await expect(db.assignAppt("id", { doctorId: "d", apptDate: "2026-11-09", startMinute: 540 }, "staff", "confirmada", "solicitud")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("api_medical_assign", expect.objectContaining({ p_from: "solicitud", p_status: "confirmada" }));
  });

  it("una exclusión al asignar produce error de horario sin escribir historial", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23P01", message: "overlap" } });
    const client = { rpc };
    const db = new MedicalDb(client as unknown as SupabaseClient);
    await expect(db.assignAppt("id", { doctorId: "doctor" }, "staff", "asignada")).rejects.toBeInstanceOf(MedicalSlotConflictError);
  });
});
