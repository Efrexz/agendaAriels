import { getSupabaseClient } from "./supabaseClient";

// Cliente de /api/internal/lab/* para el panel (con JWT del staff).

export interface LabOrder {
  id: string;
  orderCode: string;
  sedeOrigen: string;
  sedeResponsable: string;
  labName: string;
  examType: string;
  petName: string;
  petType: string;
  historyCode: string;
  doctorName: string;
  ownerName: string;
  ownerPhone: string;
  paidNotes: string;
  notes: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  timeline?: Array<{ status: string; createdBy: string; createdAt: string }>;
}

export type LabView = "active" | "today" | "week";

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

export async function fetchLabList(
  view: LabView,
  sede: string,
  q: string,
): Promise<{ orders: LabOrder[] }> {
  const sedeParam = sede === "all" ? "" : `&sede=${encodeURIComponent(sede)}`;
  const qParam = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
  return authedFetch(`/api/internal/lab/list?view=${view}${sedeParam}${qParam}`);
}

export async function createLabOrder(input: {
  sedeOrigen: string;
  sedeResponsable: string;
  labName: string;
  examType: string;
  petName: string;
  petType: string;
  historyCode?: string;
  doctorName?: string;
  ownerName: string;
  ownerPhone: string;
  paidNotes?: string;
  notes?: string;
}): Promise<{ orderCode: string; notified: boolean }> {
  return authedFetch("/api/internal/lab/create", {
    method: "POST",
    body: JSON.stringify({ ...input, historyCode: input.historyCode || "-", doctorName: input.doctorName || "-", paidNotes: input.paidNotes || "-", notes: input.notes || "-" }),
  });
}

export async function patchLabStatus(
  orderId: string,
  status: string,
): Promise<{ status: string; notified: boolean }> {
  return authedFetch("/api/internal/lab/status", {
    method: "PATCH",
    body: JSON.stringify({ id: orderId, status }),
  });
}

export async function fetchLabCatalog(): Promise<{ exams: string[]; labs: string[] }> {
  return authedFetch("/api/internal/lab/catalog");
}

/** Agrega un examen/laboratorio nuevo al catálogo global (idempotente). */
export async function addLabCatalogItem(kind: "exam" | "lab", name: string): Promise<string> {
  const res = await authedFetch("/api/internal/lab/catalog", {
    method: "POST",
    body: JSON.stringify({ kind, name }),
  });
  return (res as { name: string }).name;
}
