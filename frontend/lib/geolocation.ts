import { haversineDistanceMeters } from "@/lib/distance";
import type { RoutePoint } from "@/types/tracker";

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
};

const MAX_ACCEPTED_ACCURACY_METERS = 80;
const MIN_MOVEMENT_METERS = 4;
const MAX_IMPOSSIBLE_SPEED_METERS_PER_SECOND = 12;
const MAX_ZERO_TIME_JUMP_METERS = 80;

export function createRoutePoint(position: GeolocationPosition): RoutePoint {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: new Date(position.timestamp).toISOString(),
    accuracy: position.coords.accuracy,
  };
}

export function getGeolocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Enable it in your browser to track a session.";
    case error.POSITION_UNAVAILABLE:
      return "Your location is unavailable right now. Try moving to an area with better signal.";
    case error.TIMEOUT:
      return "Location lookup timed out. Try again in a few seconds.";
    default:
      return "Unable to access your location right now.";
  }
}

export function isRecoverableGeolocationError(error: GeolocationPositionError) {
  return (
    error.code === error.POSITION_UNAVAILABLE ||
    error.code === error.TIMEOUT
  );
}

export function shouldAppendRoutePoint(points: RoutePoint[], nextPoint: RoutePoint) {
  if (
    typeof nextPoint.accuracy === "number" &&
    nextPoint.accuracy > MAX_ACCEPTED_ACCURACY_METERS
  ) {
    return false;
  }

  const previousPoint = points[points.length - 1];

  if (!previousPoint) {
    return true;
  }

  if (
    previousPoint.lat === nextPoint.lat &&
    previousPoint.lng === nextPoint.lng &&
    previousPoint.timestamp === nextPoint.timestamp
  ) {
    return false;
  }

  const distanceMeters = haversineDistanceMeters(previousPoint, nextPoint);
  if (distanceMeters < MIN_MOVEMENT_METERS) {
    return false;
  }

  const previousTimestamp = Date.parse(previousPoint.timestamp);
  const nextTimestamp = Date.parse(nextPoint.timestamp);
  const elapsedSeconds = Math.max(0, (nextTimestamp - previousTimestamp) / 1000);

  if (elapsedSeconds === 0 && distanceMeters > MAX_ZERO_TIME_JUMP_METERS) {
    return false;
  }

  if (
    elapsedSeconds > 0 &&
    distanceMeters / elapsedSeconds > MAX_IMPOSSIBLE_SPEED_METERS_PER_SECOND &&
    distanceMeters > MAX_ZERO_TIME_JUMP_METERS
  ) {
    return false;
  }

  return true;
}

export function startLocationWatch(
  onSuccess: PositionCallback,
  onError: PositionErrorCallback,
  options?: PositionOptions,
) {
  if (!("geolocation" in navigator)) {
    throw new Error("Geolocation is not supported by this browser.");
  }

  return navigator.geolocation.watchPosition(onSuccess, onError, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

export function requestCurrentPosition(options?: PositionOptions) {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("Geolocation is not supported by this browser."));
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  });
}

export function stopLocationWatch(watchId: number | null) {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
}
