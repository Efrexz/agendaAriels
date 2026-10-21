import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { BookingPayload } from "./_booking.js";

// ─────────────────────────────────────────────────────────────
// Capa de datos server-side (service_role). Solo funciones de
// api/ pueden importarla: NUNCA exponer estas claves al navegador.
// RLS en Supabase deniega todo a anon/authenticated; aquí se usa
// service_role que la omite por diseño.
// ─────────────────────────────────────────────────────────────

export interface BookingRowInput {
  bookingCode: string;
  branch: string;
  branchLabel: string;
  serviceDate: string;
  timeSlot: string;
  ownerName: string;
  ownerDni: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerAddress: string;
  ownerLat: number | null;
  ownerLng: number | null;
  mapsUrl: string | null;
  hasHistory: boolean | null;
  registeredPetName: string;
  registeredPhone: string;
  petBirthDate: string;
  petSpecies: string;
  petBreed: string;
  petCastrated: boolean;
  mobilityPhoneDifferent: boolean;
  mobilityPhone: string;
  pets: BookingPayload["pets"];
}

export interface BookingRecord extends BookingRowInput {
  id: string;
  status: string;
  createdAt: string;
  whatsappDelivered: boolean;
}

export interface DayClosureRecord {
  branch: string;
  closureDate: string;
  timeSlot: string | null;
}

export type UniqueViolationCode = "23505";

/**
 * true si los dígitos de `phone` contienen `digits`. Los teléfonos se guardan
 * formateados (ej. "917-104-426" o "+51 917 104 426"), así que comparar por
 * dígitos evita fallar cuando el staff busca sin guiones/espacios/prefijo.
 */
export function phoneMatchesDigits(phone: string, digits: string): boolean {
  return phone.replace(/\D/g, "").includes(digits);
}

export interface StatusUpdateRecord {
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface BookingDb {
  insertBooking(row: BookingRowInput): Promise<{ code: UniqueViolationCode | null }>;
  findByCode(code: string): Promise<BookingRecord | null>;
  listClosures(fromDate: string): Promise<DayClosureRecord[]>;
  isClosed(branch: string, date: string, timeSlot: string): Promise<boolean>;
  recordStatus(
    bookingId: string,
    status: string,
    createdBy: string,
  ): Promise<void>;
  /** Cambio de estado atómico: solo gana quien partió del estado anterior. */
  transitionStatus(bookingId: string, from: string, to: string, createdBy: string): Promise<boolean>;
  countBookingsFor(branch: string, date: string, timeSlot: string | null): Promise<number>;
  setWhatsappDelivered(bookingId: string, delivered: boolean): Promise<void>;
  listStatusUpdates(bookingId: string): Promise<StatusUpdateRecord[]>;
  listUpdatesForBookings(bookingIds: string[]): Promise<Record<string, StatusUpdateRecord[]>>;
  findById(bookingId: string): Promise<BookingRecord | null>;
  searchBookings(query: string): Promise<BookingRecord[]>;
  createClosure(input: {
    branch: string;
    closureDate: string;
    timeSlot: string | null;
    reason: string;
    createdBy: string;
  }): Promise<{ code: UniqueViolationCode | null }>;
  deleteClosure(id: string): Promise<void>;
  listClosuresBetween(fromDate: string, toDate: string): Promise<(DayClosureRecord & { id: string; reason: string })[]>;
}

function rowToRecord(row: Record<string, unknown>): BookingRecord {
  return {
    id: String(row.id),
    bookingCode: String(row.booking_code),
    branch: String(row.branch),
    branchLabel: String(row.branch_label),
    serviceDate: String(row.service_date),
    timeSlot: String(row.time_slot),
    ownerName: String(row.owner_name),
    ownerDni: String(row.owner_dni),
    ownerPhone: String(row.owner_phone),
    ownerEmail: String(row.owner_email),
    ownerAddress: String(row.owner_address),
    ownerLat: row.owner_lat === null ? null : Number(row.owner_lat),
    ownerLng: row.owner_lng === null ? null : Number(row.owner_lng),
    mapsUrl: row.maps_url === null ? null : String(row.maps_url),
    hasHistory: row.has_history === null ? null : Boolean(row.has_history),
    registeredPetName: String(row.registered_pet_name),
    registeredPhone: String(row.registered_phone),
    petBirthDate: String(row.pet_birth_date),
    petSpecies: String(row.pet_species),
    petBreed: String(row.pet_breed),
    petCastrated: Boolean(row.pet_castrated),
    mobilityPhoneDifferent: Boolean(row.mobility_phone_different),
    mobilityPhone: String(row.mobility_phone),
    pets: (row.pets as BookingPayload["pets"]) ?? [],
    status: String(row.status),
    createdAt: String(row.created_at),
    whatsappDelivered: Boolean(row.whatsapp_delivered),
  };
}

export class SupabaseBookingDb implements BookingDb {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  static fromEnv(env: {
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  }): SupabaseBookingDb | null {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    return new SupabaseBookingDb(client);
  }

