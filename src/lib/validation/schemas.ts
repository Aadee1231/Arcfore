import { z } from 'zod';

/** Shared contracts between app and API. Validated at runtime boundaries. */

export const courseSummarySchema = z.object({
  provider: z.enum(['gca', 'manual']),
  providerId: z.string(),
  name: z.string(),
  clubName: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  distanceKm: z.number().optional(),
});

export const teeHoleInfoSchema = z.object({
  hole: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yards: z.number().int().nullable(),
  handicap: z.number().int().nullable(),
  handicapWomen: z.number().int().nullable(),
});

export const teeSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number().nullable(),
  slope: z.number().nullable(),
  ratingWomen: z.number().nullable(),
  slopeWomen: z.number().nullable(),
  totalYards: z.number().nullable(),
  holes: z.array(teeHoleInfoSchema),
});

export const courseDetailSchema = courseSummarySchema.extend({
  address: z.string().nullable(),
  postalCode: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  holeCount: z.number().int(),
  pars: z.array(z.number().int()),
  teeSets: z.array(teeSetSchema),
  greenCentersAvailable: z.boolean(),
});

export const greenCentersSchema = z.object({
  available: z.boolean(),
  holes: z.array(
    z.object({ hole: z.number().int(), latitude: z.number(), longitude: z.number() }),
  ),
});

/** Gemini swing-analysis structured output (and stored row shape). */
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

export const coachRequestSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().min(1).max(2000),
});

export const coachResponseSchema = z.object({
  conversationId: z.string().uuid(),
  reply: z.string(),
  suggestedPrompts: z.array(z.string()).max(4),
});

export const recapResponseSchema = z.object({
  wentWell: z.array(z.string()),
  biggestOpportunity: z.string().nullable(),
  observations: z.array(z.string()),
  practiceFocus: z.string().nullable(),
  nextRoundGoal: z.string().nullable(),
});
export type RecapResponse = z.infer<typeof recapResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

/** Client-side form schemas. */
export const manualCourseSchema = z.object({
  name: z.string().min(2, 'Course name is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  pars: z.array(z.number().int().min(3).max(6)),
  teeName: z.string().optional(),
  yardages: z.array(z.number().int().positive().nullable()),
});

export const clubFormSchema = z.object({
  clubType: z.enum(['driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter', 'other']),
  name: z.string().min(1, 'Club name is required').max(40),
  brand: z.string().max(40).nullable(),
  model: z.string().max(60).nullable(),
  carryYards: z.number().int().min(0).max(400).nullable(),
  totalYards: z.number().int().min(0).max(400).nullable(),
  confidence: z.enum(['low', 'medium', 'high']).nullable(),
  notes: z.string().max(200).nullable(),
});
