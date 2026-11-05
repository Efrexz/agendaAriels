import { describe, it, expect, vi, beforeEach } from "vitest";

// Reenvío del aviso de WhatsApp (endpoint interno del panel): el texto depende
// del estado ACTUAL de la cita y la entrega se marca en el historial.

const db = {
  findApptById: vi.fn(),
  getConfig: vi.fn(),
  recordWhatsappNotice: vi.fn(async () => undefined),
};

vi.mock("./_shared.js", () => ({
  getMedicalDb: () => db,
  BRANCH_LABELS: { san_miguel: "Sede San Miguel" },
  BRANCH_PHONES: { san_miguel: "519999999" },
  notConfigured: () => false,
  staffGuard: async () => ({ email: "counter@ariel.test" }),
}));
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "5199999999",
  sendViaEvolution: vi.fn(),
}));
const { default: handler } = await import("./_resend_notice.js");

const appt = {
  id: "00000000-0000-4000-8000-000000000001", appointmentCode: "CM-TEST1", branch: "san_miguel", serviceType: "general",
  specialtyName: null, doctorName: "Dr. Lunes", apptDate: "2026-11-09", startMinute: 630,
  durationMinutes: 60, needsOrder: false, hasOrder: null, status: "pendiente",
  petName: "Rex", petType: "perro", ownerName: "Dueño QA", ownerPhone: "999111222",
};

function res() {
  const out = { code: 0, body: null as unknown, status(c: number) { this.code = c; return this; }, json(p: unknown) { this.body = p; return this; } };
  return out;
}

describe("reenvío de aviso médico (M1)", () => {
  beforeEach(async () => {
    vi.stubEnv("EVOLUTION_API_URL", "https://evo-prueba.test");
    vi.stubEnv("EVOLUTION_API_KEY", "qa");
    vi.stubEnv("EVOLUTION_INSTANCE", "qa-inst");
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    const evo = (await import("../_booking.js")) as unknown as { sendViaEvolution: ReturnType<typeof vi.fn> };
    evo.sendViaEvolution.mockReset();
    db.findApptById.mockReset().mockResolvedValue(appt);
    db.getConfig.mockReset().mockResolvedValue({ appt_duration_minutes: "60", payment_info: "-" });
    db.recordWhatsappNotice.mockReset().mockResolvedValue(undefined);
  });

  it("pendiente → reenvía el RECIBO original y marca wa_entregado", async () => {
    const mod = await import("./_resend_notice.js");
    const mod2 = mod; // (import mock concretado arriba)
    void mod2;
    const evo = (await import("../_booking.js")) as unknown as { sendViaEvolution: ReturnType<typeof vi.fn> };
    evo.sendViaEvolution.mockResolvedValue({ ok: true });
    const r = res();
    await handler({ method: "POST", body: { id: appt.id }, headers: {} }, r);
    expect(r.code).toBe(200);
    const { ok, sent } = r.body as { ok: boolean; sent: boolean };
    expect(ok).toBe(true);
    expect(sent).toBe(true);
    const texto = evo.sendViaEvolution.mock.calls[0][0][0] as string;
    expect(texto).toContain("CM-TEST1");
    expect(texto).toContain("Cita registrada");
    expect(db.recordWhatsappNotice).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", true);
  });

  it("confirmada → reenvía el MENSAJE DE CONFIRMACIÓN (no el recibo)", async () => {
    db.findApptById.mockResolvedValue({ ...appt, status: "confirmada" });
    const evo = (await import("../_booking.js")) as unknown as { sendViaEvolution: ReturnType<typeof vi.fn> };
    evo.sendViaEvolution.mockResolvedValue({ ok: true });
    const r = res();
    await handler({ method: "POST", body: { id: appt.id }, headers: {} }, r);
    const texto = evo.sendViaEvolution.mock.calls[0][0][0] as string;
    expect(texto).toMatch(/confirmad/i);
  });

  it("Evolution caída → sent:false y marca wa_fallado", async () => {
    const evo = (await import("../_booking.js")) as unknown as { sendViaEvolution: ReturnType<typeof vi.fn> };
    evo.sendViaEvolution.mockResolvedValue({ ok: false, error: "código 502" });
    const r = res();
    await handler({ method: "POST", body: { id: appt.id }, headers: {} }, r);
    expect((r.body as { sent: boolean }).sent).toBe(false);
    expect(db.recordWhatsappNotice).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", false);
  });

  it("sin Evolution configurada → 503 con guía para el counter", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "");
    vi.stubEnv("EVOLUTION_API_KEY", "");
    vi.stubEnv("EVOLUTION_INSTANCE", "");
    const r = res();
    await handler({ method: "POST", body: { id: appt.id }, headers: {} }, r);
    expect(r.code).toBe(503);
    expect((r.body as { error: string }).error).toMatch(/WhatsApp no está disponible/i);
  });
});
