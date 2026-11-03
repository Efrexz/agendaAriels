export interface TrackingBooking {
  bookingCode: string;
  status: string;
  serviceDate: string;
  timeSlot: string;
  branchLabel: string;
  createdAt: string;
  pets: Array<{ name: string; type: string; service: string }>;
  timeline: Array<{ status: string; createdAt: string }>;
}

export interface TrackingLab {
  orderCode: string;
  status: string;
  petName: string;
  examType: string;
  sedeLabel: string;
  /** Teléfono PÚBLICO de la sede responsable (para consultas; nunca tel. del dueño). */
  sedePhone: string;
  createdAt: string;
  timeline: Array<{ status: string; createdAt: string }>;
  /** Hay un archivo, pero su descarga requiere el enlace privado. */
  resultAvailable?: boolean;
  /** true → el resultado existió pero su ventana de 20 días ya terminó. */
  resultExpired?: boolean;
}

export type TrackingResult = TrackingBooking | TrackingLab;
