export type SessionStatus = "idle" | "tracking" | "completed";

export type StopType =
  | "printer"
  | "cafe"
  | "bulletin_board"
  | "community_center"
  | "other";

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy?: number;
}

export interface SessionStop {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  type: StopType;
  label?: string;
}

export interface VolunteerSession {
  id: string;
  userId?: number;
  startTime: string;
  endTime: string | null;
  status: SessionStatus;
  routePoints: RoutePoint[];
  stops: SessionStop[];
  totalDistanceMeters: number;
  totalDistanceMiles?: number;
  durationSeconds: number;
  routeImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionApiResponse {
  success: boolean;
  data: VolunteerSession;
}

export interface SessionsApiResponse {
  success: boolean;
  count: number;
  data: VolunteerSession[];
}
