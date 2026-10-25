import { getSupabaseClient } from "./supabaseClient";

// Wrapper de llamadas a /api/internal/* con el JWT del staff.

export interface PanelPet {
  name: string;
  type: string;
  service: string;
  size: string;
  bathType: string;
  corteType: string;
  corteSpecs: string;
  extras: string[];
  perfume: string;
  notes: string;
  corteImage: string | null;
}

export interface PanelBooking {
  id: string;
  bookingCode: string;
  branch: string;
  branchLabel: string;
  serviceDate: string;
  timeSlot: string;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  mapsUrl: string | null;
  status: string;
  whatsappDelivered?: boolean;
  pets: PanelPet[];
  createdAt: string;
  timeline?: Array<{ status: string; createdBy: string; createdAt: string }>;
}

export interface PanelClosure {
  id: string;
  branch: string;
  closureDate: string;
  timeSlot: string | null;
  reason: string;
}

async function authedFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) {
    if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    throw new Error(body.error ?? `Error del servidor (${res.status})`);
  }
  return body;
}

export async function fetchDay(date: string, branch: string | "all"): Promise<{ bookings: PanelBooking[] }> {
  const params = new URLSearchParams({ date });
  if (branch !== "all") params.set("branch", branch);
  return authedFetch(`/api/internal/day?${params.toString()}`);
}

/** Historial del panel: rango de fechas (hasta un mes, incluyen canceladas). */
export async function fetchHistory(
  fromDate: string,
  toDate: string,
  branch: string | "all",
): Promise<{ bookings: PanelBooking[] }> {
  const params = new URLSearchParams({ from: fromDate, to: toDate });
  if (branch !== "all") params.set("branch", branch);
  return authedFetch(`/api/internal/history?${params.toString()}`);
}

export async function searchBookings(q: string): Promise<{ results: PanelBooking[] }> {
  return authedFetch(`/api/internal/search?q=${encodeURIComponent(q)}`);
}

export async function updateStatus(
  bookingId: string,
  status: string,
): Promise<{ status: string; notified: boolean; stale?: boolean }> {
  return authedFetch("/api/internal/status", {
    method: "POST",
    body: JSON.stringify({ bookingId, status }),
  });
}

export async function resendWhatsapp(
  bookingId: string,
): Promise<{ ok: boolean; resent: boolean; reason?: string }> {
  return authedFetch("/api/internal/resend", {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  });
}

export async function fetchClosures(): Promise<{ closures: PanelClosure[] }> {
  return authedFetch("/api/internal/closures");
}

export async function createClosure(input: {
  branch: string;
  date: string;
  timeSlot: string | null;
  reason: string;
}): Promise<{ ok: boolean; affected?: number }> {
  return authedFetch("/api/internal/closures", {
    method: "POST",
    body: JSON.stringify({
      branch: input.branch,
      date: input.date,
      timeSlot: input.timeSlot,
      reason: input.reason,
    }),
  });
}

export async function deleteClosure(id: string): Promise<{ ok: boolean }> {
  return authedFetch(`/api/internal/closures?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
