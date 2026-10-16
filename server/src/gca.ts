import { env } from './env.js';

/**
 * Golf Courses API client — normalizes GCA payloads into our course shapes.
 * https://golfcoursesapi.com/docs
 */

export class GcaError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface GcaCourseSummary {
  id: number;
  name: string;
  club: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km?: number;
}

export interface GcaTeeHole {
  hole: number;
  par: number;
  yards: number | null;
  handicap: number | null;
  handicap_women: number | null;
}
export interface GcaTeebox {
  name: string;
  rating: number | null;
  rating_women: number | null;
  slope: number | null;
  slope_women: number | null;
  total_yards: number | null;
  holes: GcaTeeHole[];
}
export interface GcaCourseDetail {
  id: number;
  name: string;
  club: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
  website: string | null;
  location: {
    city: string | null;
    state: string | null;
    country: { name: string; iso2: string } | null;
  } | null;
  coordinates: { latitude: number | null; longitude: number | null } | null;
  scorecard: { hole_count: number; teeboxes: GcaTeebox[] } | null;
  green_centers_available: boolean;
}

async function gcaFetch<T>(path: string): Promise<T> {
  const key = env.gcaApiKey;
  if (!key) throw new GcaError(503, 'Course data provider is not configured (missing GCA_API_KEY)');
  const res = await fetch(`${env.gcaBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    throw new GcaError(
      429,
      'Course data rate limit reached — try again later',
      Number(res.headers.get('Retry-After') ?? '0') || null,
    );
  }
  if (res.status === 403) {
    throw new GcaError(403, 'This course endpoint requires a paid GCA plan');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new GcaError(res.status, body?.message ?? `GCA request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

interface ListEnvelope<T> {
  data: T[];
  meta?: { current_page: number; per_page: number; total: number };
}

export async function searchCourses(q: string, page = 1, perPage = 25) {
  const res = await gcaFetch<ListEnvelope<GcaCourseSummary>>(
    `/courses?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`,
  );
  return res;
}

export async function nearbyCourses(lat: number, lng: number, radiusKm = 25, perPage = 25) {
  const res = await gcaFetch<ListEnvelope<GcaCourseSummary>>(
    `/courses?lat=${lat}&lng=${lng}&radius=${Math.min(radiusKm, 100)}&per_page=${perPage}`,
  );
  return res;
}

export async function getCourse(id: number | string) {
  const res = await gcaFetch<{ data: GcaCourseDetail }>(`/courses/${id}`);
  return res.data;
}

export async function getGreenCenters(id: number | string) {
  const res = await gcaFetch<{
    data: { course_id: number; holes: { hole: number; lat: number; lng: number }[] };
  }>(`/courses/${id}/green-centers`);
  return res.data;
}

// ---------- normalization ----------

export function normalizeSummary(c: GcaCourseSummary) {
  return {
    provider: 'gca' as const,
    providerId: String(c.id),
    name: c.name ?? c.club ?? 'Unknown course',
    clubName: c.club ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    country: c.country ?? null,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    ...(c.distance_km != null ? { distanceKm: c.distance_km } : {}),
  };
}

export function normalizeDetail(d: GcaCourseDetail) {
  const teeboxes = d.scorecard?.teeboxes ?? [];
  const holeCount = d.scorecard?.hole_count ?? (teeboxes[0]?.holes.length || 18);
  // Canonical pars: take the first teebox that has a full set of hole pars
  const canonical = teeboxes.find((t) => t.holes?.length) ?? teeboxes[0];
  const pars: number[] = Array.from({ length: holeCount }, (_, i) => {
    const h = canonical?.holes?.find((x) => x.hole === i + 1);
    return h?.par ?? 4;
  });
  return {
    provider: 'gca' as const,
    providerId: String(d.id),
    name: d.name ?? d.club ?? 'Unknown course',
    clubName: d.club ?? null,
    address: d.address ?? null,
    postalCode: d.postal_code ?? null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    city: d.location?.city ?? null,
    state: d.location?.state ?? null,
    country: d.location?.country?.iso2 ?? null,
    latitude: d.coordinates?.latitude ?? null,
    longitude: d.coordinates?.longitude ?? null,
    holeCount,
    pars,
    teeSets: teeboxes.map((t, i) => ({
      id: `gca-${d.id}-t${i}`,
      name: t.name ?? `Tee ${i + 1}`,
      rating: t.rating ?? null,
      slope: t.slope ?? null,
      ratingWomen: t.rating_women ?? null,
      slopeWomen: t.slope_women ?? null,
      totalYards: t.total_yards ?? null,
      holes: (t.holes ?? []).map((h) => ({
        hole: h.hole,
        par: h.par,
        yards: h.yards ?? null,
        handicap: h.handicap ?? null,
        handicapWomen: h.handicap_women ?? null,
      })),
    })),
    greenCentersAvailable: d.green_centers_available === true,
  };
}
