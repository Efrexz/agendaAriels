import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import { LoginScreen } from "./LoginScreen";
import { Panel } from "./Panel";
import { ConsultasTab } from "./ConsultasTab";
import { HorariosTab } from "./HorariosTab";
import { ConfigTab } from "./ConfigTab";

type Tab = "grooming" | "consultas" | "horarios" | "config";

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
      {/* Barra de pestañas */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {([
          ["grooming", "🐕 Grooming"],
          ["consultas", "🩺 Consultas"],
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
