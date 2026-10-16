import { apiPost, apiUpload } from '@/lib/api/client';
import {
  coachResponseSchema,
  recapResponseSchema,
  swingAnalysisResultSchema,
  type RecapResponse,
  type SwingAnalysisResult,
} from '@/lib/validation/schemas';
import type { SwingCameraView } from '@/types/domain';

export interface SwingAnalysisAccepted {
  analysisId: string;
  videoId: string | null;
  result: SwingAnalysisResult;
}

/** Upload a swing video for Gemini analysis. Multipart; may take 30–120s. */
export async function analyzeSwingVideo(opts: {
  fileUri: string;
  fileName?: string;
  mimeType?: string;
  durationSeconds?: number;
  cameraView: SwingCameraView;
  clubType?: string;
}): Promise<SwingAnalysisAccepted> {
  const form = new FormData();
  const name = opts.fileName ?? `swing-${Date.now()}.mp4`;
  // React Native FormData file part
  form.append('video', {
    uri: opts.fileUri,
    name,
    type: opts.mimeType ?? 'video/mp4',
  } as unknown as Blob);
  form.append('cameraView', opts.cameraView);
  if (opts.clubType) form.append('clubType', opts.clubType);
  if (opts.durationSeconds) form.append('durationSeconds', String(opts.durationSeconds));

  const res = await apiUpload<unknown>('/v1/ai/swing-analyses', form);
  const wrapped = res as { analysisId: string; videoId: string | null; result: unknown };
  const parsed = swingAnalysisResultSchema.safeParse(wrapped.result);
  if (!parsed.success) throw new Error('Analysis response did not match the expected format');
  return { analysisId: wrapped.analysisId, videoId: wrapped.videoId, result: parsed.data };
}

export async function coachChat(
  message: string,
  conversationId: string | null,
): Promise<{ conversationId: string; reply: string; suggestedPrompts: string[] }> {
  const res = await apiPost<unknown>('/v1/ai/coach', { message, conversationId });
  const parsed = coachResponseSchema.safeParse(res);
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
