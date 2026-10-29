import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, RefreshCw, Search } from "lucide-react";
import { fetchHistory } from "./api";
import { fetchMedHistory } from "./apiMedical";
import { fetchLabList } from "./apiLab";
import { SLOT_LABELS, statusMeta } from "../statuses";
import { MED_SERVICE_LABELS, medStatusMeta } from "../medicalStatuses";
import { labStatusMeta } from "../labStatuses";

// Pestaña 📚 Historial (solo lectura): todo lo que YA PASÓ en las 3 fuentes,
// separado por día, con rango hasta un mes. El trabajo diario sigue en sus
// pestañas; desde aquí el counter puede SALTAR a una pestaña con el código
// buscado si necesita actuar (reimprimir boleta, cambiar estado, etc.).

export type HistTarget = "grooming" | "consultas" | "laboratorio";

interface HistItem {
  kind: HistTarget;
  code: string;
  title: string;
  detail: string;
  dateKey: string;
  timeLabel: string;
  status: string;
  statusLabel: string;
  statusBadge: string;
  sedeLabel: string;
  timeline?: Array<{ status: string; createdBy: string; createdAt: string }>;
}

const KIND_META: Record<HistTarget, { label: string; chip: string }> = {
  grooming: { label: "🐕 Grooming", chip: "bg-orange-100 text-orange-700" },
  consultas: { label: "🩺 Consultas", chip: "bg-blue-100 text-blue-700" },
  laboratorio: { label: "🧪 Laboratorio", chip: "bg-amber-100 text-amber-800" },
};

const RANGOS: Array<{ value: "hoy" | "semana" | "mes"; label: string; days: number }> = [
  { value: "hoy", label: "Hoy", days: 0 },
  { value: "semana", label: "Última semana", days: 7 },
  { value: "mes", label: "Último mes", days: 31 },
];

function limaDayKey(offsetDays = 0): string {
  const [y, m, d] = limaISO().split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() - offsetDays);
  return dt.toISOString().slice(0, 10);
}

function limaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function dayLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return "Hoy";
  if (dayKey === limaDayKey(1)) return "Ayer";
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d));
  return dt.toLocaleDateString("es-PE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

function hour(min: number): string {
  const h24 = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, "0");
  const label = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${label}`;
}

export function HistoryTab({ onJump }: { onJump: (tab: HistTarget, q: string) => void }) {
  const [tipo, setTipo] = useState<HistTarget>("grooming");
  const [rango, setRango] = useState<"hoy" | "semana" | "mes">("semana");
  const [sede, setSede] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);

  const todayKey = limaISO();
  const days = RANGOS.find((r) => r.value === rango)!.days;

  // Carga SOLO de la fuente del tipo activo (1 tabla por consulta: la BD
  // responde más rápido y el counter ve una sola sección a la vez).
  useEffect(() => {
    let active = true;
    (async () => {
      // Frontera async: los setState ocurren tras await (regla react-hooks).
      await Promise.resolve();
      if (!active) return;
      setItems(null);
      setLoading(true);
      try {
        const from = limaDayKey(days);
        const to = todayKey;
        const out: HistItem[] = [];
        if (tipo === "grooming") {
          const g = await fetchHistory(from, to, sede);
          for (const b of g.bookings) {
            if (outOfRange(b.serviceDate, from, to)) continue;
            const meta = statusMeta(b.status);
            out.push({
              kind: "grooming", code: b.bookingCode,
              title: `${b.ownerName} · ${b.pets.map((p) => p.name).join(", ")}`,
              detail: b.pets.map((p) => p.service).join(" + "),
              dateKey: b.serviceDate,
              timeLabel: `${b.serviceDate} · ${SLOT_LABELS[b.timeSlot]} · ${b.branchLabel.replace("Sede ", "")}`,
              status: b.status, statusLabel: meta.label, statusBadge: meta.badge,
              sedeLabel: b.branchLabel.replace("Sede ", ""),
              timeline: b.timeline,
            });
          }
        } else if (tipo === "consultas") {
          const m = await fetchMedHistory(from, to, sede);
          for (const a of m.appointments) {
            if (!a.apptDate || outOfRange(a.apptDate, from, to)) continue;
            const meta = medStatusMeta(a.status);
            out.push({
              kind: "consultas", code: a.appointmentCode,
              title: `${a.petName} (${a.ownerName})`,
              detail: `${MED_SERVICE_LABELS[a.serviceType]}${a.specialtyName ? ` · ${a.specialtyName}` : ""}${a.doctorName ? ` · ${a.doctorName}` : ""}`,
              dateKey: a.apptDate,
              timeLabel: `${a.apptDate}${a.startMinute !== null ? ` · ${hour(a.startMinute)}` : ""}`,
              status: a.status, statusLabel: meta.label, statusBadge: meta.badge,
              sedeLabel: a.branch,
              timeline: a.timeline,
            });
          }
        } else {
          const l = await fetchLabList("history", sede, "");
          for (const o of l.orders) {
            const dayKey = o.updatedAt.slice(0, 10) <= todayKey ? o.updatedAt.slice(0, 10) : todayKey;
            const meta = labStatusMeta(o.status);
            out.push({
              kind: "laboratorio", code: o.orderCode,
              title: `${o.petName} (${o.ownerName})`,
              detail: `${o.examType} · ${o.labName}`,
              dateKey: dayKey,
              timeLabel: `Registrada ${o.createdAt.slice(0, 10)}`,
              status: o.status, statusLabel: meta.label, statusBadge: meta.badge,
              sedeLabel: `${o.sedeOrigen} → ${o.sedeResponsable}`,
              timeline: undefined,
            });
          }
        }
        if (active) {
          setItems(out);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar el historial");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tipo, rango, sede, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = (items ?? []).filter((it) =>
      q.length < 2 || it.code.toUpperCase().includes(q) ||
      it.title.toUpperCase().includes(q),
    );
    const map = new Map<string, HistItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.dateKey) ?? [];
      arr.push(it);
      map.set(it.dateKey, arr);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, list]) => ({
        key,
        label: dayLabel(key, todayKey),
        list: list.sort((a, b) => (a.kind === b.kind ? a.timeLabel.localeCompare(b.timeLabel) : a.kind.localeCompare(b.kind))),
      }));
  }, [items, query, todayKey]);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2.5 font-display text-xl font-bold text-[#475AAB]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
          <History className="h-5 w-5" />
        </span>
        Historial de la clínica
      </h1>

      {/* Tipo: una sección a la vez (solo se consulta esa tabla) */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(KIND_META) as HistTarget[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTipo(t); setOpenCode(null); }}
            aria-pressed={tipo === t}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tipo === t
                ? "bg-brand-blue text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-blue"
            }`}
          >
            {KIND_META[t].label}
          </button>
        ))}
      </div>

      {/* Filtros: rango + sede + texto */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        {RANGOS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRango(r.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              rango === r.value ? "bg-brand-blue text-white shadow-md shadow-blue-600/20" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-blue"
            }`}
          >
            {r.label}
          </button>
        ))}
        <select
          value={sede}
          onChange={(e) => setSede(e.target.value)}
          className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        >
          <option value="all">Todas las sedes</option>
          <option value="san_martin">San Martín de Porres</option>
          <option value="los_olivos">Los Olivos</option>
          <option value="san_miguel">San Miguel</option>
        </select>
        <label className="ml-auto flex min-w-56 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 sm:max-w-xs">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar: código, teléfono o nombre…"
            className="w-full text-sm outline-none"
          />
        </label>
        <button
          onClick={() => setTick((t) => t + 1)}
          title="Refrescar"
          className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-brand-blue"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading && items === null && <p className="rounded-2xl bg-white/60 p-6 text-center text-sm text-slate-400">Cargando historial…</p>}

      {!loading && grupos.length === 0 && (
        <p className="rounded-2xl bg-white/60 p-6 text-center text-sm text-slate-400">
          Sin registros en este rango{query.trim() ? ` para "${query}"` : ""}.
        </p>
      )}

      {/* Grupos por día */}
      <div className="flex flex-col gap-6">
        {grupos.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg bg-brand-blue/10 px-2 py-1 font-semibold text-brand-blue capitalize">{group.label}</span>
              <span className="text-slate-400">{group.list.length} registro(s)</span>
            </h2>
            <div className="flex flex-col gap-2">
              {group.list.map((it) => (
                <HistoryCard
                  key={`${it.kind}-${it.code}`}
                  it={it}
                  open={openCode === it.code}
                  onToggle={() => setOpenCode((c) => (c === it.code ? null : it.code))}
                  onJump={onJump}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function outOfRange(dateKey: string, from: string, to: string): boolean {
  return dateKey < from || dateKey > to;
}

function HistoryCard({ it, open, onToggle, onJump }: { it: HistItem; open: boolean; onToggle: () => void; onJump: (tab: HistTarget, q: string) => void }) {
  const kind = KIND_META[it.kind];
  return (
    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
        }}
        className="flex cursor-pointer items-center gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-inset"
        onClick={onToggle}
      >
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${kind.chip}`}>{kind.label}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{it.title}</p>
          <p className="truncate text-xs text-slate-500">{it.detail}</p>
        </div>
        <div className="hidden min-w-0 shrink-0 sm:block">
          <p className="truncate text-xs text-slate-400">{it.timeLabel}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${it.statusBadge}`}>{it.statusLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          <p className="mb-2 font-mono text-xs font-bold text-brand-blue">{it.code}</p>
          {it.timeline && it.timeline.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-1 text-xs text-slate-500">
              {it.timeline.map((t, i) => (
                <li key={i}>
                  <span className="font-medium text-slate-700">
                    {hourLabel(t.createdAt)}
                  </span>{" "}
                  — {it.kind === "consultas" ? medStatusMeta(t.status).label : statusMeta(t.status).label} ({t.createdBy})
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-print mb-3 text-xs text-slate-400">Sin timeline detallado para este registro.</p>
          )}
          <button
            onClick={() => onJump(it.kind, it.code)}
            className={`no-print inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-100 ${
              it.kind === "grooming" ? "bg-brand-blue hover:bg-blue-700" : it.kind === "consultas" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            Abrir en pestaña {kind.label} →
          </button>
        </div>
      )}
    </article>
  );
}

function hourLabel(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