  async insertBooking(row: BookingRowInput): Promise<{ code: UniqueViolationCode | null }> {
    const { error } = await this.client.from("bookings").insert({
      booking_code: row.bookingCode,
      branch: row.branch,
      branch_label: row.branchLabel,
      service_date: row.serviceDate,
      time_slot: row.timeSlot,
      owner_name: row.ownerName,
      owner_dni: row.ownerDni,
      owner_phone: row.ownerPhone,
      owner_email: row.ownerEmail,
      owner_address: row.ownerAddress,
      owner_lat: row.ownerLat,
      owner_lng: row.ownerLng,
      maps_url: row.mapsUrl,
      has_history: row.hasHistory,
      registered_pet_name: row.registeredPetName,
      registered_phone: row.registeredPhone,
      pet_birth_date: row.petBirthDate,
      pet_species: row.petSpecies,
      pet_breed: row.petBreed,
      pet_castrated: row.petCastrated,
      mobility_phone_different: row.mobilityPhoneDifferent,
      mobility_phone: row.mobilityPhone,
      pets: row.pets,
    });
    if (!error) return { code: null };
    // Doble click / reenvío: el código ya existe → no es un error para el cliente.
    if (error.code === "23505") return { code: "23505" };
    throw new Error(`insertBooking falló: ${error.message}`);
  }

  async findByCode(code: string): Promise<BookingRecord | null> {
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("booking_code", code)
      .maybeSingle();
    if (error) throw new Error(`findByCode falló: ${error.message}`);
    return data ? rowToRecord(data) : null;
  }

  async listClosures(fromDate: string): Promise<DayClosureRecord[]> {
    const { data, error } = await this.client
      .from("day_closures")
      .select("branch, closure_date, time_slot")
      .gte("closure_date", fromDate);
    if (error) throw new Error(`listClosures falló: ${error.message}`);
    return (data ?? []).map((r) => ({
      branch: String(r.branch),
      closureDate: String(r.closure_date),
      timeSlot: r.time_slot === null ? null : String(r.time_slot),
    }));
  }

  async isClosed(branch: string, date: string, timeSlot: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("day_closures")
      .select("id")
      .eq("branch", branch)
      .eq("closure_date", date)
      .or(`time_slot.is.null,time_slot.eq.${timeSlot}`)
      .limit(1);
    if (error) throw new Error(`isClosed falló: ${error.message}`);
    return (data ?? []).length > 0;
  }

  async recordStatus(bookingId: string, status: string, createdBy: string): Promise<void> {
    const { error: updErr } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);
    if (updErr) throw new Error(`update status falló: ${updErr.message}`);
    const { error } = await this.client
      .from("status_updates")
      .insert({ booking_id: bookingId, status, created_by: createdBy });
    if (error) throw new Error(`recordStatus falló: ${error.message}`);
  }

  /** Cambio de estado atómico: si nadie más cambió el estado (evita doble
   * WhatsApp por carreras del panel), inserta el timeline y devuelve true. */
  async transitionStatus(bookingId: string, from: string, to: string, createdBy: string): Promise<boolean> {
    const { data, error: updErr } = await this.client
      .from("bookings")
      .update({ status: to })
      .eq("id", bookingId)
      .eq("status", from)
      .select("id");
    if (updErr) throw new Error(`transition status falló: ${updErr.message}`);
    if ((data ?? []).length === 0) return false;
    const { error } = await this.client
      .from("status_updates")
      .insert({ booking_id: bookingId, status: to, created_by: createdBy });
    if (error) throw new Error(`recordStatus falló: ${error.message}`);
    return true;
  }

  async countBookingsFor(branch: string, date: string, timeSlot: string | null): Promise<number> {
    let q = this.client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("branch", branch)
      .eq("service_date", date)
      .neq("status", "cancelado");
    if (timeSlot) q = q.eq("time_slot", timeSlot);
    const { count, error } = await q;
    if (error) throw new Error(`countBookingsFor falló: ${error.message}`);
    return count ?? 0;
  }

