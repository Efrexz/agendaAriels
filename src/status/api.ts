import type { TrackingBooking, TrackingLab } from "./types";

export type TrackingResult = TrackingBooking | TrackingLab;

export function isLabCode(code: string): boolean {
  return /^LAB-/.test(code.trim().toUpperCase());
}

export function isLabTracking(t: TrackingResult): t is TrackingLab {
  return "orderCode" in t;
}

export async function fetchTracking(code: string): Promise<TrackingResult> {
  const isLab = isLabCode(code);
  const path = isLab ? "/api/lab-status" : "/api/status";
  const res = await fetch(`${path}?code=${encodeURIComponent(code)}`);
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    booking?: TrackingBooking;
    order?: TrackingLab;
  };
  if (isLab) {
    if (!res.ok || !body.ok || !body.order) {
      throw new Error(body.error ?? "No encontramos una orden con ese código.");
    }
    return body.order;
  }
  if (!res.ok || !body.ok || !body.booking) {
    throw new Error(body.error ?? "No encontramos una reserva con ese código.");
  }
  return body.booking;
}
