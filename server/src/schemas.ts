import { z } from 'zod';

/**
 * Vendored copy of `swingAnalysisResultSchema` from
 * `../../src/lib/validation/schemas.ts` (app source of truth).
 * The server keeps its own copy so it can be deployed as a self-contained
 * Vercel project rooted at `server/` — keep the two in sync when the
 * swing-analysis contract changes.
 */

export const analysisObservationSchema = z.object({
  text: z.string(),
  timestamp: z.number().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
});

export const swingPhaseSchema = z.object({
  name: z.enum(['setup', 'backswing', 'transition', 'downswing', 'impact', 'follow_through']),
  timestampStart: z.number(),
  timestampEnd: z.number(),
});

export const swingAnalysisResultSchema = z.object({
  summary: z.string(),
  videoQuality: z.enum(['good', 'acceptable', 'poor', 'unusable']),
  perspective: z.enum(['face_on', 'down_the_line', 'unknown']),
  strengths: z.array(analysisObservationSchema).max(6),
  improvements: z.array(analysisObservationSchema).max(6),
  topPriority: z
    .object({ title: z.string(), explanation: z.string(), timestamp: z.number().nullable() })
    .nullable(),
  drill: z
    .object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      reps: z.string(),
      durationMinutes: z.number(),
    })
    .nullable(),
  phases: z.array(swingPhaseSchema),
  confidence: z.enum(['low', 'medium', 'high']),
  limitations: z.array(z.string()),
  recordingTip: z.string().nullable(),
});

export type SwingAnalysisResult = z.infer<typeof swingAnalysisResultSchema>;
