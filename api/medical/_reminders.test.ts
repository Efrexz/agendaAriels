import { describe, it, expect } from "vitest";
import { buildReminderMessage, buildCounterReminderSummary } from "./_reminders";

const appt = {
  apptDate: "2026-10-21",
  startMinute: 600,
  branch: "san_miguel",
  doctorName: "Dr. Ejemplo Ramos",
  specialtyName: null,
  petName: "Manolo",
  ownerName: "Juan Pérez",
  needsOrder: false,
};

describe("buildReminderMessage", () => {
  it("contiene fecha, hora, sede y doctor", () => {
    const msg = buildReminderMessage(appt);
    expect(msg).toContain("Recordatorio");
    expect(msg).toContain("21/10/2026");
    expect(msg).toContain("10:00 am");
    expect(msg).toContain("San Miguel");
    expect(msg).toContain("Dr. Ejemplo Ramos");
    expect(msg).toContain("tolerancia es de 10 minutos");
  });

  it("cita de rayos recuerda la orden médica", () => {
    expect(buildReminderMessage({ ...appt, doctorName: null, needsOrder: true })).toContain("orden médica sellada");
  });

  it("sin doctor muestra la especialidad o consulta general", () => {
    const msg = buildReminderMessage({ ...appt, doctorName: null, specialtyName: "Cardiología" });
    expect(msg).toContain("Cardiología");
  });
});

describe("buildCounterReminderSummary", () => {
  it("lista ordenada por hora con código y teléfonos", () => {
    const summary = buildCounterReminderSummary(
      [
        { ...appt, appointmentCode: "CM-AAA11", ownerPhone: "999111222" },
        { ...appt, startMinute: 540, apptDate: "2026-10-21", branch: "los_olivos", petName: "Kira", ownerName: "Ana Test", ownerPhone: "988000111", appointmentCode: "CM-BBB22" },
      ],
      "2026-10-21",
    );
    expect(summary).toContain("21/10/2026");
    expect(summary.indexOf("CM-BBB22")).toBeLessThan(summary.indexOf("CM-AAA11")); // orden por hora
    expect(summary).toContain("999111222");
    expect(summary).toContain("2 recordatorio(s)");
  });

  it("lista vacía: mensaje sin citas", () => {
    expect(buildCounterReminderSummary([], "2026-10-21")).toContain("sin citas");
  });
});
