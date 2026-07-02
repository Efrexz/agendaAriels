import { useRef, useState, useCallback, useEffect } from "react";
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from "@react-google-maps/api";
import type { FormData } from "../BookingWizard";

interface ReviewStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const LIMA_CENTER = { lat: -12.046374, lng: -77.042793 };

const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  san_martin: { lat: -12.0194, lng: -77.0712 },
  los_olivos: { lat: -11.9815, lng: -77.0739 },
  san_miguel: { lat: -12.0783, lng: -77.0904 },
};

const MAP_LIBRARIES: ("places")[] = ["places"];

function getDefaultCenter(branch: string | null) {
  if (branch && BRANCH_COORDS[branch]) return BRANCH_COORDS[branch];
  return LIMA_CENTER;
}

export function ReviewStep({ formData, update, onNext }: ReviewStepProps) {
  const isCat = formData.petType === "cat";

  // Auto-select species to match petType when not yet set or inconsistent
  useEffect(() => {
    if (isCat && formData.petSpecies !== "cat") {
      update("petSpecies", "cat");
    }
  }, [isCat, formData.petSpecies, update]);

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
  };

  const isValid = () => {
    if (formData.hasHistory === true) {
      return formData.ownerDni.trim() !== "" && formData.registeredPetName.trim() !== "" && formData.registeredPhone.trim() !== "";
    }
    if (formData.hasHistory === false) {
      const baseValid = formData.ownerDni.trim() !== "" && formData.ownerName.trim() !== "" && formData.ownerAddress.trim() !== "" && formData.ownerPhone.trim() !== "" && formData.registeredPetName.trim() !== "" && formData.petBirthDate.trim() !== "" && formData.petSpecies !== null && formData.petBreed.trim() !== "";
      if (formData.mobilityPhoneDifferent) {
        return baseValid && formData.mobilityPhone.trim() !== "";
      }
      return baseValid;
    }
    return false;
  };

  const lastPetName = formData.pets.length > 0 ? formData.pets[formData.pets.length - 1].petName : formData.petName;

  return (
    <div>
      <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-gray-800">
        Datos del cliente
      </h2>

      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Dirección de recojo <span className="text-red-500">*</span>
          </label>
          <p className="mb-3 text-xs text-gray-500">
            Escribe tu dirección en Lima para que podamos recoger a tu mascota.
          </p>
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
              mapContainerClassName="h-64 w-full"
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
            </GoogleMap>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  DNI del titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ownerDni}
                  onChange={(e) => update("ownerDni", e.target.value)}
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
                  onChange={(e) => update("registeredPhone", e.target.value)}
                  placeholder="Ej: 555-123-4567"
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
                  onChange={(e) => update("ownerDni", e.target.value)}
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
                  onChange={(e) => update("ownerPhone", e.target.value)}
                  placeholder="Ej: 555-123-4567"
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
          </div>
        )}

        {formData.hasHistory !== null && (
          <>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="mobilityDifferent"
                checked={formData.mobilityPhoneDifferent}
                onChange={(e) => update("mobilityPhoneDifferent", e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mobilityDifferent" className="text-sm font-medium text-gray-700 cursor-pointer">
                ¿El número que recibirá a la movilidad es diferente al registrado?
              </label>
            </div>

            {formData.mobilityPhoneDifferent && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Teléfono de contacto para la movilidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobilityPhone}
                  onChange={(e) => update("mobilityPhone", e.target.value)}
                  placeholder="Ej: 555-987-6543"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Observaciones de la mascota
              </label>
              <textarea
                rows={4}
                value={formData.petNotes}
                onChange={(e) => update("petNotes", e.target.value)}
                placeholder={isCat ? "Ej: Mi gato se pone nervioso con la secadora..." : "Ej: Mi perro se pone nervioso con la secadora..."}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
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