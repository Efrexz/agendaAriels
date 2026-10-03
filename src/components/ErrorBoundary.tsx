import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBF8F4] p-6 text-center">
        <img
          src="/images/vetMascot/error-dog.webp"
          alt="Mascota veterinaria preocupada"
          className="w-56 select-none sm:w-64"
        />
        <h1 className="text-xl font-display font-bold text-gray-800 sm:text-2xl">
          ¡Ah! Algo salió mal
        </h1>
        <p className="max-w-md text-sm text-gray-600">
          Ocurrió un error inesperado. No se envió ninguna reserva, tu información está a salvo.
          Recarga la página para continuar con tu agendamiento.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
