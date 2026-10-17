import { apiPost, apiUpload } from '@/lib/api/client';
import {
    coachResponseSchema,
    recapResponseSchema,
    swingAnalysisResultSchema,
    type RecapResponse,
    type SwingAnalysisResult,
} from '@/lib/validation/schemas';
import type { SwingCameraView } from '@/types/domain';
import { z } from 'zod';

export interface SwingFrameUpload {
  /** local file:// uri of the extracted frame image */
  uri: string;
  /** seconds into the source video this frame was captured at */
  timestampSec: number;
}

const swingResponseSchema = z.object({
  result: swingAnalysisResultSchema,
  model: z.string(),
});

/**
 * Upload extracted swing frames for vision analysis.
 * The video itself never leaves the device — only sampled JPEG frames with
 * their timestamps. The server is stateless; the app persists the result.
 */
export async function analyzeSwingFrames(opts: {
  frames: SwingFrameUpload[];
  cameraView: SwingCameraView;
  clubType?: string;
  durationSeconds?: number;
}): Promise<{ result: SwingAnalysisResult; model: string }> {
  const form = new FormData();
  opts.frames.forEach((f, i) => {
    form.append('frames', {
      uri: f.uri,
      name: `frame-${i}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });
  form.append(
    'timestamps',
    JSON.stringify(opts.frames.map((f) => f.timestampSec)),
  );
  form.append('cameraView', opts.cameraView);
  if (opts.clubType) form.append('clubType', opts.clubType);
  if (opts.durationSeconds) form.append('durationSeconds', String(opts.durationSeconds));

  const res = await apiUpload<unknown>('/v1/ai/swing-analyses', form);
  const parsed = swingResponseSchema.safeParse(res);
  if (!parsed.success) throw new Error('Analysis response did not match the expected format');
  return parsed.data;
}

export interface CoachContextBlock {
  profileSummary: string;
  bagSummary: string;
  roundsSummary: string;
  analysesSummary: string;
  practiceSummary: string;
}

const coachReplySchema = coachResponseSchema;

/** Conversational coach. Context + recent history are sent from the local DB;
 * the server stays stateless. */
export async function coachChat(
  message: string,
  context: CoachContextBlock,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ reply: string; suggestedPrompts: string[] }> {
  const res = await apiPost<unknown>('/v1/ai/coach', { message, context, history });
  const parsed = coachReplySchema.safeParse(res);
  if (!parsed.success) throw new Error('Unexpected coach response');
  return parsed.data;
}

export interface RecapInput {
  courseName: string;
  holesPlanned: number;
  toPar: number;
  totalStrokes: number;
  putts: number | null;
  girPct: number | null;
  fairwayPct: number | null;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  worstHoles: { hole: number; scoreName: string }[];
  bestHoles: { hole: number; scoreName: string }[];
  skillLevel: string;
}

/** AI post-round recap — only real recorded stats go in. */
export async function generateRecap(input: RecapInput): Promise<RecapResponse> {
  const res = await apiPost<unknown>('/v1/ai/recap', input);
  const parsed = recapResponseSchema.safeParse(res);
  if (!parsed.success) throw new Error('Unexpected recap response');
  return parsed.data;
}
