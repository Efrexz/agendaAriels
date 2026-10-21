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
