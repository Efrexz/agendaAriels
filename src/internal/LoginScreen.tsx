import { useState, type FormEvent } from "react";
import { Lock, PawPrint } from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";

// Login del panel — mismo nivel visual que el wizard público (logo grande,
// fondo pastel con huellitas como los demás primeros tocos del sistema).
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mascotFailed, setMascotFailed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) setError(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message);
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Decoración pastel (misma gramática que App del panel y wizard) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-slate-50">
        <PawPrint className="absolute -left-8 -top-6 h-28 w-28 rotate-[15deg] text-blue-100/70" strokeWidth={1.5} />
        <div className="absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-blue-100/60 blur-2xl" />
        <div className="absolute -left-10 bottom-16 h-40 w-40 rounded-full bg-orange-100/60 blur-2xl" />
        <PawPrint className="absolute -right-6 bottom-10 h-16 w-16 rotate-[-20deg] text-blue-100/70" strokeWidth={1.5} />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-xl ring-1 ring-slate-100 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* Mascota de bienvenida (pulido UX-C): fallback a paw si falta el webp */}
          {mascotFailed ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-600/20">
              <PawPrint className="h-7 w-7" />
            </div>
          ) : (
            <img
              src="/images/vetMascot/DogAndCat.webp"
              alt="Mascotas de Ariels Clinic"
              onError={() => setMascotFailed(true)}
              draggable={false}
              className="h-24 w-24 select-none object-contain"
            />
          )}
          <h1 className="font-display text-xl font-bold text-slate-900">Panel Interno</h1>
          <p className="font-hand text-2xl leading-none text-brand-orange">Ariel&apos;s Clinic</p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Hospital veterinario · Panel del personal</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Correo</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              placeholder="tu@veterinaria.pe"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              placeholder="••••••••"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-orange py-2.5 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
