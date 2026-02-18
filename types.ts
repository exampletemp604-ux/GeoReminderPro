
export type ReminderStatus = 'active' | 'triggered' | 'completed';

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  originalInput: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: number;
  status: ReminderStatus;
  triggeredAt?: number;
  lastDistance?: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoStatus {
  active: boolean;
  error: string | null;
  lastUpdate: number | null;
}
