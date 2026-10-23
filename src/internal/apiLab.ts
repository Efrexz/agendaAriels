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
  resultPath: string | null;
  resultName: string | null;
  resultPublishedAt: string | null;
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

// ── Resultado (Storage privado, ventana 20 días) ─────────────

const RESULT_MIME_OK = ["application/pdf", "image/jpeg", "image/png"] as const;

export interface LabResultInfo {
  resultPath: string | null;
  resultName: string | null;
  resultPublishedAt: string | null;
}

/** Sube DIRECTO al bucket privado desde el navegador (JWT del staff; política
 *  "staff upload lab results"). Devuelve la ruta/servicio generado. */
export async function uploadLabResultFile(
  orderId: string,
  file: File,
  orderCode: string,
): Promise<{ path: string }> {
  if (!RESULT_MIME_OK.includes(file.type as (typeof RESULT_MIME_OK)[number])) {
    throw new Error("Formato no permitido: usa PDF, JPG o PNG.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("El archivo supera 25 MB.");
  }
  const client = getSupabaseClient();
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  // Nombre por CÓDIGO de orden (no por datos del dueño)
  const path = `${orderId}/${orderCode}-resultado-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("lab-results").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error(`No pudimos subir el archivo: ${error.message}`);
  return { path };
}

export async function publishLabResult(input: {
  id: string;
  path: string;
  name: string;
  mime: string;
  size: number;
}): Promise<{ ok: boolean }> {
  return authedFetch("/api/internal/lab/result", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getLabResultUrl(id: string): Promise<{ url: string; name: string }> {
  return authedFetch(`/api/internal/lab/result?id=${encodeURIComponent(id)}`);
}

export async function deleteLabResult(id: string): Promise<{ ok: boolean }> {
  return authedFetch(`/api/internal/lab/result?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
