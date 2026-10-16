import { Hono } from 'hono';
import { cached } from '../cache.js';
import { env } from '../env.js';
import * as gca from '../gca.js';
import { getSupabaseAdmin } from '../supabase.js';
import type { AuthContext } from '../auth.js';

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
    const sb = getSupabaseAdmin();
    const key = `gca:search:${q.toLowerCase()}:${page}`;
    const res = await cached(sb, key, cacheTtl(), () => gca.searchCourses(q, page));
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
    const sb = getSupabaseAdmin();
    const key = `gca:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
    const res = await cached(sb, key, cacheTtl() / 4, () => gca.nearbyCourses(lat, lng, radius));
    return c.json({
      data: (res.data ?? []).map(gca.normalizeSummary),
      meta: { page: 1, perPage: res.meta?.per_page ?? 25, total: res.meta?.total ?? 0 },
    });
  } catch (e) {
    return gcaError(c, e);
  }
});

/** Course detail incl. scorecard — also persists a snapshot into golf_courses. */
coursesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const sb = getSupabaseAdmin();
    const key = `gca:course:${id}`;
    const detail = await cached(sb, key, cacheTtl(), () => gca.getCourse(id));
    const normalized = gca.normalizeDetail(detail);
    await persistCourseSnapshot(sb, normalized, detail);
    return c.json(normalized);
  } catch (e) {
    return gcaError(c, e);
  }
});

/** Green-center GPS — paid GCA tier; return graceful {available:false} on 403. */
coursesRouter.get('/:id/green-centers', async (c) => {
  const id = c.req.param('id');
  try {
    const sb = getSupabaseAdmin();
    const key = `gca:greens:${id}`;
    const data = await cached(sb, key, cacheTtl() * 4, () => gca.getGreenCenters(id));
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

async function persistCourseSnapshot(
  sb: ReturnType<typeof getSupabaseAdmin>,
  normalized: ReturnType<typeof gca.normalizeDetail>,
  raw: unknown,
) {
  if (!sb) return;
  try {
    const { data: course, error } = await sb
      .from('golf_courses')
      .upsert(
        {
          provider: normalized.provider,
          provider_id: normalized.providerId,
          name: normalized.name,
          club_name: normalized.clubName,
          address: normalized.address,
          city: normalized.city,
          state: normalized.state,
          country_iso2: normalized.country,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          hole_count: normalized.holeCount,
          payload: raw as Record<string, unknown>,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'provider,provider_id' },
      )
      .select('id')
      .single();
    if (error || !course) return;
    const courseId = course.id as string;

    // Refresh tee sets + holes wholesale (idempotent snapshot)
    await sb.from('course_tee_sets').delete().eq('course_id', courseId);
    for (const [i, tee] of normalized.teeSets.entries()) {
      const { data: teeRow } = await sb
        .from('course_tee_sets')
        .insert({
          course_id: courseId,
          name: tee.name,
          rating: tee.rating,
          slope: tee.slope,
          rating_women: tee.ratingWomen,
          slope_women: tee.slopeWomen,
          total_yards: tee.totalYards,
          sort_order: i,
        })
        .select('id')
        .single();
      if (!teeRow) continue;
      const rows = tee.holes.map((h) => ({
        tee_set_id: teeRow.id,
        hole_number: h.hole,
        yards: h.yards,
        par: h.par,
        handicap: h.handicap,
      }));
      if (rows.length) await sb.from('tee_set_holes').insert(rows);
    }
    // canonical course_holes from pars
    const holeRows = normalized.pars.map((par, i) => ({
      course_id: courseId,
      hole_number: i + 1,
      par,
      handicap_men: normalized.teeSets[0]?.holes.find((h) => h.hole === i + 1)?.handicap ?? null,
      handicap_women: normalized.teeSets[0]?.holes.find((h) => h.hole === i + 1)?.handicapWomen ?? null,
    }));
    if (holeRows.length) {
      await sb
        .from('course_holes')
        .upsert(holeRows, { onConflict: 'course_id,hole_number', ignoreDuplicates: false });
    }
  } catch {
    // snapshot persistence is best-effort
  }
}

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
