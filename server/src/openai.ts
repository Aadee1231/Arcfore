import OpenAI from 'openai';
import { env } from './env.js';
import { swingAnalysisResultSchema, type SwingAnalysisResult } from './schemas.js';

/**
 * OpenAI integration — vision-based swing analysis (frame extraction happens
 * on the device; the API receives sampled frames + timestamps, never a video
 * file), conversational coach, and post-round recaps.
 * Docs: https://developers.openai.com/api/docs/guides/images-vision
 */

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!env.openaiApiKey) {
    throw new Error('OpenAI is not configured (missing OPENAI_API_KEY)');
  }
  client ??= new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

/** JSON Schema for structured swing analysis — mirrors swingAnalysisResultSchema. */
const SWING_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    videoQuality: { type: 'string', enum: ['good', 'acceptable', 'poor', 'unusable'] },
    perspective: { type: 'string', enum: ['face_on', 'down_the_line', 'unknown'] },
    strengths: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          timestamp: { type: ['number', 'null'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['text', 'timestamp', 'confidence'],
      },
    },
    improvements: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          timestamp: { type: ['number', 'null'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['text', 'timestamp', 'confidence'],
      },
    },
    topPriority: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        explanation: { type: 'string' },
        timestamp: { type: ['number', 'null'] },
      },
      required: ['title', 'explanation', 'timestamp'],
    },
    drill: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
        reps: { type: 'string' },
        durationMinutes: { type: 'number' },
      },
      required: ['name', 'description', 'steps', 'reps', 'durationMinutes'],
    },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            enum: ['setup', 'backswing', 'transition', 'downswing', 'impact', 'follow_through'],
          },
          timestampStart: { type: 'number' },
          timestampEnd: { type: 'number' },
        },
        required: ['name', 'timestampStart', 'timestampEnd'],
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    limitations: { type: 'array', items: { type: 'string' } },
    recordingTip: { type: ['string', 'null'] },
  },
  required: [
    'summary',
    'videoQuality',
    'perspective',
    'strengths',
    'improvements',
    'topPriority',
    'drill',
    'phases',
    'confidence',
    'limitations',
    'recordingTip',
  ],
} as const;

const SWING_ANALYSIS_PROMPT = `You are an expert golf instructor analyzing a swing recorded on a phone.
The golfer did NOT upload a video — the app extracted still frames from their swing video and you are looking at those frames in order. Each frame is labelled with the timestamp (in seconds) it was captured at inside the source video.

Analyze ONLY what is actually observable in the frames. Rules:

- Describe observed facts; mark interpretations with lower confidence.
- Never invent clubhead speed, ball speed, launch angle, spin rate, clubface angle, or any number that cannot be measured from phone-camera frames.
- Identify swing phases (setup, backswing, transition, downswing, impact, follow-through) with timestamp ranges in seconds, based on the frames you can see. Timestamps must fall within the sampled frame times.
- If the frames do not clearly show a golfer swinging (too dark, cropped, wrong subject, too few frames, missing the ball/club), set videoQuality to "unusable", return an actionable recordingTip, and leave strengths/improvements mostly empty — do NOT pretend analysis succeeded.
- Evaluate observable items only: setup posture, stance width/balance, spine angle, head stability, hip and shoulder rotation, weight shift, sequencing, tempo clues, follow-through balance, alignment clues.
- Give exactly ONE topPriority: the single most impactful fix.
- Suggest ONE practical drill with concrete steps and reps doable at a range or home.
- Be direct and encouraging but honest; no filler praise.`;

export interface SwingFrameInput {
  /** base64-encoded JPEG/PNG (no data-url prefix). */
  base64: string;
  mimeType: string;
  /** seconds into the source video this frame was captured at. */
  timestampSec: number;
}

