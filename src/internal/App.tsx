import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  FlaskConical,
  LogOut,
  PawPrint,
  Settings,
  Stethoscope,
} from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";
import { LoginScreen } from "./LoginScreen";
import { Panel } from "./Panel";
import { ConsultasTab } from "./ConsultasTab";
import { HorariosTab } from "./HorariosTab";
import { ConfigTab } from "./ConfigTab";
import { LabTab } from "./LabTab";

type Tab = "grooming" | "consultas" | "horarios" | "laboratorio" | "config";

// Navbar estilo maqueta: brand + pestañas con iconos en línea + chip de
// usuario. Sin campana/menú fake: lo que existe es visible.
const TABS: Array<[Tab, string, typeof PawPrint]> = [
  ["grooming", "Grooming", PawPrint],
  ["consultas", "Consultas", Stethoscope],
  ["laboratorio", "Laboratorio", FlaskConical],
  ["horarios", "Horarios médicos", CalendarDays],
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
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border-b-2 px-3 py-2 text-sm font-semibold transition ${
        compact ? "gap-1.5 px-2.5" : "gap-2"
      } ${
        active
          ? "border-brand-blue bg-blue-50/60 text-brand-blue"
          : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-brand-blue"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("grooming");

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

      {/* Navbar superior fija: brand + pestañas + usuario */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-md shadow-blue-600/20">
            <PawPrint className="h-5 w-5" />
          </div>
          <div className="min-w-0 shrink-0">
            <p className="font-hand text-xl leading-none text-brand-orange">Ariel&apos;s Clinic</p>
            <p className="text-[10px] leading-tight text-slate-400">Hospital veterinario</p>
          </div>
          <nav className="ml-2 hidden flex-1 justify-end lg:flex">
            {TABS.map(([v, label, Icon]) => (
              <TabButton key={v} tab={tab} value={v} label={label} Icon={Icon} onSelect={setTab} />
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-3">
            <span className="hidden max-w-52 items-center gap-2 truncate rounded-full bg-slate-100 sm:flex px-3 py-1.5 text-xs text-slate-600" title={session.user.email ?? ""}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <Stethoscope className="h-3 w-3" />
              </span>
              Recepción
            </span>
            <button
              onClick={signOut}
              title="Salir de la sesión"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
      </header>

      <main className="relative z-10 mx-auto max-w-6xl p-4 pb-24 lg:p-8">
        {tab === "grooming" && <Panel email={session.user.email ?? ""} onSignOut={signOut} embedded />}
        {tab === "consultas" && <ConsultasTab />}
        {tab === "laboratorio" && <LabTab />}
        {tab === "horarios" && <HorariosTab />}
        {tab === "config" && (
          <div>
            <h1 className="mb-4 font-display text-xl font-bold text-slate-900">⚙ Configuración del sistema médico</h1>
            <ConfigTab />
          </div>
        )}
      </main>
    </div>
  );
}
