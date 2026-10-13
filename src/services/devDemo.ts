import { saveClientProfile, clearClientProfile } from "./clientProfile";
import { INITIAL_FORM_DATA, type FormData } from "../state/wizardReducer";

/**
 * Datos falsos para ver la variante "cliente recurrente" sin completar una
 * reserva real (el servidor de WhatsApp no tarda en dar error en dev).
 * Se activa SOLO en desarrollo con la URL: http://localhost:5173/?demo=1
 * Para limpiar el perfil: ?demo=0
 */
const DEMO_PROFILE: FormData = {
  ...INITIAL_FORM_DATA,
  branch: "san_martin",
  ownerName: "Demo Pérez",
  ownerPhone: "986-985-047",
  ownerAddress: "Av. Proceres 300, San Martín de Porres",
  ownerLat: -12.0215,
  ownerLng: -77.0860,
  ownerEmail: "demo@ejemplo.com",
  hasHistory: true,
  ownerDni: "12345678",
  registeredPhone: "986-985-047",
  registeredPetName: "Rocky",
  petBirthDate: "2019-03-15",
  petSpecies: "dog",
  petBreed: "Mestizo",
  petCastrated: true,
  mobilityPhoneDifferent: false,
  mobilityPhone: "",
  legalAgeConfirmed: true,
  pets: [
    {
      petType: "dog",
      service: "bath_cut",
      extraServices: [],
      size: "medium",
      coat: "normal",
      petNotes: "",
      petName: "Rocky",
      corteType: "rapado",
      corteSpecs: "",
      corteImage: "",
      bathType: "hidratado_premium",
      perfume: "fruital",
    },
    {
      petType: "dog",
      service: "bath",
      extraServices: [
        { service: "antiflea" },
        { service: "deworming", variant: "1m_pipeta_fipforte" },
      ],
      size: "small",
      coat: "normal",
      petNotes: "Le gustan los juguetes frios, no le gusta el secador fuerte.",
      petName: "Luna",
      corteType: null,
      corteSpecs: "",
      corteImage: "",
      bathType: "medicado",
      perfume: "fresco",
    },
    {
      petType: "cat",
      service: "bath_deslanado",
      extraServices: [],
      size: null,
      coat: "normal",
      petNotes: "",
      petName: "Michi",
      corteType: null,
      corteSpecs: "",
      corteImage: "",
      bathType: "tradicional",
      perfume: "floral",
    },
  ],
};

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** Solo para dev: aplica la semilla demo según el parámetro ?demo= de la URL. */
export function applyDevDemo(): void {
  if (typeof window === "undefined") return;
  applyDevDemoTo(import.meta.env.DEV, window.location.search, globalThis.localStorage ?? null);
}

export function applyDevDemoTo(
  isDev: boolean,
  search: string,
  storage: Storage | null,
): void {
  if (!isDev || !storage) return;
  const params = new URLSearchParams(search);
  const demo = params.get("demo");
  if (demo === "1") {
    saveClientProfile(DEMO_PROFILE, storage);
  } else if (demo !== null) {
    clearClientProfile(storage);
  }
}
