import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { phoneMatchesDigits } from "../db.js";

// ─────────────────────────────────────────────────────────────
// Repositorio LABORATORIO (service_role). Espejo exacto de
// api/medical/db.ts: RLS deny-all en la nube, acceso solo desde
// api/. Exámenes externos que hoy viven en un cuaderno.
// ─────────────────────────────────────────────────────────────

const VALID_LAB_STATUSES = [
  "recibida", "en_laboratorio", "resultado_listo", "entregada", "cancelado",
];

export function isValidLabStatus(s: string): boolean {
  return VALID_LAB_STATUSES.includes(s);
}

export interface LabOrderInput {
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
}

export interface LabOrderRecord extends Omit<LabOrderInput, "orderCode"> {
  id: string;
  orderCode: string;
  createdAt: string;
  updatedAt: string;
}

export type UniqueViolation = "23505";

interface LabDbRow {
  id: string;
  order_code: string;
  sede_origen: string;
  sede_responsable: string;
  lab_name: string;
  exam_type: string;
  pet_name: string;
  pet_type: string;
  history_code: string;
  doctor_name: string;
  owner_name: string;
  owner_phone: string;
  paid_notes: string;
  notes: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToRecord(r: LabDbRow): LabOrderRecord {
  return {
    id: r.id,
    orderCode: r.order_code,
    sedeOrigen: r.sede_origen,
    sedeResponsable: r.sede_responsable,
    labName: r.lab_name,
    examType: r.exam_type,
    petName: r.pet_name,
    petType: r.pet_type,
    historyCode: r.history_code,
    doctorName: r.doctor_name,
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
    paidNotes: r.paid_notes,
    notes: r.notes,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const LAB_COLUMNS =
  "id, order_code, sede_origen, sede_responsable, lab_name, exam_type, pet_name, pet_type, " +
  "history_code, doctor_name, owner_name, owner_phone, paid_notes, notes, status, " +
  "created_by, created_at, updated_at";

export class LabDb {
  constructor(private client: SupabaseClient) {}

  static fromEnv(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }): LabDb | null {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return new LabDb(
      createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      }),
    );
  }

  async insertOrder(row: LabOrderInput): Promise<{ code: UniqueViolation | null; id: string | null }> {
    const { data, error } = await this.client
      .from("lab_orders")
      .insert({
        order_code: row.orderCode,
        sede_origen: row.sedeOrigen,
        sede_responsable: row.sedeResponsable,
        lab_name: row.labName,
        exam_type: row.examType,
        pet_name: row.petName,
        pet_type: row.petType,
        history_code: row.historyCode,
        doctor_name: row.doctorName,
        owner_name: row.ownerName,
        owner_phone: row.ownerPhone,
        paid_notes: row.paidNotes,
        notes: row.notes,
        status: row.status,
        created_by: row.createdBy,
      })
      .select("id")
      .single();
    if (!error && data) return { code: null, id: String(data.id) };
    if (error && error.code === "23505") return { code: "23505", id: null };
    if (error) throw new Error(`insertOrder: ${error.message}`);
    return { code: null, id: null };
  }

  async recordOrderStatus(orderId: string, status: string, createdBy: string): Promise<void> {
    const { error } = await this.client
      .from("lab_status_updates")
      .insert({ order_id: orderId, status, created_by: createdBy });
    if (error) throw new Error(`recordOrderStatus: ${error.message}`);
  }

  async findOrderByCode(code: string): Promise<LabOrderRecord | null> {
    const { data, error } = await this.client
      .from("lab_orders")
      .select(LAB_COLUMNS)
      .eq("order_code", code)
      .maybeSingle();
    if (error) throw new Error(`findOrderByCode: ${error.message}`);
    return data ? rowToRecord(data as unknown as LabDbRow) : null;
  }

  async findOrderById(id: string): Promise<LabOrderRecord | null> {
    const { data, error } = await this.client
      .from("lab_orders")
      .select(LAB_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`findOrderById: ${error.message}`);
    return data ? rowToRecord(data as unknown as LabDbRow) : null;
  }

