import { describe, it, expect } from "vitest";
import { buildEscPosTicket, buildMedicalTicket, type QzBookingLike, type MedApptLike } from "./qz";

const booking: QzBookingLike = {
  bookingCode: "VA-7K2PM",
  branchLabel: "Sede San Miguel",
  serviceDate: "2026-10-25",
  timeSlot: "9-11",
  ownerName: "Juan Pérez",
  ownerPhone: "999-111-222",
  ownerAddress: "Av. Brigida Silva 500",
  pets: [
    {
      name: "Rocky",
      type: "Perro",
      service: "Baño y Corte",
      size: "Mediano",
      bathType: "Hidratado Premium",
      corteType: "Rapado",
      corteSpecs: "Cola peluda",
      extras: ["Antipulgas"],
      perfume: "Frutal",
      notes: "Cuidado con la oreja",
    },
  ],
};

describe("buildEscPosTicket", () => {
  it("incluye los datos clave y termina en corte parcial", () => {
    const ticket = buildEscPosTicket(booking);
    expect(ticket).toContain("VETERINARIA ARIEL");
    expect(ticket).toContain("Sede San Miguel");
    expect(ticket).toContain("VA-7K2PM");
    expect(ticket).toContain("25/10/2026");
    expect(ticket).toContain("ROCKY (Perro)");
    expect(ticket.endsWith("\x1D\x56\x42\x00")).toBe(true); // GS V 66 0
  });

  it("boleta en ASCII puro: sin acentos ni emojis (tabla de la térmica)", () => {
    const ticket = buildEscPosTicket(booking);
    expect(ticket).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
    expect(ticket).toContain("Cuidado con la oreja");
  });

  it("ninguna línea de texto supera las columnas útiles (48)", () => {
    const ESC = String.fromCharCode(27);
    const anchoImpreso = (raw: string): number => {
      let clean = "";
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === ESC) {
          i++; // secuencia de control: saltar su letra
        } else if (raw.charCodeAt(i) > 31) {
          clean += raw[i];
        }
      }
      return clean.length;
    };
    for (const raw of buildEscPosTicket(booking).split("\n")) {
      expect(anchoImpreso(raw)).toBeLessThanOrEqual(48);
    }
  });
});

const appt: MedApptLike = {
  appointmentCode: "CM-7K2PM",
  branchLabel: "San Miguel",
  serviceLabel: "Radiografía",
  specialtyName: null,
  doctorName: "Dr. Nolasco Ramos",
  apptDate: "2026-11-20",
  startMinute: 930,
  petName: "Rocky",
  petType: "Perro",
  petNotes: "Cuidado con la oreja",
  ownerName: "Juan Pérez",
  ownerPhone: "999-111-222",
};

describe("buildMedicalTicket", () => {
  it("incluye los datos clave y termina en corte parcial", () => {
    const ticket = buildMedicalTicket(appt);
    expect(ticket).toContain("VETERINARIA ARIEL");
    expect(ticket).toContain("San Miguel");
    expect(ticket).toContain("CM-7K2PM");
    expect(ticket).toContain("ROCKY (PERRO)");
    expect(ticket).toContain("Consulta: Radiografia");
    expect(ticket).toContain("20/11/2026");
    expect(ticket).toContain("3:30 pm");
    expect(ticket).toContain("Doctor(a): Dr. Nolasco Ramos");
    expect(ticket).toContain("Indicac: Cuidado con la oreja");
    expect(ticket).toContain("Recordatorio interno");
    // Ticket de cartelera interna: sin costos ni mensajes para el cliente.
    expect(ticket).not.toContain("Inversión");
    expect(ticket).not.toContain("Gracias por su confianza");
    expect(ticket.endsWith("\x1D\x56\x42\x00")).toBe(true); // GS V 66 0
  });

  it("ticket en ASCII puro: sin acentos ni emojis (tabla de la térmica)", () => {
    const ticket = buildMedicalTicket({ ...appt, branchLabel: "San Martín", ownerName: "José Ñuñez" });
    expect(ticket).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
    expect(ticket).toContain("San Martin");
    expect(ticket).toContain("Jose Nunez");
  });

  it("especialidad interconsultada aparece junto al servicio", () => {
    const ticket = buildMedicalTicket({ ...appt, serviceLabel: "Consulta Especializada", specialtyName: "Cardiología" });
    expect(ticket).toContain("Consulta: Consulta Especializada - Cardiologia");
  });

  it("sin doctor/fecha/hora (cita sin confirmar del todo) no rompe el ticket", () => {
    const ticket = buildMedicalTicket({ ...appt, doctorName: null, apptDate: null, startMinute: null });
    expect(ticket).toContain("Fecha: por confirmar");
    expect(ticket).toContain("Hora: por confirmar");
    expect(ticket).not.toContain("Doctor(a):");
  });

  it("código y mascota van en doble altura/ancho (legibles desde la cartelera)", () => {
    const ticket = buildMedicalTicket(appt);
    expect(ticket).toContain("\x1B!\x30CM-7K2PM\x1B!\x00");
    expect(ticket).toContain("\x1B!\x30ROCKY (PERRO)\x1B!\x00");
  });

  it("texto largo cae a tamaño normal: no se sale del papel a doble ancho", () => {
    const ticket = buildMedicalTicket({
      ...appt,
      petName: "Concepcion De La Milagros Del Carmen",
    });
    // 36 + 8 = 44 chars > 24 → esa línea va en tamaño normal (sin ESC ! 48)
    expect(ticket).not.toContain(`\x1B!\x30CONCEPCION`);
    expect(ticket).toContain("CONCEPCION DE LA MILAGROS DEL CARMEN (PERRO)");
  });

  it("ninguna línea de texto supera las columnas útiles (48)", () => {
    const ESC = String.fromCharCode(27);
    const anchoImpreso = (raw: string): number => {
      let clean = "";
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === ESC) {
          i++; // secuencia de control: saltar su letra
        } else if (raw.charCodeAt(i) > 31) {
          clean += raw[i];
        }
      }
      return clean.length;
    };
    for (const raw of buildMedicalTicket(appt).split("\n")) {
      expect(anchoImpreso(raw)).toBeLessThanOrEqual(48);
    }
  });
});
