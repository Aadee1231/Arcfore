/** Geodesic helpers — pure functions, unit-testable. */

const EARTH_RADIUS_M = 6371008.8; // IUGG mean earth radius, metres

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in metres. Accurate to ~0.5% — fine for golf yardages. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const METERS_PER_YARD = 0.9144;

export function metersToYards(m: number): number {
  return m / METERS_PER_YARD;
}

export function metersToMeters(m: number): number {
  return m;
}

/** Distance between two coords in the user's preferred unit. */
export function distanceInUnits(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  units: 'yards' | 'meters',
): number {
  const meters = haversineMeters(a, b);
  return units === 'yards' ? metersToYards(meters) : meters;
}

/** Format a distance for display, e.g. "142 yd" / "130 m" / "1.2 km". */
export function formatDistance(distanceInUnit: number, units: 'yards' | 'meters'): string {
  const rounded = Math.round(distanceInUnit);
  return `${rounded} ${units === 'yards' ? 'yd' : 'm'}`;
}

export function formatDistanceKm(km: number, units: 'yards' | 'meters'): string {
  if (units === 'meters') {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }
  const miles = km * 0.621371;
  return miles < 0.1 ? `${Math.round(miles * 1760)} yd` : `${miles.toFixed(1)} mi`;
}
