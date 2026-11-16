import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, MessageCircleHeart, PawPrint } from "lucide-react";
import { getSupabaseClient } from "./supabaseClient";

// Login del panel — nivel visual del resto del sistema (15/11 feedback de
// marketing con imagen de referencia aprobada): desktop 2 columnas — panel
// de marca (degradado azul→naranja, logo real, barra de acento, chips con
// icono en cuadrito blanco y MASCOTAS sin fondo asomando por el borde
// inferior, animadas con framer-motion) + formulario a la derecha (labels
// con icono, ojito en contraseña). Móvil: apilado.
// Fondo exterior: el MISMO background.webp del wizard (brand-approved).
// Las mascotas animan por código (no webp animado) — mismo criterio que
// /estado: webp estática + motion, con prefers-reduced-motion respetado.
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mascotFailed, setMascotFailed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;

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

  // Entrada (contenedor) + respiración en loop (imagen) por separado:
  // framer-motion no encadena bien dos animaciones en la MISMA propiedad.
  const entrance = reduceMotion
    ? { initial: false as const, animate: {} }
    : { initial: { opacity: 0, y: 44 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Fondo exterior calmado: patrón pastel de huellitas propio del
          proyecto (feedback 16/11 — el colorido del wizard cansaba detrás
          de la card) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img src="/images/bg/fondo.webp" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-100 lg:grid-cols-[5fr_6fr]">
        {/* Panel de marca (solo desktop) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-blue via-[#2E5ECC] to-brand-orange p-8 text-white lg:flex">
          {/* Capas orgánicas sobre el degradado (como la referencia) */}
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="absolute -bottom-28 -right-10 h-64 w-64 rounded-full bg-orange-300/25 blur-2xl" />
          <div aria-hidden className="absolute -left-16 top-1/2 h-52 w-52 rounded-full bg-white/5 blur-xl" />
          <PawPrint aria-hidden className="absolute right-4 top-4 h-24 w-24 rotate-[18deg] text-white/10" strokeWidth={1.5} />

          <div className="relative">
            <div className="inline-flex items-center rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
              <img
                src="/logo.webp"
                alt=""
                draggable={false}
                className="h-11 w-auto select-none"
              />
            </div>
            <p className="mt-5 font-display text-2xl font-bold leading-snug">
              El sistema de<br />Ariel&apos;s Clinic
            </p>
            {/* Barra de acento de marca (misma gramática que /estado) */}
            <div aria-hidden className="mt-2 h-1 w-10 rounded-full bg-orange-400" />
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Reservas, grooming y laboratorio de las 3 sedes en un solo panel.
            </p>
          </div>

          <div className="relative flex flex-1 flex-col justify-end gap-3 pt-6">
            <div className="flex items-center gap-3 rounded-2xl bg-white/12 px-3.5 py-2.5 ring-1 ring-white/15">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-blue shadow-sm">
                <PawPrint className="h-5 w-5" />
              </span>
              <p className="text-xs leading-tight">
                <b className="block text-sm">Seguimiento en vivo</b>
                Cada mascota, su fase: baño, secado, corte.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/12 px-3.5 py-2.5 ring-1 ring-white/15">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#25D366] shadow-sm">
                <MessageCircleHeart className="h-5 w-5" />
              </span>
              <p className="text-xs leading-tight">
                <b className="block text-sm">WhatsApp automático</b>
                Avisos al cliente en cada paso del viaje.
              </p>
            </div>
          </div>

          {/* Mascotas sin fondo al pie del panel, EN FLUJO (el panel reserva
              su altura; sangran un poco hacia el borde como la referencia).
              Fallback: se ocultan solas si el webp falta. */}
          {mascotFailed ? (
            <PawPrint aria-hidden className="relative h-10 w-10 text-white/25" />
          ) : (
            <motion.div
              {...entrance}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="pointer-events-none relative -ml-1 -mb-6 mt-3 self-start"
            >
              <motion.img
                src="/images/vetMascot/LoginDogAndCat.webp"
                alt=""
                onError={() => setMascotFailed(true)}
                draggable={false}
                aria-hidden
                animate={reduceMotion ? {} : { scale: [1, 1.02, 1] }}
                transition={reduceMotion ? {} : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-44 select-none drop-shadow-lg xl:w-48"
              />
            </motion.div>
          )}
        </aside>

        {/* Formulario */}
        <div className="p-8 sm:p-10">
          {/* Cabecera compacta (siempre visible; en móvil es la única marca) */}
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100 lg:hidden">
              <img src="/logo.webp" alt="Veterinaria Ariel" className="h-10 w-auto select-none" draggable={false} />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#475AAB]">Panel Interno</h1>
            {/* Marca manuscrita con líneas a los lados (referencia) */}
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px w-10 rounded-full bg-slate-200" />
              <span className="font-hand text-2xl leading-none text-brand-orange">Ariel&apos;s Clinic</span>
              <span aria-hidden className="h-px w-10 rounded-full bg-slate-200" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Hospital veterinario · Panel del personal
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Mail className="h-4 w-4 text-brand-blue" />
                Correo
              </span>
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
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Lock className="h-4 w-4 text-brand-blue" />
                Contraseña
              </span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </span>
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
