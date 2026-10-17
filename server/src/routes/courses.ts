import { Hono } from 'hono';
import type { AuthContext } from '../auth.js';
import { cached } from '../cache.js';
import { env } from '../env.js';
import * as gca from '../gca.js';

export const coursesRouter = new Hono<{ Variables: { auth: AuthContext } }>();

function cacheTtl() {
  return env.courseCacheTtlSeconds;
}

/** Search courses by name. */
coursesRouter.get('/search', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const page = Math.max(1, Number(c.req.query('page') ?? '1') || 1);
  if (q.length < 2) return c.json({ data: [], meta: { page, perPage: 25, total: 0 } });
  try {
    const key = `gca:search:${q.toLowerCase()}:${page}`;
    const res = await cached(key, cacheTtl(), () => gca.searchCourses(q, page));
    return c.json({
      data: (res.data ?? []).map(gca.normalizeSummary),
      meta: { page, perPage: res.meta?.per_page ?? 25, total: res.meta?.total ?? 0 },
    });
  } catch (e) {
    return gcaError(c, e);
  }
});

/** Nearby courses by device location. */
coursesRouter.get('/nearby', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const radius = Math.min(100, Number(c.req.query('radius') ?? '25') || 25);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ error: 'bad_request', message: 'lat and lng are required' }, 400);
  }
  try {
    const key = `gca:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
    const res = await cached(key, cacheTtl() / 4, () => gca.nearbyCourses(lat, lng, radius));
    return c.json({
      data: (res.data ?? []).map(gca.normalizeSummary),
      meta: { page: 1, perPage: res.meta?.per_page ?? 25, total: res.meta?.total ?? 0 },
    });
  } catch (e) {
    return gcaError(c, e);
  }
});

/** Course detail incl. scorecard. */
coursesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const key = `gca:course:${id}`;
    const detail = await cached(key, cacheTtl(), () => gca.getCourse(id));
    return c.json(gca.normalizeDetail(detail));
  } catch (e) {
    return gcaError(c, e);
  }
});

/** Green-center GPS — paid GCA tier; return graceful {available:false} on 403. */
coursesRouter.get('/:id/green-centers', async (c) => {
  const id = c.req.param('id');
  try {
    const key = `gca:greens:${id}`;
    const data = await cached(key, cacheTtl() * 4, () => gca.getGreenCenters(id));
    return c.json({
      available: true,
      holes: (data.holes ?? []).map((h) => ({
        hole: h.hole,
        latitude: h.lat,
        longitude: h.lng,
      })),
    });
  } catch (e) {
    if (e instanceof gca.GcaError && e.status === 403) {
      return c.json({ available: false, holes: [], upgrade: true });
    }
    return gcaError(c, e);
  }
});

function gcaError(c: { json: (body: unknown, status?: number) => Response }, e: unknown) {
  if (e instanceof gca.GcaError) {
    const status = e.status === 429 ? 429 : e.status === 503 ? 503 : e.status === 403 ? 403 : 502;
    return c.json(
      {
        error: 'course_provider_error',
        message: e.message,
        ...(e.retryAfter ? { retryAfter: e.retryAfter } : {}),
      },
      status,
    );
  }
  const msg = e instanceof Error ? e.message : 'Course lookup failed';
  return c.json({ error: 'course_provider_error', message: msg }, 502);
}