  /** Órdenes "en curso" (sin entregar ni cancelar). Con sede: las que la sede
   *  originó O las que tiene como responsable (caso ecografía entre sedes). */
  async listActiveOrders(sede: string | null): Promise<LabOrderRecord[]> {
    let q = this.client
      .from("lab_orders")
      .select(LAB_COLUMNS)
      .in("status", ["recibida", "en_laboratorio", "resultado_listo"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (sede) q = q.or(`sede_origen.eq.${sede},sede_responsable.eq.${sede}`);
    const { data, error } = await q;
    if (error) throw new Error(`listActiveOrders: ${error.message}`);
    return (data ?? []).map((r) => rowToRecord(r as unknown as LabDbRow));
  }

  /** Órdenes registradas en un rango de fechas (hoy/semana), por created_at. */
  async listOrdersByCreated(sede: string | null, fromIso: string, toIso: string): Promise<LabOrderRecord[]> {
    let q = this.client
      .from("lab_orders")
      .select(LAB_COLUMNS)
      .neq("status", "cancelado")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(100);
    if (sede) q = q.or(`sede_origen.eq.${sede},sede_responsable.eq.${sede}`);
    const { data, error } = await q;
    if (error) throw new Error(`listOrdersByCreated: ${error.message}`);
    return (data ?? []).map((r) => rowToRecord(r as unknown as LabDbRow));
  }

  /** Búsqueda por código exacto / teléfono / mascota / historia / dueño. */
  async searchOrders(q: string, sede: string | null): Promise<LabOrderRecord[]> {
    const query = q.trim();
    if (query.length < 3) return [];
    const upper = query.toUpperCase();
    if (/^LAB-[A-Z0-9]{5}$/.test(upper)) {
      const one = await this.findOrderByCode(upper);
      return one ? [one] : [];
    }
    const digits = query.replace(/\D/g, "");
    if (digits.length >= 6) {
      // Teléfonos formateados ("917-104-426"): comparación por dígitos en JS.
      const { data, error } = await this.client
        .from("lab_orders")
        .select(LAB_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(`searchOrders phone: ${error.message}`);
      const hits = (data ?? [])
        .map((r) => rowToRecord(r as unknown as LabDbRow))
        .filter((o) => phoneMatchesDigits(o.ownerPhone, digits))
        .slice(0, 20);
      if (hits.length > 0) return hits;
    }
    let q2 = this.client
      .from("lab_orders")
      .select(LAB_COLUMNS)
      .or(`owner_name.ilike.%${query}%,pet_name.ilike.%${query}%,history_code.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (sede) q2 = q2.or(`sede_origen.eq.${sede},sede_responsable.eq.${sede}`);
    const { data, error } = await q2;
    if (error) throw new Error(`searchOrders name: ${error.message}`);
    return (data ?? []).map((r) => rowToRecord(r as unknown as LabDbRow));
  }

  /** Cambio de estado ATÓMICO (mismo estándar medical/grooming): solo gana
   *  quien partió del estado anterior — doble click no duplica WhatsApp. */
  async transitionOrderStatus(orderId: string, from: string, to: string, createdBy: string): Promise<boolean> {
    const { data, error: updErr } = await this.client
      .from("lab_orders")
      .update({ status: to })
      .eq("id", orderId)
      .eq("status", from)
      .select("id");
    if (updErr) throw new Error(`transitionOrderStatus: ${updErr.message}`);
    if ((data ?? []).length === 0) return false;
    const { error } = await this.client
      .from("lab_status_updates")
      .insert({ order_id: orderId, status: to, created_by: createdBy });
    if (error) throw new Error(`transitionOrderStatus timeline: ${error.message}`);
    return true;
  }

  async listStatusUpdatesMany(
    orderIds: string[],
  ): Promise<Record<string, { status: string; createdBy: string; createdAt: string }[]>> {
    if (orderIds.length === 0) return {};
    const { data, error } = await this.client
      .from("lab_status_updates")
      .select("order_id, status, created_by, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listStatusUpdatesMany: ${error.message}`);
    const out: Record<string, { status: string; createdBy: string; createdAt: string }[]> = {};
    for (const r of data ?? []) {
      const key = String(r.order_id);
      (out[key] ??= []).push({
        status: String(r.status),
        createdBy: String(r.created_by),
        createdAt: String(r.created_at),
      });
    }
    return out;
  }
}
