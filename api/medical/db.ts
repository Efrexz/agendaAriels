import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Repositorio médico server-side (service_role). Igual estándar
// que api/db.ts del grooming: RLS deny-all en la nube, acceso
// solo desde funciones de api/.
// ─────────────────────────────────────────────────────────────

const VALID_APPT_STATUSES = [
  "solicitud", "pagado", "asignada", "confirmada",
  "en_consulta", "atendida", "no_llego", "cancelado",
];

export function isValidMedicalStatus(s: string): boolean {
  return VALID_APPT_STATUSES.includes(s);
}

export interface SpecialtyRecord {
  id: string;
  name: string;
  cost: number;
  branches: string[];
  active: boolean;
}

export interface DoctorRecord {
  id: string;
  fullName: string;
  branch: string;
  kind: "general" | "especialista";
  specialtyId: string | null;
  specialtyName: string | null;
  email: string;
  phone: string;
  active: boolean;
}

export interface ScheduleRow {
  id: string;
  doctorId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface TimeOffRow {
  id: string;
  doctorId: string;
  offDate: string;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
}

export interface MedicalAppointmentInput {
  appointmentCode: string;
  branch: string;
  serviceType: "general" | "rayos" | "eco" | "especializada";
  specialtyId: string | null;
  doctorId: string | null;
  apptDate: string | null;
  startMinute: number | null;
  durationMinutes: number;
  needsOrder: boolean;
  hasOrder: boolean | null;
  status: string;
  petName: string;
  petType: string;
  petNotes: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  paymentNotes: string;
  createdByClient: boolean;
  createdBy: string;
}

export interface MedicalAppointmentRecord extends MedicalAppointmentInput {
  id: string;
  doctorName: string | null;
  specialtyName: string | null;
  createdAt: string;
}

export type UniqueViolation = "23505";

interface ApptDbRow {
  id: string;
  appointment_code: string;
  branch: string;
  service_type: string;
  specialty_id: string | null;
  doctor_id: string | null;
  appt_date: string | null;
  start_minute: number | null;
  duration_minutes: number;
  needs_order: boolean;
  has_order: boolean | null;
  status: string;
  pet_name: string;
  pet_type: string;
  pet_notes: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  payment_notes: string;
  created_by_client: boolean;
  created_by: string;
  created_at: string;
  medical_doctors?: { full_name: string } | null;
  medical_specialties?: { name: string } | null;
}

function apptRowToRecord(r: ApptDbRow): MedicalAppointmentRecord {
  return {
    id: r.id,
    appointmentCode: r.appointment_code,
    branch: r.branch,
    serviceType: r.service_type as MedicalAppointmentInput["serviceType"],
    specialtyId: r.specialty_id,
    doctorId: r.doctor_id,
    apptDate: r.appt_date,
    startMinute: r.start_minute,
    durationMinutes: r.duration_minutes,
    needsOrder: r.needs_order,
    hasOrder: r.has_order,
    status: r.status,
    petName: r.pet_name,
    petType: r.pet_type,
    petNotes: r.pet_notes,
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
    ownerEmail: r.owner_email,
    paymentNotes: r.payment_notes,
    createdByClient: r.created_by_client,
    createdBy: r.created_by,
    doctorName: r.medical_doctors?.full_name ?? null,
    specialtyName: r.medical_specialties?.name ?? null,
    createdAt: r.created_at,
  };
}

const APPT_COLUMNS =
  "id, appointment_code, branch, service_type, specialty_id, doctor_id, appt_date, " +
  "start_minute, duration_minutes, needs_order, has_order, status, pet_name, pet_type, " +
  "pet_notes, owner_name, owner_phone, owner_email, payment_notes, created_by_client, " +
  "created_by, created_at, medical_doctors(full_name), medical_specialties(name)";

export class MedicalDb {
  constructor(private client: SupabaseClient) {}

