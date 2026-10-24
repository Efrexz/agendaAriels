// CAPA TEMPORAL de previsualización (se borra antes del commit):
// monta la sendería del panel con datos ficticios para revisión visual.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./src/internal/panel.css";
import { BookingCard } from "./src/internal/BookingCard";
import { ClosuresPanel } from "./src/internal/ClosuresPanel";

const pet = (name: string, type: string) => ({
  name, type, service: "Baño", size: "Grande", bathType: "Hidratado Premium", corteType: "-",
  corteSpecs: "-", extras: ["Desparasitación"], perfume: "-", notes: "-", corteImage: null,
});

const b1 = {
  id: "b1", bookingCode: "VA-12345", branch: "san_martin", branchLabel: "Sede San Martín de Porres",
  serviceDate: "2026-10-23", timeSlot: "9-11", ownerName: "Efraín Andrade", ownerPhone: "51900000000",
  ownerAddress: "Av. Los Próceres 581, San Martin de Porres 15107", mapsUrl: "https://maps.google.com",
  status: "en_bano", whatsappDelivered: false, pets: [pet("Manolo", "perro")],
  createdAt: "2026-10-23T14:00:00Z",
  timeline: [{ status: "en_bano", createdBy: "recepcion@ariel.pe", createdAt: "2026-10-23T15:20:00Z" }],
};
const b2 = { ...b1, id: "b2", bookingCode: "VA-12346", ownerName: "Lady Abigail", status: "listo", whatsappDelivered: true, pets: [pet(" Luna", "gato")] };
const b3 = { ...b1, id: "b3", bookingCode: "VA-12340", ownerName: "Heidy Berlin", status: "en_camino_recojo", pets: [pet("Rocco", "perro")] };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="mx-auto max-w-6xl p-6"><div style={{ height: 64 }} />
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="flex flex-col gap-3">
          <BookingCard booking={b1} onChanged={() => {}} printing={false} onPrint={() => {}} onPrinted={() => {}} />
          <BookingCard booking={b2} onChanged={() => {}} printing={false} onPrint={() => {}} onPrinted={() => {}} />
        </div>
        <div className="flex flex-col gap-3">
          <BookingCard booking={b3} onChanged={() => {}} printing={false} onPrint={() => {}} onPrinted={() => {}} />
          <ClosuresPanel closures={[{ id: "c1", branch: "san_martin", closureDate: "2026-12-25", timeSlot: null, reason: "Navidad" }]} onChanged={() => {}} hidden={false} />
        </div>
      </div>
    </div>
  </StrictMode>,
);
