import { Hono } from 'hono';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { allowAiCall } from '../ratelimit.js';
import { analyzeSwing, coachReply, roundRecap } from '../gemini.js';
import { buildCoachContext } from '../context.js';
import { getSupabaseAdmin } from '../supabase.js';
import type { AuthContext } from '../auth.js';

export const aiRouter = new Hono<{ Variables: { auth: AuthContext } }>();

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

/**
 * POST /v1/ai/swing-analyses — multipart: video file + cameraView + clubType + durationSeconds.
 * Uploads to Gemini, runs structured analysis, stores video in Supabase Storage,
 * and persists the analysis row. Returns { analysisId, videoId, result }.
 */
aiRouter.post('/swing-analyses', async (c) => {
  const { userId } = c.get('auth');
  const sb = getSupabaseAdmin();

  if (!allowAiCall(userId, env.aiDailyLimitPerUser)) {
    return c.json(
      { error: 'rate_limited', message: 'Daily AI analysis limit reached — try again tomorrow' },
      429,
    );
  }
  if (!env.geminiApiKey) {
    return c.json({ error: 'not_configured', message: 'AI analysis is not configured on the server' }, 503);
  }

  const form = await c.req.formData();
  const video = form.get('video');
  if (!(video instanceof File)) {
    return c.json({ error: 'bad_request', message: 'video file is required' }, 400);
  }
  const cameraView = String(form.get('cameraView') ?? 'unknown');
  const clubType = form.get('clubType') ? String(form.get('clubType')) : undefined;
  const durationSeconds = Number(form.get('durationSeconds') ?? '0') || undefined;

  if (video.size > env.maxVideoBytes) {
    return c.json(
      { error: 'too_large', message: `Video exceeds the ${Math.round(env.maxVideoBytes / 1048576)}MB limit` },
      413,
    );
  }
  if (durationSeconds && durationSeconds > env.maxVideoSeconds) {
    return c.json(
      { error: 'too_long', message: `Keep swing videos under ${env.maxVideoSeconds} seconds` },
      413,
    );
  }
  const ext = (video.name.split('.').pop() ?? 'mp4').toLowerCase();
  const mimeType = VIDEO_MIME[ext] ?? video.type ?? 'video/mp4';
  if (!Object.values(VIDEO_MIME).includes(mimeType)) {
    return c.json({ error: 'bad_request', message: 'Unsupported video format — use MP4 or MOV' }, 415);
  }

  // Write to temp file for the Files API upload (deleted in finally)
  const tmpPath = join(tmpdir(), `arcfore-swing-${randomUUID()}.${ext}`);
  const analysisId = randomUUID();
  const videoId = randomUUID();
  let videoRowId: string | null = null;

  try {
    await mkdir(tmpdir(), { recursive: true });
    await writeFile(tmpPath, Buffer.from(await video.arrayBuffer()));

    // Create the DB rows up-front (status processing) so the app can poll/fail cleanly
    if (sb) {
      const storagePath = `${userId}/${videoId}.${ext}`;
      const buf = await video.arrayBuffer();
      const { error: upErr } = await sb.storage
        .from('swing-videos')
        .upload(storagePath, buf, { contentType: mimeType, upsert: false });
      if (!upErr) {
        const { data: vrow } = await sb
          .from('swing_videos')
          .insert({
            id: videoId,
            user_id: userId,
            storage_path: storagePath,
            duration_seconds: durationSeconds ?? null,
            camera_view: cameraView,
            club_type: clubType ?? null,
            size_bytes: video.size,
            status: 'processing',
          })
          .select('id')
          .single();
        videoRowId = vrow?.id ?? null;
        await sb.from('swing_analyses').insert({
          id: analysisId,
          user_id: userId,
          video_id: videoRowId,
          status: 'processing',
          model: env.geminiModel,
        });
      }
    }

    const result = await analyzeSwing({
      filePath: tmpPath,
      mimeType,
      cameraView,
      clubType,
      durationSeconds,
    });

    if (sb) {
      await sb
        .from('swing_analyses')
        .update({
          status: 'completed',
          summary: result.summary,
          video_quality: result.videoQuality,
          perspective: result.perspective,
          strengths: result.strengths,
          improvements: result.improvements,
          top_priority: result.topPriority,
          drill: result.drill,
          phases: result.phases,
          confidence: result.confidence,
          limitations: result.limitations,
          recording_tip: result.recordingTip,
          raw: result as unknown as Record<string, unknown>,
        })
        .eq('id', analysisId);
      if (videoRowId) {
        await sb.from('swing_videos').update({ status: 'analyzed' }).eq('id', videoRowId);
      }
      // Feed the "One Thing" engine
      if (result.topPriority && result.videoQuality !== 'unusable') {
        await sb.from('one_thing_recommendations').insert({
          user_id: userId,
          focus: result.topPriority.title,
          explanation: result.topPriority.explanation,
          drill_name: result.drill?.name ?? null,
          source: 'analysis',
        });
      }
    }

    return c.json({ analysisId, videoId: videoRowId, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    if (sb) {
      await sb
        .from('swing_analyses')
        .update({ status: 'failed', error: message })
        .eq('id', analysisId);
      if (videoRowId) {
        await sb.from('swing_videos').update({ status: 'failed' }).eq('id', videoRowId);
      }
    }
    const status = message.includes('Gemini is not configured') ? 503 : 502;
    return c.json({ error: 'analysis_failed', message }, status);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
});

/** POST /v1/ai/coach — { conversationId?, message } → contextual reply. */
aiRouter.post('/coach', async (c) => {
  const { userId } = c.get('auth');
  if (!allowAiCall(userId, env.aiDailyLimitPerUser * 3)) {
    return c.json({ error: 'rate_limited', message: 'Daily coach limit reached' }, 429);
  }
  if (!env.geminiApiKey) {
    return c.json({ error: 'not_configured', message: 'AI coach is not configured on the server' }, 503);
  }
  const sb = getSupabaseAdmin();
  const body = await c.req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 2000) {
    return c.json({ error: 'bad_request', message: 'message (1–2000 chars) is required' }, 400);
  }

  const context = sb
    ? await buildCoachContext(sb, userId)
    : {
        profileSummary: 'Profile unavailable (no database).',
        bagSummary: 'Unavailable.',
        roundsSummary: 'Unavailable.',
        analysesSummary: 'Unavailable.',
        practiceSummary: 'Unavailable.',
      };

  let conversationId: string | null = body?.conversationId ?? null;
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sb) {
    if (!conversationId) {
      const { data: conv } = await sb
        .from('coach_conversations')
        .insert({ user_id: userId, title: message.slice(0, 60) })
        .select('id')
        .single();
      conversationId = conv?.id ?? null;
    } else {
      // verify ownership
      const { data: conv } = await sb
        .from('coach_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!conv) return c.json({ error: 'not_found', message: 'Conversation not found' }, 404);
      const { data: msgs } = await sb
        .from('coach_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);
      history = (msgs ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    }
  }

  try {
    const { reply, suggestedPrompts } = await coachReply({ context, history, message });
    if (sb && conversationId) {
      await sb.from('coach_messages').insert([
        { conversation_id: conversationId, role: 'user', content: message },
        { conversation_id: conversationId, role: 'assistant', content: reply },
      ]);
    }
    return c.json({ conversationId, reply, suggestedPrompts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Coach request failed';
    return c.json({ error: 'coach_failed', message: msg }, 502);
  }
});

/** POST /v1/ai/recap — post-round recap from recorded stats. */
aiRouter.post('/recap', async (c) => {
  const { userId } = c.get('auth');
  if (!allowAiCall(userId, env.aiDailyLimitPerUser)) {
    return c.json({ error: 'rate_limited', message: 'Daily AI limit reached' }, 429);
  }
  if (!env.geminiApiKey) {
    return c.json({ error: 'not_configured', message: 'AI recap is not configured' }, 503);
  }
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
