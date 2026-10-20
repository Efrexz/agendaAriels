import { describe, it, expect } from "vitest";
import { computeFreeSlots, minuteToTime, weekdayOf, currentMinuteLima } from "./slots";

const FULL_DAY_BLOCK = { startMinute: null, endMinute: null };

describe("computeFreeSlots", () => {
  const base = {
    durationMinutes: 60,
    weekday: 1, // lunes
    schedules: [{ weekday: 1, startMinute: 540, endMinute: 780 }], // 9-13
    busy: [],
    timeOffBlocks: [],
  };

  it("trocea el bloque en slots de la duración configurada", () => {
    const slots = computeFreeSlots(base);
    expect(slots).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 600, endMinute: 660 },
      { startMinute: 660, endMinute: 720 },
      { startMinute: 720, endMinute: 780 },
    ]);
  });

  it("respeta el weekday: si no hay horario ese día, cero slots", () => {
    expect(computeFreeSlots({ ...base, weekday: 0 })).toEqual([]);
  });

  it("quita slots ocupados por citas activas", () => {
    const slots = computeFreeSlots({ ...base, busy: [{ startMinute: 600, durationMinutes: 60 }] });
    expect(slots.map((s) => s.startMinute)).toEqual([540, 660, 720]);
  });

  it("quita slots con solapamiento parcial de una cita", () => {
    const slots = computeFreeSlots({ ...base, busy: [{ startMinute: 650, durationMinutes: 60 }] });
    expect(slots.map((s) => s.startMinute)).toEqual([540, 720]);
  });

  it("ausencia de día completo elimina todo", () => {
    expect(computeFreeSlots({ ...base, timeOffBlocks: [FULL_DAY_BLOCK] })).toEqual([]);
  });

  it("ausencia de bloque de 2h elimina los slots cruzados", () => {
    const slots = computeFreeSlots({
      ...base,
      timeOffBlocks: [{ startMinute: 570, endMinute: 690 }], // 9:30-11:30
    });
    expect(slots.map((s) => s.startMinute)).toEqual([720]);
  });

  it("minStartMinute no ofrece slots pasados", () => {
    const slots = computeFreeSlots({ ...base, minStartMinute: 660 });
    expect(slots.map((s) => s.startMinute)).toEqual([660, 720]);
  });

  it("slots cortos: duración 30 genera mitad de slots", () => {
    const slots = computeFreeSlots({ ...base, durationMinutes: 30 });
    expect(slots).toHaveLength(8);
  });

  it("horario que no trae un slot completo no lo propone", () => {
    const slots = computeFreeSlots({
      ...base,
      schedules: [{ weekday: 1, startMinute: 750, endMinute: 770 }], // solo 20 min útiles
    });
    expect(slots).toEqual([]);
  });

  it("deduplica slots idénticos entre bloques contiguos", () => {
    const slots = computeFreeSlots({
      ...base,
      schedules: [
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 1, startMinute: 600, endMinute: 720 },
      ],
    });
    expect(slots).toHaveLength(2);
  });
});

describe("minuteToTime / weekdayOf / currentMinuteLima", () => {
  it("formatea minutos a hora", () => {
    expect(minuteToTime(540)).toBe("09:00");
    expect(minuteToTime(1145)).toBe("19:05");
  });

  it("weekdayOf calcula sin zona horaria (fecha calendario)", () => {
    expect(weekdayOf("2026-10-25")).toBe(0); // domingo
    expect(weekdayOf("2026-10-21")).toBe(3); // miércoles
  });

  it("currentMinuteLima devuelve minutos de Lima", () => {
    const feb = currentMinuteLima(new Date("2026-10-20T14:30:00Z")); // 9:30 Lima
    expect(feb).toBe(570);
  });
});