  async setWhatsappDelivered(bookingId: string, delivered: boolean): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ whatsapp_delivered: delivered })
      .eq("id", bookingId);
    if (error) throw new Error(`setWhatsappDelivered falló: ${error.message}`);
  }

  async listStatusUpdates(bookingId: string): Promise<StatusUpdateRecord[]> {
    const { data, error } = await this.client
      .from("status_updates")
      .select("status, created_by, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listStatusUpdates falló: ${error.message}`);
    return (data ?? []).map((r) => ({
      status: String(r.status),
      createdBy: String(r.created_by),
      createdAt: String(r.created_at),
    }));
  }

  async listUpdatesForBookings(
    bookingIds: string[],
  ): Promise<Record<string, StatusUpdateRecord[]>> {
    if (bookingIds.length === 0) return {};
    const { data, error } = await this.client
      .from("status_updates")
      .select("booking_id, status, created_by, created_at")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listUpdatesForBookings falló: ${error.message}`);
    const result: Record<string, StatusUpdateRecord[]> = {};
    for (const r of data ?? []) {
      const key = String(r.booking_id);
      (result[key] ??= []).push({
        status: String(r.status),
        createdBy: String(r.created_by),
        createdAt: String(r.created_at),
      });
    }
    return result;
  }

  async findById(bookingId: string): Promise<BookingRecord | null> {
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw new Error(`findById falló: ${error.message}`);
    return data ? rowToRecord(data) : null;
  }

  async listBookingsForDate(branch: string | null, date: string): Promise<BookingRecord[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("service_date", date)
      .neq("status", "cancelado")
      .order("created_at", { ascending: true });
    if (branch) query = query.eq("branch", branch);
    const { data, error } = await query;
    if (error) throw new Error(`listBookingsForDate falló: ${error.message}`);
    return (data ?? []).map(rowToRecord);
  }

  /** Búsqueda por código exacto, teléfono o nombre (mínimo 3 caracteres). */
  async searchBookings(query: string): Promise<BookingRecord[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    const upper = q.toUpperCase();
    if (/^VA-[A-Z0-9]{5}$/.test(upper)) {
      const byCode = await this.findByCode(upper);
      return byCode ? [byCode] : [];
    }
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 6) {
      // LIKE con dígitos contiguos no matchea teléfonos formateados
      // ("917-104-426"): se normalizan a dígitos en JS sobre las reservas
      // recientes (volumen pequeño; columna de dígitos si esto crece).
      const { data, error } = await this.client
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(`searchBookings falló: ${error.message}`);
      const hits = (data ?? [])
        .map(rowToRecord)
        .filter(
          (b) =>
            phoneMatchesDigits(b.ownerPhone, digits) ||
            (b.mobilityPhone !== "-" && phoneMatchesDigits(b.mobilityPhone, digits)),
        )
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
        .slice(0, 20);
      if (hits.length > 0) return hits;
    }
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .ilike("owner_name", `%${q}%`)
      .order("service_date", { ascending: false })
      .limit(20);
    if (error) throw new Error(`searchBookings falló: ${error.message}`);
    return data.map(rowToRecord);
  }

  async createClosure(input: {
    branch: string;
    closureDate: string;
    timeSlot: string | null;
    reason: string;
    createdBy: string;
  }): Promise<{ code: UniqueViolationCode | null }> {
    const { error } = await this.client.from("day_closures").insert({
      branch: input.branch,
      closure_date: input.closureDate,
      time_slot: input.timeSlot,
      reason: input.reason,
      created_by: input.createdBy,
    });
    if (!error) return { code: null };
    if (error.code === "23505") return { code: "23505" };
    throw new Error(`createClosure falló: ${error.message}`);
  }

  async deleteClosure(id: string): Promise<void> {
    const { error } = await this.client.from("day_closures").delete().eq("id", id);
    if (error) throw new Error(`deleteClosure falló: ${error.message}`);
  }

  async listClosuresBetween(
    fromDate: string,
    toDate: string,
  ): Promise<(DayClosureRecord & { id: string; reason: string })[]> {
    const { data, error } = await this.client
      .from("day_closures")
      .select("id, branch, closure_date, time_slot, reason")
      .gte("closure_date", fromDate)
      .lte("closure_date", toDate)
      .order("closure_date", { ascending: true });
    if (error) throw new Error(`listClosuresBetween falló: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      branch: String(r.branch),
      closureDate: String(r.closure_date),
      timeSlot: r.time_slot === null ? null : String(r.time_slot),
      reason: String(r.reason ?? ""),
    }));
  }
}