  static fromEnv(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }): MedicalDb | null {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return new MedicalDb(
      createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      }),
    );
  }

  // ── Catálogos ────────────────────────────────────────────────

  async listSpecialties(onlyActive = false): Promise<SpecialtyRecord[]> {
    let q = this.client.from("medical_specialties").select("id, name, cost, branches, active").order("name");
    if (onlyActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new Error(`listSpecialties: ${error.message}`);
    return (data ?? []).map((s) => ({
      id: String(s.id),
      name: String(s.name),
      cost: Number(s.cost),
      branches: (s.branches as string[]) ?? [],
      active: Boolean(s.active),
    }));
  }

  async createSpecialty(name: string, cost: number, branches: string[]): Promise<{ code: UniqueViolation | null }> {
    const { error } = await this.client
      .from("medical_specialties")
      .insert({ name, cost, branches });
    if (!error) return { code: null };
    if (error.code === "23505") return { code: "23505" };
    throw new Error(`createSpecialty: ${error.message}`);
  }

  async updateSpecialty(
    id: string,
    patch: { cost?: number; branches?: string[]; active?: boolean; name?: string },
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.cost !== undefined) row.cost = patch.cost;
    if (patch.branches !== undefined) row.branches = patch.branches;
    if (patch.active !== undefined) row.active = patch.active;
    if (patch.name !== undefined && patch.name.trim() !== "") row.name = patch.name.trim();
    const { error } = await this.client.from("medical_specialties").update(row).eq("id", id);
    if (error) throw new Error(`updateSpecialty: ${error.message}`);
  }

  async createDoctor(
    fullName: string,
    branch: string,
    kind: "general" | "especialista",
    specialtyId: string | null,
    email: string,
    phone: string,
  ): Promise<void> {
    const { error } = await this.client.from("medical_doctors").insert({
      full_name: fullName,
      branch,
      kind,
      specialty_id: specialtyId,
      email: email || "-",
      phone: phone || "-",
    });
    if (error) throw new Error(`createDoctor: ${error.message}`);
  }

  async updateDoctor(
    id: string,
    patch: { fullName?: string; email?: string; phone?: string; active?: boolean },
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined && patch.fullName.trim() !== "") row.full_name = patch.fullName.trim();
    if (patch.email !== undefined) row.email = patch.email.trim() || "-";
    if (patch.phone !== undefined) row.phone = patch.phone.trim() || "-";
    if (patch.active !== undefined) row.active = patch.active;
    const { error } = await this.client.from("medical_doctors").update(row).eq("id", id);
    if (error) throw new Error(`updateDoctor: ${error.message}`);
  }

  async listDoctors(branch: string | null, kind: "general" | "especialista" | null): Promise<DoctorRecord[]> {
    let q = this.client
      .from("medical_doctors")
      .select("id, full_name, branch, kind, specialty_id, email, phone, active, medical_specialties(name)")
      .order("full_name");
    if (branch) q = q.eq("branch", branch);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) throw new Error(`listDoctors: ${error.message}`);
    return (data ?? []).map((d) => ({
      id: String(d.id),
      fullName: String(d.full_name),
      branch: String(d.branch),
      kind: d.kind as DoctorRecord["kind"],
      specialtyId: d.specialty_id === null ? null : String(d.specialty_id),
      specialtyName: ((d.medical_specialties as unknown as { name: string } | null)?.name) ?? null,
      email: String(d.email),
      phone: String(d.phone),
      active: Boolean(d.active),
    }));
  }

  // ── Horarios ────────────────────────────────────────────────

  async listSchedulesByBranch(branch: string | null): Promise<{ doctorId: string; weekday: number; startMinute: number; endMinute: number }[]> {
    let q = this.client
      .from("medical_schedules")
      .select("doctor_id, weekday, start_minute, end_minute, medical_doctors!inner(branch)")
      .order("start_minute");
    if (branch) q = q.eq("medical_doctors.branch", branch);
    const { data, error } = await q;
    if (error) throw new Error(`listSchedulesByBranch: ${error.message}`);
    return (data ?? []).map((s) => ({
      doctorId: String(s.doctor_id),
      weekday: Number(s.weekday),
      startMinute: Number(s.start_minute),
      endMinute: Number(s.end_minute),
    }));
  }

  async listAllSchedulesWithDoctors(): Promise<
    (ScheduleRow & { doctorName: string; branch: string; kind: string })[]
  > {
    const { data, error } = await this.client
      .from("medical_schedules")
      .select("id, doctor_id, weekday, start_minute, end_minute, medical_doctors(full_name, branch, kind)")
      .order("weekday").order("start_minute");
    if (error) throw new Error(`listAllSchedulesWithDoctors: ${error.message}`);
    return (data ?? []).map((s) => ({
      id: String(s.id),
      doctorId: String(s.doctor_id),
      weekday: Number(s.weekday),
      startMinute: Number(s.start_minute),
      endMinute: Number(s.end_minute),
      doctorName: String((s.medical_doctors as unknown as { full_name: string }).full_name),
      branch: String((s.medical_doctors as unknown as { branch: string }).branch),
      kind: String((s.medical_doctors as unknown as { kind: string }).kind),
    }));
  }

  async createSchedule(doctorId: string, weekday: number, startMinute: number, endMinute: number): Promise<{ code: UniqueViolation | null }> {
    const { error } = await this.client
      .from("medical_schedules")
      .insert({ doctor_id: doctorId, weekday, start_minute: startMinute, end_minute: endMinute });
    if (!error) return { code: null };
    if (error.code === "23505") return { code: "23505" };
    throw new Error(`createSchedule: ${error.message}`);
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await this.client.from("medical_schedules").delete().eq("id", id);
    if (error) throw new Error(`deleteSchedule: ${error.message}`);
  }

  async listTimeOff(branch: string | null, fromDate: string, toDate: string): Promise<TimeOffRow[]> {
    let q = this.client
      .from("medical_time_off")
      .select("id, doctor_id, off_date, start_minute, end_minute, reason, medical_doctors!inner(branch)")
      .gte("off_date", fromDate).lte("off_date", toDate)
      .order("off_date");
    if (branch) q = q.eq("medical_doctors.branch", branch);
    const { data, error } = await q;
    if (error) throw new Error(`listTimeOff: ${error.message}`);
    return (data ?? []).map((t) => ({
      id: String(t.id),
      doctorId: String(t.doctor_id),
      offDate: String(t.off_date),
      startMinute: t.start_minute === null ? null : Number(t.start_minute),
      endMinute: t.end_minute === null ? null : Number(t.end_minute),
      reason: String(t.reason ?? ""),
    }));
  }

  async createTimeOff(
    doctorId: string,
    offDate: string,
    startMinute: number | null,
    endMinute: number | null,
    reason: string,
    createdBy: string,
  ): Promise<{ code: UniqueViolation | null }> {
    const { error } = await this.client.from("medical_time_off").insert({
      doctor_id: doctorId, off_date: offDate, start_minute: startMinute,
      end_minute: endMinute, reason, created_by: createdBy,
    });
    if (!error) return { code: null };
    if (error.code === "23505") return { code: "23505" };
    throw new Error(`createTimeOff: ${error.message}`);
  }

  async deleteTimeOff(id: string): Promise<void> {
    const { error } = await this.client.from("medical_time_off").delete().eq("id", id);
    if (error) throw new Error(`deleteTimeOff: ${error.message}`);
  }

  async listDoctorSchedules(doctorId: string): Promise<{ weekday: number; startMinute: number; endMinute: number }[]> {
    const { data, error } = await this.client
      .from("medical_schedules")
      .select("weekday, start_minute, end_minute")
      .eq("doctor_id", doctorId)
      .order("weekday").order("start_minute");
    if (error) throw new Error(`listDoctorSchedules: ${error.message}`);
    return (data ?? []).map((s) => ({
      weekday: Number(s.weekday),
      startMinute: Number(s.start_minute),
      endMinute: Number(s.end_minute),
    }));
  }

  /** Citas activas de un doctor en una fecha (para calcular slots libres). */
  async listApptsForDoctor(doctorId: string, date: string): Promise<{ startMinute: number; durationMinutes: number }[]> {
    const { data, error } = await this.client
      .from("medical_appointments")
      .select("start_minute, duration_minutes")
      .eq("doctor_id", doctorId)
      .eq("appt_date", date)
      .in("status", ["pagado", "asignada", "confirmada", "en_consulta", "atendida"]);
    if (error) throw new Error(`listApptsForDoctor: ${error.message}`);
    return (data ?? []).map((a) => ({
      startMinute: Number(a.start_minute),
      durationMinutes: Number(a.duration_minutes),
    }));
  }

  /** Especializadas sin asignar (counter las toma en la pestaña Consultas). */
  async listUnassignedAppts(branch: string | null): Promise<MedicalAppointmentRecord[]> {
    let q = this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .in("status", ["solicitud", "pagado"])
      .order("created_at", { ascending: true });
    if (branch) q = q.eq("branch", branch);
    const { data, error } = await q;
    if (error) throw new Error(`listUnassignedAppts: ${error.message}`);
    return (data ?? []).map((r) => apptRowToRecord(r as unknown as ApptDbRow));
  }

  // ── Citas ───────────────────────────────────────────────────

  async insertAppointment(row: MedicalAppointmentInput): Promise<{ code: UniqueViolation | null; id: string | null }> {
    const { data, error } = await this.client
      .from("medical_appointments")
      .insert({
      appointment_code: row.appointmentCode,
      branch: row.branch,
      service_type: row.serviceType,
      specialty_id: row.specialtyId,
      doctor_id: row.doctorId,
      appt_date: row.apptDate,
      start_minute: row.startMinute,
      duration_minutes: row.durationMinutes,
      needs_order: row.needsOrder,
      has_order: row.hasOrder,
      status: row.status,
      pet_name: row.petName,
      pet_type: row.petType,
      pet_notes: row.petNotes,
      owner_name: row.ownerName,
      owner_phone: row.ownerPhone,
      owner_email: row.ownerEmail,
      payment_notes: row.paymentNotes,
      created_by_client: row.createdByClient,
      created_by: row.createdBy,
    })
      .select("id")
      .single();
    if (!error && data) return { code: null, id: String(data.id) };
    if (error && error.code === "23505") return { code: "23505", id: null };
    if (error) throw new Error(`insertAppointment: ${error.message}`);
    return { code: null, id: null };
  }

  async findApptByCode(code: string): Promise<MedicalAppointmentRecord | null> {
    const { data, error } = await this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .eq("appointment_code", code)
      .maybeSingle();
    if (error) throw new Error(`findApptByCode: ${error.message}`);
    return data ? apptRowToRecord(data as unknown as ApptDbRow) : null;
  }

  async findApptById(id: string): Promise<MedicalAppointmentRecord | null> {
    const { data, error } = await this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`findApptById: ${error.message}`);
    return data ? apptRowToRecord(data as unknown as ApptDbRow) : null;
  }

  async listApptsByDate(branch: string | null, date: string): Promise<MedicalAppointmentRecord[]> {
    let q = this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .eq("appt_date", date)
      .neq("status", "cancelado")
      .order("start_minute");
    if (branch) q = q.eq("branch", branch);
    const { data, error } = await q;
    if (error) throw new Error(`listApptsByDate: ${error.message}`);
    return (data ?? []).map((r) => apptRowToRecord(r as unknown as ApptDbRow));
  }

  async listApptsRange(branch: string | null, fromDate: string, toDate: string): Promise<MedicalAppointmentRecord[]> {
    let q = this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .neq("status", "cancelado")
      .gte("appt_date", fromDate)
      .lte("appt_date", toDate)
      .order("appt_date").order("start_minute");
    if (branch) q = q.eq("branch", branch);
    const { data, error } = await q;
    if (error) throw new Error(`listApptsRange: ${error.message}`);
    return (data ?? []).map((r) => apptRowToRecord(r as unknown as ApptDbRow));
  }

  async listApptsPatient(phoneDigits: string): Promise<MedicalAppointmentRecord[]> {
    const { data, error } = await this.client
      .from("medical_appointments")
      .select(APPT_COLUMNS)
      .like("owner_phone", `%${phoneDigits}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(`listApptsPatient: ${error.message}`);
    return (data ?? []).map((r) => apptRowToRecord(r as unknown as ApptDbRow));
  }

  /** Citas activas que se cruzan con [start, end) de un doctor en una fecha. */
  async findOverlap(doctorId: string, date: string, startMinute: number, endMinute: number): Promise<boolean> {
    // solapamiento clásico: existing.start < end AND existing.start + dur > start
    const from = date;
    const { data, error } = await this.client
      .from("medical_appointments")
      .select("id, start_minute, duration_minutes")
      .eq("doctor_id", doctorId)
      .eq("appt_date", from)
      .in("status", ["pagado", "asignada", "confirmada", "en_consulta", "atendida"]);
    if (error) throw new Error(`findOverlap: ${error.message}`);
    for (const a of data ?? []) {
      const s = Number(a.start_minute);
      const e = s + Number(a.duration_minutes);
      if (s < endMinute && e > startMinute) return true;
    }
    return false;
  }

  async recordApptStatus(apptId: string, status: string, createdBy: string): Promise<void> {
    const { error: updErr } = await this.client
      .from("medical_appointments")
      .update({ status })
      .eq("id", apptId);
    if (updErr) throw new Error(`recordApptStatus update: ${updErr.message}`);
    const { error } = await this.client
      .from("medical_status_updates")
      .insert({ appointment_id: apptId, status, created_by: createdBy });
    if (error) throw new Error(`recordApptStatus insert: ${error.message}`);
  }

  async assignAppt(
    apptId: string,
    patch: { doctorId?: string; apptDate?: string; startMinute?: number; paymentNotes?: string },
    createdBy: string,
    newStatus?: string,
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (newStatus) row.status = newStatus;
    if (patch.doctorId) row.doctor_id = patch.doctorId;
    if (patch.apptDate) row.appt_date = patch.apptDate;
    if (patch.startMinute !== undefined && patch.startMinute !== null) row.start_minute = patch.startMinute;
    if (patch.paymentNotes !== undefined) row.payment_notes = patch.paymentNotes;
    const { error: updErr } = await this.client
      .from("medical_appointments")
      .update(row)
      .eq("id", apptId);
    if (updErr) throw new Error(`assignAppt update: ${updErr.message}`);
    if (newStatus) {
      const { error } = await this.client
        .from("medical_status_updates")
        .insert({ appointment_id: apptId, status: newStatus, created_by: createdBy });
      if (error) throw new Error(`assignAppt insert: ${error.message}`);
    }
  }

  async listApptStatusUpdates(apptId: string): Promise<{ status: string; createdBy: string; createdAt: string }[]> {
    const { data, error } = await this.client
      .from("medical_status_updates")
      .select("status, created_by, created_at")
      .eq("appointment_id", apptId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listApptStatusUpdates: ${error.message}`);
    return (data ?? []).map((r) => ({
      status: String(r.status),
      createdBy: String(r.created_by),
      createdAt: String(r.created_at),
    }));
  }

  async listApptStatusUpdatesMany(
    apptIds: string[],
  ): Promise<Record<string, { status: string; createdBy: string; createdAt: string }[]>> {
    if (apptIds.length === 0) return {};
    const { data, error } = await this.client
      .from("medical_status_updates")
      .select("appointment_id, status, created_by, created_at")
      .in("appointment_id", apptIds)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listApptStatusUpdatesMany: ${error.message}`);
    const out: Record<string, { status: string; createdBy: string; createdAt: string }[]> = {};
    for (const r of data ?? []) {
      const key = String(r.appointment_id);
      (out[key] ??= []).push({
        status: String(r.status),
        createdBy: String(r.created_by),
        createdAt: String(r.created_at),
      });
    }
    return out;
  }

  // ── Config ──────────────────────────────────────────────────

  async getConfig(): Promise<Record<string, string>> {
    const { data, error } = await this.client.from("app_config").select("key, value");
    if (error) throw new Error(`getConfig: ${error.message}`);
    return Object.fromEntries((data ?? []).map((r) => [String(r.key), String(r.value)]));
  }

  async setConfig(key: string, value: string): Promise<void> {
    const { error } = await this.client
      .from("app_config")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw new Error(`setConfig: ${error.message}`);
  }
}
