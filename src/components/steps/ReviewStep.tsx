import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from "@react-google-maps/api";
import { MapPin, Navigation } from "lucide-react";
import type { FormData } from "../BookingWizard";
import { validateOwnerInfo } from "../../state/schemas";
import { BRANCH_COORDS, MAX_PICKUP_DISTANCE_KM, BRANCH_BY_VALUE } from "../../data/branches";
import { haversineKm } from "../../utils/geo";

interface ReviewStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const LIMA_CENTER = { lat: -12.046374, lng: -77.042793 };

const MAP_LIBRARIES: ("places")[] = ["places"];

function maskDni(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getDefaultCenter(branch: string | null) {
  if (branch && BRANCH_COORDS[branch]) return BRANCH_COORDS[branch];
  return LIMA_CENTER;
}

export function ReviewStep({ formData, update, onNext }: ReviewStepProps) {
  const uniformPetType = useMemo(() => {
    const types = new Set(formData.pets.map((pet) => pet.petType));
    return types.size === 1 ? formData.pets[0].petType : null;
  }, [formData.pets]);
  const isCat = uniformPetType === "cat";

  // Auto-select species to match the booked pet(s) when consistent
  useEffect(() => {
    if (uniformPetType && formData.petSpecies !== uniformPetType) {
      update("petSpecies", uniformPetType);
    }
  }, [uniformPetType, formData.petSpecies, update]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [mapCenter, setMapCenter] = useState(() => {
    if (formData.ownerLat && formData.ownerLng) {
      return { lat: formData.ownerLat, lng: formData.ownerLng };
    }
    return getDefaultCenter(formData.branch);
  });

  const [markerPos, setMarkerPos] = useState(() => {
    if (formData.ownerLat && formData.ownerLng) {
      return { lat: formData.ownerLat, lng: formData.ownerLng };
    }
    return null;
  });

  const [inputValue, setInputValue] = useState(formData.ownerAddress || "");
  const [showBranchLocation, setShowBranchLocation] = useState(false);

  const branchCoords = formData.branch ? BRANCH_COORDS[formData.branch] : null;

  const computeDistance = useCallback(
    (lat: number, lng: number) => {
      const branch = formData.branch;
      if (!branch || !BRANCH_COORDS[branch]) return null;
      return haversineKm(BRANCH_COORDS[branch], { lat, lng });
    },
    [formData.branch],
  );

  const distanceKm = useMemo(
    () =>
      formData.ownerLat !== null && formData.ownerLng !== null
        ? computeDistance(formData.ownerLat, formData.ownerLng)
        : null,
    [formData.ownerLat, formData.ownerLng, computeDistance],
  );

  const outOfRange = distanceKm !== null && distanceKm > MAX_PICKUP_DISTANCE_KM;
  const pickupMissing =
    formData.ownerAddress.trim() !== "" &&
    (formData.ownerLat === null || formData.ownerLng === null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || "";
    setInputValue(address);
    update("ownerAddress", address);
    update("ownerLat", lat);
    update("ownerLng", lng);
    setMarkerPos({ lat, lng });
    setMapCenter({ lat, lng });
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(18);
  };

  const onMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    update("ownerLat", lat);
    update("ownerLng", lng);
    setMarkerPos({ lat, lng });
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const addr = results[0].formatted_address;
        setInputValue(addr);
        update("ownerAddress", addr);
      }
    });
  };

  const handleHistorySelect = (hasHistory: boolean) => {
    update("hasHistory", hasHistory);
    if (hasHistory) {
      update("ownerPhone", "");
    }
  };

  const isValid = () => {
    if (outOfRange) return false;
    if (pickupMissing) return false;
    return validateOwnerInfo({
      ownerDni: formData.ownerDni,
      ownerName: formData.ownerName,
      ownerAddress: formData.ownerAddress,
      ownerLat: formData.ownerLat,
      ownerLng: formData.ownerLng,
      ownerPhone: formData.ownerPhone,
      registeredPhone: formData.registeredPhone,
      registeredPetName: formData.registeredPetName,
      petBirthDate: formData.petBirthDate,
      petSpecies: formData.petSpecies,
      petBreed: formData.petBreed,
      hasHistory: formData.hasHistory,
      mobilityPhoneDifferent: formData.mobilityPhoneDifferent,
      mobilityPhone: formData.mobilityPhone,
      legalAgeConfirmed: formData.legalAgeConfirmed,
      ownerEmail: formData.ownerEmail,
    });
  };

  const lastPetName = formData.pets.length > 0 ? formData.pets[formData.pets.length - 1].petName : formData.petName;

  return (
    <div>
      <h2 className="mb-6 sm:mb-8 text-center text-step-title font-display font-bold tracking-tight text-gray-800">
        Datos del cliente
      </h2>

      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Dirección de recojo <span className="text-red-500">*</span>
          </label>
          <p className="mb-3 text-xs text-gray-500">
            Escribe tu dirección en Lima (máximo {MAX_PICKUP_DISTANCE_KM} km de la sede) para que podamos recoger a tu mascota.
          </p>
          {pickupMissing && (
            <p className="mt-1 text-xs font-medium text-orange-600">
              Elige una dirección de la lista o arrastra el pin en el mapa para confirmar tu ubicación.
            </p>
          )}
          {isLoaded ? (
            <Autocomplete
              onLoad={(ref) => { autocompleteRef.current = ref; }}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  update("ownerAddress", e.target.value);
                }}
                placeholder="Ej: Av. Javier Prado 1234, San Isidro"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </Autocomplete>
          ) : (
            <div className="flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-400">
              Cargando buscador de direcciones...
            </div>
          )}
        </div>

        {isLoaded && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md">
            <GoogleMap
              mapContainerClassName="h-72 w-full sm:h-80"
              center={mapCenter}
              zoom={markerPos ? 18 : 14}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {markerPos && (
                <Marker
                  position={markerPos}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                />
              )}
              {showBranchLocation && branchCoords && (
                <Marker
                  position={branchCoords}
                  label={{ text: "Sede", color: "white", fontWeight: "bold" }}
                />
              )}
            </GoogleMap>
          </div>
        )}

        {showBranchLocation && branchCoords && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <MapPin className="h-4 w-4 shrink-0" />
              Esta es la ubicación de nuestra sede
            </p>
          </div>
        )}

        {distanceKm !== null && outOfRange && (
          <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-bold text-orange-700">
              No contamos con cobertura de recojo hasta esta zona
            </p>
            <p className="mt-1 text-xs leading-relaxed text-orange-600">
              Tu dirección está a {distanceKm.toFixed(1)} km de la sede, pero solo cubrimos un radio de {MAX_PICKUP_DISTANCE_KM} km. Si lo deseas, puedes acercarte a nuestra sede con tu mascota. ¡Te esperamos!
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowBranchLocation(true);
                  if (branchCoords) {
                    setMapCenter(branchCoords);
                    mapRef.current?.panTo(branchCoords);
                    mapRef.current?.setZoom(16);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98] cursor-pointer"
              >
                <Navigation className="h-4 w-4" />
                Ver ubicación de la sede
              </button>
              <a
                href={`https://wa.me/${(formData.branch && BRANCH_BY_VALUE[formData.branch] ? BRANCH_BY_VALUE[formData.branch].phone.replace(/\D/g, "") : "")}?text=${encodeURIComponent("Hola! Vengo de la página web y quisiera consultar sobre el servicio de grooming.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#22c35e] active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#ffffff" />
                </svg>
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        )}

        {distanceKm !== null && !outOfRange && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Estás a {distanceKm.toFixed(1)} km de la sede — dentro del rango de cobertura
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            ¿Tiene historia clínica con nosotros?
          </label>
          <div className="mt-2 flex gap-4">
            <button
              onClick={() => handleHistorySelect(true)}
              className={`flex-1 rounded-xl border-2 py-3 text-lg font-semibold transition-all ${
                formData.hasHistory === true
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}
            >
              Sí
            </button>
            <button
              onClick={() => handleHistorySelect(false)}
              className={`flex-1 rounded-xl border-2 py-3 text-lg font-semibold transition-all ${
                formData.hasHistory === false
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {formData.hasHistory === true && (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre completo del titular <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  DNI del titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ownerDni}
                  onChange={(e) => update("ownerDni", maskDni(e.target.value))}
                  placeholder="Ej: 12345678"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Teléfono registrado <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.registeredPhone}
                  onChange={(e) => {
                    const masked = maskPhone(e.target.value);
                    update("registeredPhone", masked);
                    update("ownerPhone", masked);
                  }}
                  placeholder="Ej: 999-888-777"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>
        )}

        {formData.hasHistory === false && (
          <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm">
            <p className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3 text-sm text-orange-600 shadow-sm">
              Solo mayores de edad pueden registrar la historia
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  DNI <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ownerDni}
                  onChange={(e) => update("ownerDni", maskDni(e.target.value))}
                  placeholder="Ej: 12345678"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre completo del titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => update("ownerName", e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.ownerPhone}
                  onChange={(e) => update("ownerPhone", maskPhone(e.target.value))}
                  placeholder="Ej: 999-888-777"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre de la mascota <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.registeredPetName}
                  onChange={(e) => update("registeredPetName", e.target.value)}
                  placeholder={lastPetName || "Ej: Firulais"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Fecha de nacimiento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.petBirthDate}
                  onChange={(e) => update("petBirthDate", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Especie <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => update("petSpecies", "dog")}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                      formData.petSpecies === "dog"
                          ? "border-sky-500 bg-sky-100 text-sky-800 shadow-sm"
                          : "border-sky-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    Perro
                  </button>
                  <button
                    onClick={() => update("petSpecies", "cat")}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                      formData.petSpecies === "cat"
                        ? "border-sky-500 bg-sky-100 text-sky-800 shadow-sm"
                        : "border-sky-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    Gato
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Raza <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.petBreed}
                  onChange={(e) => update("petBreed", e.target.value)}
                  placeholder={isCat ? "Ej: Siamés" : "Ej: Labrador"}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  ¿Castrado?
                </label>
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => update("petCastrated", true)}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                      formData.petCastrated === true
                          ? "border-sky-500 bg-sky-100 text-sky-800 shadow-sm"
                          : "border-sky-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => update("petCastrated", false)}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                      formData.petCastrated === false
                          ? "border-sky-500 bg-sky-100 text-sky-800 shadow-sm"
                          : "border-sky-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <label htmlFor="legalAgeConfirmed" className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg py-2 hover:bg-sky-100/50 sm:items-center">
              <input
                type="checkbox"
                id="legalAgeConfirmed"
                checked={formData.legalAgeConfirmed}
                onChange={(e) => update("legalAgeConfirmed", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 sm:mt-0"
              />
              <span className="text-sm font-medium leading-snug text-gray-700">
                Confirmo que soy mayor de edad y autorizo el registro de la historia clínica
              </span>
            </label>
          </div>
        )}

        {formData.hasHistory !== null && (
          <>
            <label htmlFor="mobilityDifferent" className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg py-2 hover:bg-blue-50/40 sm:items-center">
              <input
                type="checkbox"
                id="mobilityDifferent"
                checked={formData.mobilityPhoneDifferent}
                onChange={(e) => update("mobilityPhoneDifferent", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 sm:mt-0"
              />
              <span className="text-sm font-medium leading-snug text-gray-700">
                ¿El número que recibirá a la movilidad es diferente al registrado?
              </span>
            </label>

            {formData.mobilityPhoneDifferent && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Teléfono de contacto para la movilidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobilityPhone}
                  onChange={(e) => update("mobilityPhone", maskPhone(e.target.value))}
                  placeholder="Ej: 999-888-777"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            <div>
              <label htmlFor="ownerEmail" className="mb-1 block text-sm font-medium text-gray-700">
                Correo electrónico <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="email"
                id="ownerEmail"
                value={formData.ownerEmail}
                onChange={(e) => update("ownerEmail", e.target.value)}
                placeholder="Ej: juan@correo.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {formData.ownerEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail) && (
                <p className="mt-1 text-xs text-red-500">Correo inválido</p>
              )}
            </div>

            <button
              onClick={onNext}
              disabled={!isValid()}
              className={`w-full rounded-xl py-3 text-lg font-semibold text-white transition-all ${
                isValid()
                  ? "cursor-pointer bg-blue-600 shadow-md hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
                  : "cursor-not-allowed bg-gray-300"
              }`}
            >
              Siguiente
            </button>
          </>
        )}
      </div>
    </div>
  );
}