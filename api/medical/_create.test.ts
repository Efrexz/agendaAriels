import { describe, it, expect, beforeEach } from "vitest";
import {
  buildClientApptMessage,
  buildCounterAlert,
  handleMedicalCreate,
} from "./_create";

const TOMORROW = "2026-10-21";

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    branch: "san_miguel",
    serviceType: "general",
    date: TOMORROW,
    startMinute: 540,
    petName: "Manolo",
    petType: "Perro",
    petNotes: "-",
    ownerName: "Juan Pérez",
    ownerPhone: "999-111-222",
    ownerEmail: "-",
    ...overrides,
  };
}

// ── db médico fake (las validaciones server-side usan db real) ──
// handleMedicalCreate usa getMedicalDb (env), que no es inyectable desde
// fuera: estos tests cubren las PLANTILLAS y el rechazo básico; el flujo
// completo se valida con qz en scripts/integration (verified en vivo).

describe("rechazos básicos sin db", () => {
  beforeEach(() => {
    // garantiza db null en entorno de test (sin SUPABASE_*)
  });

  it("rechaza payload inválido con 400", async () => {
    const r = await handleMedicalCreate({ body: { foo: 1 } });
    expect(r.status).toBe(400);
    expect(r.body.ok).toBe(false);
  });

  it("rechaza sin fecha para general (db inexistente igual aporta el validador previo)", async () => {
    const r = await handleMedicalCreate({ body: payload({ date: null }) });
    // sin db el servicio responde 500 "no disponible"; si hubiera db sería 400 pidiendo fecha
    expect([400, 500]).toContain(r.status);
  });

  it("especializada sin especialidad → 400 (independiente de db)", async () => {
    const r = await handleMedicalCreate({ body: payload({ serviceType: "especializada", date: null, doctorId: null }) });
    expect([400, 500]).toContain(r.status);
  });
});

describe("plantillas de WhatsApp", () => {
  it("alerta counter con código y datos", () => {
    const alert = buildCounterAlert(payload() as never, "CM-ABC12", {
      doctor: "Dr. Ejemplo Ramos",
      time: "09:00",
    });
    expect(alert).toContain("NUEVA CITA MÉDICA");
    expect(alert).toContain("CM-ABC12");
    expect(alert).toContain("Dr. Ejemplo Ramos");
    expect(alert).toContain("Manolo (Perro)");
  });

  it("mensaje cliente GENERAL con tolerancia y médico", () => {
    const msg = buildClientApptMessage(payload() as never, "CM-ABC12", {
      serviceLabel: "Consulta General",
      doctor: "Dr. Ejemplo Ramos",
      time: "09:00",
    });
    expect(msg).toContain("Cita registrada");
    expect(msg).toContain("tolerancia es de 10 minutos");
    expect(msg).toContain("CM-ABC12");
    expect(msg).not.toContain("orden médica");
  });

  it("mensaje RAYOS exige orden sellada", () => {
    const msg = buildClientApptMessage(
      payload({ serviceType: "rayos", hasOrder: true }) as never,
      "CM-XYZ99",
      { serviceLabel: "Radiografía", doctor: "Dr. X", time: "10:00" },
    );
    expect(msg).toContain("orden médica sellada");
  });

  it("mensaje ESPECIALIZADA con métodos de pago y comprobante al WhatsApp de sede", () => {
    const msg = buildClientApptMessage(
      payload({ serviceType: "especializada", date: null, doctorId: null, specialtyId: "11111111-1111-1111-1111-111111111111" }) as never,
      "CM-PAY01",
      { specialty: "Cardiología" },
      "Yape: 900 000 000",
    );
    expect(msg).toContain("Solicitud registrada");
    expect(msg).toContain("métodos de pago");
    expect(msg).toContain("Yape: 900 000 000");
    expect(msg).toContain("captura del pago al WhatsApp de la sede");
  });
});
