import type { TrackingBooking } from "./types";

export async function fetchTracking(code: string): Promise<TrackingBooking> {
  const res = await fetch(`/api/status?code=${encodeURIComponent(code)}`);
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    booking?: TrackingBooking;
  };
  if (!res.ok || !body.ok || !body.booking) {
    throw new Error(body.error ?? "No encontramos una reserva con ese código.");
  }
  return body.booking;
}
