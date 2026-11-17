import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Bell,
  FlaskConical,
  History,
  LogOut,
  PawPrint,
  Settings,
  Stethoscope,
} from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";
import { LoginScreen } from "./LoginScreen";
import { Panel } from "./Panel";
import { ConsultasTab } from "./ConsultasTab";
import { HelpGuide } from "./HelpGuide";
import { ConfigTab } from "./ConfigTab";
import { LabTab } from "./LabTab";
import { HistoryTab, type HistTarget } from "./HistoryTab";
import { fetchArrivals, type Arrivals } from "./apiLab";

/** "Tin" tipo WhatsApp Web por Web Audio (sin archivos). Volumen SUBIDO a
 *  pedido del dueño (18/11: "debería sonar más duro") — 3 notas con cuerpo
 *  (fundamental + octava + quinta) y decay más largo. Funciona con la
 *  pestaña EN SEGUNDO PLANO; fallo silencioso si el audio no está. */
function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // A5 → Re6 → Fa#6 (arpegio descendente-ascendente bien perceptible)
    const notes: Array<[number, number]> = [[880, 0], [1174.66, 0.16], [1479.98, 0.32]];
    for (const [freq, at] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Pico 0.35 (antes 0.08 — 4x más fuerte) + cola de 0.9s
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 1);
    }
    setTimeout(() => void ctx.close().catch(() => undefined), 2500);
  } catch {
    /* sin audio disponible: la campana visual queda */
  }
}

type Tab = "grooming" | "consultas" | "laboratorio" | "historial" | "config";

// Navbar estilo maqueta 17/11 (aprobada por marketing): fondo azul marino +
// franja naranja arriba, logo real en pastilla blanca, pestañas pastilla con
// subrayado naranja en la activa. Sin tabs fake: lo que existe es visible.
const TABS: Array<[Tab, string, typeof PawPrint]> = [
  ["grooming", "Grooming", PawPrint],
  ["consultas", "Consultas", Stethoscope],
  ["laboratorio", "Laboratorio", FlaskConical],
  ["historial", "Historial", History],
  ["config", "Config", Settings],
];

