import { describe, it, expect } from "vitest";
import { buildEscPosTicket, type QzBookingLike } from "./qz";

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
