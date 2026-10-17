import { Hono } from 'hono';
import type { AuthContext } from '../auth.js';
import { env } from '../env.js';
import { analyzeSwingFrames, coachReply, roundRecap, type SwingFrameInput } from '../openai.js';
import { checkAiBudget } from '../ratelimit.js';

export const aiRouter = new Hono<{ Variables: { auth: AuthContext } }>();

const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Shared guard for AI endpoints: optional auth requirement, then daily-budget
 * accounting (persistent in prod via Upstash; blocked if unprotected), then
 * OpenAI configuration. Returns an error Response or null when the call may
 * proceed.
 */
async function aiGate(
  c: { get: (key: 'auth') => AuthContext; json: (body: unknown, status?: number) => Response },
  clientLimit: number,
  limitMessage: string,
  notConfiguredMessage: string,
): Promise<Response | null> {
  const { clientId, clientIp } = c.get('auth');

  if (env.aiRequireAuth && !clientId.startsWith('clerk:')) {
    return c.json({ error: 'unauthorized', message: 'Sign-in is required for AI features' }, 401);
  }

  const budget = await checkAiBudget({ clientId, clientIp, clientLimit });
  if (!budget.allowed) {
    if (budget.reason === 'protection_not_configured') {
      return c.json(
        {
          error: 'protection_not_configured',
          message: 'AI features are temporarily unavailable',
        },
        503,
      );
    }
    return c.json({ error: 'rate_limited', message: limitMessage }, 429);
  }

  if (!env.openaiApiKey) {
    return c.json({ error: 'not_configured', message: notConfiguredMessage }, 503);
  }
  return null;
}

/**
 * POST /v1/ai/swing-analyses
 * Multipart: `frames` (1..N image parts), `timestamps` (JSON number[] of seconds,
 * same order as frames), `cameraView`, `clubType`, `durationSeconds`.
 * The device extracts frames locally — the video itself never leaves the phone.
 * Stateless: the structured result is returned to the app, which persists it
 * in its local database.
 */
aiRouter.post('/swing-analyses', async (c) => {
  const gate = await aiGate(
    c,
    env.aiDailyLimitPerClient,
    'Daily AI analysis limit reached — try again tomorrow',
    'AI analysis is not configured on the server',
  );
  if (gate) return gate;

  const form = await c.req.formData();
  const frameFiles = form.getAll('frames').filter((f): f is File => f instanceof File);
  if (frameFiles.length === 0) {
    return c.json({ error: 'bad_request', message: 'at least one frame image is required' }, 400);
  }
  if (frameFiles.length > env.maxFrameCount) {
    return c.json(
      { error: 'bad_request', message: `too many frames (max ${env.maxFrameCount})` },
      400,
    );
  }

  let timestamps: number[] = [];
  try {
    const raw = JSON.parse(String(form.get('timestamps') ?? '[]'));
    if (Array.isArray(raw)) timestamps = raw.map((n) => Number(n)).filter(Number.isFinite);
  } catch {
    return c.json({ error: 'bad_request', message: 'timestamps must be a JSON number array' }, 400);
  }
  while (timestamps.length < frameFiles.length) timestamps.push(0);

  const cameraView = String(form.get('cameraView') ?? 'unknown');
  const clubType = form.get('clubType') ? String(form.get('clubType')) : undefined;
  const durationSeconds = Number(form.get('durationSeconds') ?? '0') || undefined;

  const frames: SwingFrameInput[] = [];
  for (let i = 0; i < frameFiles.length; i++) {
    const f = frameFiles[i];
    if (f.size > env.maxFrameBytes) {
      return c.json({ error: 'too_large', message: 'frame exceeds the size limit' }, 413);
    }
    const mimeType = IMAGE_MIME.has(f.type) ? f.type : 'image/jpeg';
    const buf = Buffer.from(await f.arrayBuffer());
    frames.push({
      base64: buf.toString('base64'),
      mimeType,
      timestampSec: Math.max(0, timestamps[i] ?? 0),
    });
  }

  try {
    const result = await analyzeSwingFrames({
      frames,
      cameraView,
      clubType,
      durationSeconds,
    });
    return c.json({ result, model: env.openaiVisionModel });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    const status = message.includes('not configured') ? 503 : 502;
    return c.json({ error: 'analysis_failed', message }, status);
  }
});

/** POST /v1/ai/coach — { message, context, history } → contextual reply. Stateless. */
aiRouter.post('/coach', async (c) => {
  const gate = await aiGate(
    c,
    env.aiDailyLimitPerClient * 3,
    'Daily coach limit reached',
    'AI coach is not configured on the server',
  );
  if (gate) return gate;

  const body = await c.req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 2000) {
    return c.json({ error: 'bad_request', message: 'message (1–2000 chars) is required' }, 400);
  }

  const rawCtx = body?.context ?? {};
  const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const context = {
    profileSummary: str(rawCtx.profileSummary),
    bagSummary: str(rawCtx.bagSummary),
    roundsSummary: str(rawCtx.roundsSummary, 6000),
    analysesSummary: str(rawCtx.analysesSummary, 6000),
    practiceSummary: str(rawCtx.practiceSummary),
  };
  const history = Array.isArray(body?.history)
    ? body.history
        .filter(
          (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
            typeof m === 'object' &&
            m != null &&
            ((m as { role?: string }).role === 'user' ||
              (m as { role?: string }).role === 'assistant') &&
            typeof (m as { content?: unknown }).content === 'string',
        )
        .slice(-12)
        .map((m: { role: 'user' | 'assistant'; content: string }) => ({
          role: m.role,
          content: m.content.slice(0, 2000),
        }))
    : [];

  try {
    const { reply, suggestedPrompts } = await coachReply({ context, history, message });
    return c.json({ reply, suggestedPrompts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Coach request failed';
    return c.json({ error: 'coach_failed', message: msg }, 502);
  }
});

/** POST /v1/ai/recap — post-round recap from recorded stats. */
aiRouter.post('/recap', async (c) => {
  const gate = await aiGate(
    c,
    env.aiDailyLimitPerClient,
    'Daily AI limit reached',
    'AI recap is not configured',
  );
  if (gate) return gate;
  const input = await c.req.json().catch(() => null);
  if (!input || typeof input.courseName !== 'string') {
    return c.json({ error: 'bad_request', message: 'Invalid recap payload' }, 400);
  }
  try {
    const recap = await roundRecap(input);
    return c.json(recap);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Recap failed';
    return c.json({ error: 'recap_failed', message: msg }, 502);
  }
});
