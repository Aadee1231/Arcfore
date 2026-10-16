import { describe, expect, it } from 'vitest';
import { coachResponseSchema, greenCentersSchema, manualCourseSchema, recapResponseSchema, swingAnalysisResultSchema } from '@/lib/validation/schemas';

const validAnalysis = {
  summary: 'Solid takeaway but early extension visible at impact.',
  videoQuality: 'acceptable',
  perspective: 'down_the_line',
  strengths: [{ text: 'Athletic setup posture', timestamp: 0.4, confidence: 'medium' }],
  improvements: [{ text: 'Hips thrust toward the ball at impact', timestamp: 2.1, confidence: 'low' }],
  topPriority: { title: 'Early extension', explanation: 'Maintain hip depth through impact.', timestamp: 2.1 },
  drill: {
    name: 'Chair drill',
    description: 'Keep glutes on a chair behind you through the swing.',
    steps: ['Place chair behind hips', 'Rehearse slow swings'],
    reps: '3×10',
    durationMinutes: 10,
  },
  phases: [{ name: 'impact', timestampStart: 2.0, timestampEnd: 2.3 }],
  confidence: 'medium',
  limitations: ['Single camera angle', 'No launch data'],
  recordingTip: null,
};

describe('swingAnalysisResultSchema', () => {
  it('accepts a well-formed Gemini analysis payload', () => {
    expect(swingAnalysisResultSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it('rejects fabricated precision: videoQuality outside enum', () => {
    const bad = { ...validAnalysis, videoQuality: 'perfect' };
    expect(swingAnalysisResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing topPriority shape', () => {
    const bad = { ...validAnalysis, topPriority: { title: 'x' } };
    expect(swingAnalysisResultSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an unusable-video response with a recording tip', () => {
    const unusable = {
      ...validAnalysis,
      videoQuality: 'unusable',
      strengths: [],
      improvements: [],
      topPriority: null,
      drill: null,
      phases: [],
      recordingTip: 'Record from down-the-line with the full body in frame.',
    };
    const r = swingAnalysisResultSchema.safeParse(unusable);
    expect(r.success).toBe(true);
  });
});

describe('greenCentersSchema — free tier 403 shape', () => {
  it('accepts unavailable response', () => {
    expect(greenCentersSchema.safeParse({ available: false, holes: [] }).success).toBe(true);
  });
  it('accepts hole centers when available', () => {
    expect(
      greenCentersSchema.safeParse({ available: true, holes: [{ hole: 1, latitude: 35.0, longitude: -78.5 }] }).success,
    ).toBe(true);
  });
});

describe('coachResponseSchema', () => {
  it('validates coach reply', () => {
    const r = coachResponseSchema.safeParse({
      conversationId: '5e8403e2-9f3b-4a1c-8c5a-2d9f1b7e6a40',
      reply: 'Your 7-iron carry is ~145yd; for 142 that is the right club.',
      suggestedPrompts: ['Why do I slice?'],
    });
    expect(r.success).toBe(true);
  });
});

describe('recapResponseSchema', () => {
  it('validates a post-round recap', () => {
    const r = recapResponseSchema.safeParse({
      wentWell: ['Strong putting inside 10 feet'],
      biggestOpportunity: 'Approach shots from 150+',
      observations: ['Two three-putts on par 3s'],
      practiceFocus: 'Ladder putting drill',
      nextRoundGoal: 'No more than 32 putts',
    });
    expect(r.success).toBe(true);
  });
});

describe('manualCourseSchema', () => {
  it('requires name and per-hole pars', () => {
    const ok = manualCourseSchema.safeParse({
      name: 'My Home Course',
      holeCount: 18,
      pars: Array.from({ length: 18 }, () => 4),
      yardages: Array.from({ length: 18 }, () => 400),
    });
    expect(ok.success).toBe(true);
    const bad = manualCourseSchema.safeParse({ name: '', holeCount: 18, pars: [], yardages: [] });
    expect(bad.success).toBe(false);
  });
});
