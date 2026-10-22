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
  createdAt: string;
  timeline: Array<{ status: string; createdAt: string }>;
}

export type TrackingResult = TrackingBooking | TrackingLab;
