import { useState, type FormEvent } from "react";
import { Lock, MessageCircleHeart, PawPrint } from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";

// Login del panel — nivel visual del resto del sistema (15/11 feedback de
// marketing: la versión anterior era "muy simple"). Desktop: 2 columnas con
// panel de marca (degradado azul→naranja como el top del wizard, logo real,
// mascota de bienvenida) y formulario a la derecha. Móvil: apilado.
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

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-100 lg:grid-cols-[5fr_6fr]">
        {/* Panel de marca (solo desktop): degradado + logo real + mascota */}
        <aside
          className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-blue via-[#2E5ECC] to-brand-orange p-8 text-white lg:flex"
        >
          {/* Huellitas suaves sobre el degradado */}
          <PawPrint className="absolute -right-6 -top-4 h-28 w-28 rotate-[18deg] text-white/10" strokeWidth={1.5} />
          <PawPrint className="absolute bottom-24 -left-8 h-20 w-20 rotate-[-24deg] text-white/10" strokeWidth={1.5} />
          <div className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <div className="inline-flex items-center rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
              <img
                src="/logo.webp"
                alt=""
                draggable={false}
                className="h-11 w-auto select-none"
              />
            </div>
            <p className="mt-6 font-display text-2xl font-bold leading-snug">
              El sistema de<br />Ariel&apos;s Clinic
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Reservas, grooming y laboratorio de las 3 sedes en un solo panel.
            </p>
          </div>

          <div className="relative flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
              <PawPrint className="h-5 w-5 shrink-0 text-white/90" />
              <p className="text-xs leading-tight">
                <b className="block text-sm">Seguimiento en vivo</b>
                Cada mascota, su fase: baño, secado, corte.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
              <MessageCircleHeart className="h-5 w-5 shrink-0 text-white/90" />
              <p className="text-xs leading-tight">
                <b className="block text-sm">WhatsApp automático</b>
                Avisos al cliente en cada paso del viaje.
              </p>
            </div>
            {mascotFailed ? (
              <div className="flex h-16 w-16 items-center justify-center self-start rounded-2xl bg-white/15 ring-1 ring-white/20">
                <PawPrint className="h-8 w-8" />
              </div>
            ) : (
              <img
                src="/images/vetMascot/DogAndCat.webp"
                alt=""
                onError={() => setMascotFailed(true)}
                draggable={false}
                className="h-24 w-24 self-start select-none object-contain"
              />
            )}
          </div>
        </aside>

        {/* Formulario */}
        <div className="p-8 sm:p-10">
          {/* Cabecera compacta (siempre visible; en móvil es la única marca) */}
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100 lg:hidden">
              <img src="/logo.webp" alt="Veterinaria Ariel" className="h-10 w-auto select-none" draggable={false} />
            </div>
            {mascotFailed ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-600/20 lg:hidden">
                <PawPrint className="h-7 w-7" />
              </div>
            ) : (
              <img
                src="/images/vetMascot/DogAndCat.webp"
                alt="Mascotas de Ariels Clinic"
                onError={() => setMascotFailed(true)}
                draggable={false}
                className="h-20 w-20 select-none object-contain lg:hidden"
              />
            )}
            <h1 className="font-display text-xl font-bold text-slate-900">Panel Interno</h1>
            <p className="font-hand text-2xl leading-none text-brand-orange">Ariel&apos;s Clinic</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Hospital veterinario · Panel del personal
            </p>
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
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
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
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                placeholder="••••••••"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-orange py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
