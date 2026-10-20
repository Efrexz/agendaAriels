export interface TrackingBooking {
  bookingCode: string;
  status: string;
  serviceDate: string;
  timeSlot: string;
  branchLabel: string;
  createdAt: string;
  pets: Array<{ name: string; type: string; service: string }>;
  timeline: Array<{ status: string; createdBy: string; createdAt: string }>;
}
