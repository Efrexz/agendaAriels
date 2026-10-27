import { useState, type FormEvent } from "react";
import { Lock, PawPrint } from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-slate-900/5">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* Mascota de bienvenida (pulido UX-C): fallback a paw si falta el webp */}
          {mascotFailed ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white">
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
          <p className="font-hand text-lg leading-none text-brand-orange">Ariels Clinic</p>
          <p className="text-sm text-slate-500">Veterinaria Ariel · Panel del personal</p>
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
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
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
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              placeholder="••••••••"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