function TabButton({
  tab,
  value,
  label,
  Icon,
  onSelect,
  compact,
}: {
  tab: Tab;
  value: Tab;
  label: string;
  Icon: typeof PawPrint;
  onSelect: (t: Tab) => void;
  compact?: boolean;
}) {
  const active = tab === value;
  return (
    <button
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center rounded-full py-2 text-sm font-semibold transition ${
        compact ? "gap-1.5 px-2.5" : "gap-2 px-3.5"
      } ${
        active
          ? "bg-brand-blue text-white shadow-md shadow-blue-950/40"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {/* Subrayado naranja de marca en la pestaña activa (maqueta 17/11) */}
      {active && <span aria-hidden className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-orange-400" />}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("grooming");
  // Salto desde 📚 Historial: contenido pestaña destino + código que debe
  // quedar buscado al montar la pestaña correspondiente.
  const [jump, setJump] = useState<{ tab: Tab; q: string } | null>(null);
  // Campana (feedback 18/11): pendientes accionables por pestaña + "tin" al
  // subir el total, aun con la pestaña en segundo plano (WhatsApp Web).
  const [arrivals, setArrivals] = useState<Arrivals | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const lastTotalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        const a = await fetchArrivals();
        if (!active) return;
        setArrivals(a);
        if (lastTotalRef.current !== null && a.total > lastTotalRef.current) playChime();
        lastTotalRef.current = a.total;
      } catch {
        /* sin sesión válida o red: la campana queda como está */
      }
    })();
    // Sondeo cada 30s + re-chequeo al volver a la pestaña (counter la minimiza):
    // el "tin" suena aun en segundo plano (WhatsApp Web, feedback 18/11).
    const timer = setInterval(() => {
      void (async () => {
        try {
          const a = await fetchArrivals();
          if (!active) return;
          setArrivals(a);
          if (lastTotalRef.current !== null && a.total > lastTotalRef.current) playChime();
          lastTotalRef.current = a.total;
        } catch { /* silencioso */ }
      })();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const a = await fetchArrivals();
          if (!active) return;
          setArrivals(a);
          if (lastTotalRef.current !== null && a.total > lastTotalRef.current) playChime();
          lastTotalRef.current = a.total;
        } catch { /* silencioso */ }
      })();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  const jumpTo = (target: HistTarget, q: string) => {
    setTab(target);
    setJump({ tab: target, q });
  };

  useEffect(() => {
    const client = getSupabaseClient();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  function signOut() {
    void getSupabaseClient().auth.signOut();
  }

  return (
    <div className="min-h-screen">
      {/* Decoración sutil de fondo (estilo maqueta, sin robar atención) */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-0 overflow-hidden">
        <PawPrint className="absolute -left-4 -bottom-6 h-24 w-24 rotate-[-15deg] text-blue-200/50" strokeWidth={1.5} />
        <div className="absolute -right-16 -bottom-20 h-44 w-44 rounded-full bg-blue-100/50 blur-2xl" />
        <div className="absolute right-40 -bottom-16 h-32 w-32 rounded-full bg-orange-100/50 blur-2xl" />
      </div>

      {/* Navbar superior fija (maqueta 17/11): azul marino + franja naranja +
          logo real en pastilla blanca + pestañas pastilla + chip Recepción */}
      <header className="no-print sticky top-0 z-30 shadow-lg shadow-blue-950/20">
        <div aria-hidden className="h-1 w-full bg-gradient-to-r from-brand-blue via-brand-orange to-brand-blue" />
        <div className="bg-gradient-to-r from-[#0E1D40] via-[#152A52] to-[#1D3A6E]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
          <div className="flex shrink-0 items-center rounded-xl bg-white px-2 py-1.5 shadow-md">
            <img
              src="/logo.webp"
              alt="Ariel's Clinic — Hospital Veterinario"
              className="h-8 w-auto select-none"
              draggable={false}
            />
          </div>
          <nav className="ml-2 hidden flex-1 justify-end lg:flex">
            {TABS.map(([v, label, Icon]) => (
              <TabButton key={v} tab={tab} value={v} label={label} Icon={Icon} onSelect={setTab} />
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-3">
            {/* Campana de pendientes (feedback 18/11): grooming hoy + citas por
                confirmar + solicitudes de lab; clic → va a la pestaña. */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                aria-label="Pendientes nuevos"
                title="Pendientes nuevos (grooming · citas · lab)"
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                <Bell className="h-4.5 w-4.5" />
                {arrivals && arrivals.total > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-black text-white shadow">
                    {arrivals.total > 99 ? "99+" : arrivals.total}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
                  <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500">Pendientes por atender</p>
                  {([["grooming", "Grooming (hoy)", "🐾"], ["consultas", "Consultas por confirmar", "🩺"], ["lab", "Laboratorio por confirmar", "🧪"]] as Array<[Tab, string, string]>).map(
                    ([t, label, emoji]) => {
                      const n = arrivals?.[t === "grooming" ? "grooming" : t === "consultas" ? "consultas" : "lab"] ?? 0;
                      return (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setBellOpen(false); }}
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2 text-slate-700"><span aria-hidden>{emoji}</span>{label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${n > 0 ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-400"}`}>{n}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
            <span className="hidden max-w-52 items-center gap-2 truncate rounded-full bg-white/10 px-3 py-1.5 text-xs text-white ring-1 ring-orange-300/60 sm:flex" title={session.user.email ?? ""}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-400/25 text-orange-300">
                <Stethoscope className="h-3 w-3" />
              </span>
              Recepción
            </span>
            <button
              onClick={signOut}
              title="Salir de la sesión"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
        {/* Pestañas en móvil: fila scrollable */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:hidden">
          {TABS.map(([v, label, Icon]) => (
            <TabButton key={v} tab={tab} value={v} label={label} Icon={Icon} onSelect={setTab} compact />
          ))}
        </nav>
        </div>
      </header>

      {/* Guía "?" del panel (onboarding de recepcionista nueva) */}
      <HelpGuide tab={tab} />

      <main className="relative z-10 mx-auto max-w-6xl p-4 pb-24 lg:p-8">
        {tab === "grooming" && <Panel email={session.user.email ?? ""} onSignOut={signOut} embedded jumpSearch={jump?.tab === "grooming" ? jump.q : null} />}
        {tab === "consultas" && <ConsultasTab jumpSearch={jump?.tab === "consultas" ? jump.q : null} />}
        {tab === "laboratorio" && <LabTab jumpSearch={jump?.tab === "laboratorio" ? jump.q : null} />}
        {tab === "historial" && <HistoryTab onJump={jumpTo} />}
        {tab === "config" && (
          <div>
            <h1 className="mb-4 font-display text-xl font-bold text-[#475AAB]">⚙ Configuración del sistema médico</h1>
            <ConfigTab />
          </div>
        )}
      </main>
    </div>
  );
}
