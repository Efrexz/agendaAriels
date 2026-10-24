import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { PawPrint } from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";
import { LoginScreen } from "./LoginScreen";
import { Panel } from "./Panel";
import { ConsultasTab } from "./ConsultasTab";
import { HorariosTab } from "./HorariosTab";
import { ConfigTab } from "./ConfigTab";
import { LabTab } from "./LabTab";

type Tab = "grooming" | "consultas" | "horarios" | "laboratorio" | "config";

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
    <div className="mx-auto min-h-screen max-w-6xl p-4 pb-24 lg:p-8">
      {/* Encabezado de marca (pulido UX-C: sobrio, sin robar espacio de trabajo) */}
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-md shadow-blue-600/20">
          <PawPrint className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <h1 className="font-display text-lg font-semibold leading-tight text-slate-900">Panel Interno</h1>
            <span className="font-hand text-lg leading-none text-brand-orange">Ariels Clinic</span>
          </div>
          <p className="text-xs text-slate-400">Grooming · Consultas · Laboratorio</p>
        </div>
      </header>

      {/* Barra de pestañas */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {([
          ["grooming", "🐕 Grooming"],
          ["consultas", "🩺 Consultas"],
          ["laboratorio", "🧪 Laboratorio"],
          ["horarios", "🗓 Horarios médicos"],
          ["config", "⚙ Config"],
        ] as Array<[Tab, string]>).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === v
                ? "bg-brand-blue text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-blue"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {session.user.email}{" "}
          <button onClick={signOut} className="text-brand-blue underline decoration-dotted ml-1">
            Salir
          </button>
        </span>
      </div>

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
    </div>
  );
}