export async function analyzeSwingFrames(opts: {
  frames: SwingFrameInput[];
  cameraView: string;
  clubType?: string;
  durationSeconds?: number;
}): Promise<SwingAnalysisResult> {
  const ai = openai();

  const meta: string[] = [];
  if (opts.cameraView && opts.cameraView !== 'unknown') {
    meta.push(`Camera view reported by golfer: ${opts.cameraView}`);
  }
  if (opts.clubType) meta.push(`Club used: ${opts.clubType}`);
  if (opts.durationSeconds) meta.push(`Video length: about ${opts.durationSeconds}s`);

  const frameParts = opts.frames.flatMap((f) => [
    {
      type: 'input_text' as const,
      text: `Frame captured at ${f.timestampSec.toFixed(2)}s:`,
    },
    {
      type: 'input_image' as const,
      image_url: `data:${f.mimeType};base64,${f.base64}`,
      detail: 'high' as const,
    },
  ]);

  const response = await ai.responses.create({
    model: env.openaiVisionModel,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${SWING_ANALYSIS_PROMPT}\n\n${meta.join('\n')}\n\nThe frames follow, in chronological order.`,
          },
          ...frameParts,
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'swing_analysis',
        strict: true,
        schema: SWING_ANALYSIS_JSON_SCHEMA,
      },
    },
  });

  const text = response.output_text;
  if (!text) throw new Error('Empty analysis response');
  const parsed = swingAnalysisResultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`Analysis did not match schema: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  return parsed.data;
}

// ---------------- Coach chat ----------------

export interface CoachContextBlock {
  profileSummary: string;
  bagSummary: string;
  roundsSummary: string;
  analysesSummary: string;
  practiceSummary: string;
}

const COACH_SYSTEM = `You are Arcfore's AI golf coach — knowledgeable, approachable, and direct.

Rules:
- Answer with ONE or TWO actionable suggestions, not walls of text.
- Only reference the golfer's data that is actually provided in the context below. Never claim to have seen a video, round, or stat that is not in the context.
- If asked for a club recommendation, use their recorded carry distances when present; say when data is missing instead of assuming tour distances.
- If asked about a swing analysis, reference only the analysis results in context.
- Plain conversational text (no markdown headers); keep answers under ~120 words unless a practice plan is requested.
- Never fabricate measurements (clubhead speed, launch angle) the app cannot see.`;

export async function coachReply(opts: {
  context: CoachContextBlock;
  history: { role: 'user' | 'assistant'; content: string }[];
  message: string;
}): Promise<{ reply: string; suggestedPrompts: string[] }> {
  const ai = openai();

  const contextText = [
    `GOLFER PROFILE:\n${opts.context.profileSummary}`,
    `CLUB BAG (recorded carry/total distances):\n${opts.context.bagSummary}`,
    `RECENT ROUNDS:\n${opts.context.roundsSummary}`,
    `SWING ANALYSES:\n${opts.context.analysesSummary}`,
    `PRACTICE:\n${opts.context.practiceSummary}`,
  ].join('\n\n');

  const history = opts.history.slice(-12).map((m) => ({
    role: m.role,
    content: [{ type: (m.role === 'user' ? 'input_text' : 'output_text') as 'input_text', text: m.content }],
  }));

  const response = await ai.responses.create({
    model: env.openaiCoachModel,
    instructions: `${COACH_SYSTEM}\n\nCONTEXT:\n${contextText}`,
    input: [
      ...history.map((m) => ({
        role: m.role,
        content: m.content.map((c) => ({ type: c.type, text: c.text })),
      })),
      { role: 'user' as const, content: [{ type: 'input_text' as const, text: opts.message }] },
    ],
    max_output_tokens: 900,
  });
  const reply = response.output_text?.trim() || 'I could not generate a response — try rephrasing.';

  const prompts = await ai.responses.create({
    model: env.openaiCoachModel,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Given this golf coaching exchange, suggest exactly 3 short follow-up questions the golfer might ask next (one per line, no numbering, max 12 words each).\n\nCoach: ${reply}\nGolfer asked: ${opts.message}`,
          },
        ],
      },
    ],
    max_output_tokens: 160,
  });
  const suggestedPrompts = (prompts.output_text ?? '')
    .split('\n')
    .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter((s) => s.length > 3 && s.length < 90)
    .slice(0, 3);

  return { reply, suggestedPrompts };
}

// ---------------- Post-round recap ----------------

const RECAP_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wentWell: { type: 'array', items: { type: 'string' } },
    biggestOpportunity: { type: ['string', 'null'] },
    observations: { type: 'array', items: { type: 'string' } },
    practiceFocus: { type: ['string', 'null'] },
    nextRoundGoal: { type: ['string', 'null'] },
  },
  required: ['wentWell', 'biggestOpportunity', 'observations', 'practiceFocus', 'nextRoundGoal'],
} as const;

export async function roundRecap(input: {
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
}): Promise<{
  wentWell: string[];
  biggestOpportunity: string | null;
  observations: string[];
  practiceFocus: string | null;
  nextRoundGoal: string | null;
}> {
  const ai = openai();
  const response = await ai.responses.create({
    model: env.openaiCoachModel,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Write a concise post-round recap for a ${input.skillLevel} golfer. Use ONLY these recorded stats — do not infer reasons that were not tracked. Be specific and constructive, under 140 words total.\n\n${JSON.stringify(input, null, 1)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'round_recap',
        strict: true,
        schema: RECAP_JSON_SCHEMA,
      },
    },
  });
  const text = response.output_text;
  if (!text) throw new Error('Empty recap');
  return JSON.parse(text);
}
