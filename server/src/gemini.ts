import { GoogleGenAI, MediaResolution, Type } from '@google/genai';
import { env } from './env.js';
import { swingAnalysisResultSchema, type SwingAnalysisResult } from '../../src/lib/validation/schemas.js';

/**
 * Gemini integration — video understanding for swing analysis + coach chat.
 * Docs: https://ai.google.dev/gemini-api/docs/video-understanding
 */

let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!env.geminiApiKey) {
    throw new Error('Gemini is not configured (missing GEMINI_API_KEY)');
  }
  ai ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return ai;
}

/** JSON schema for structured swing analysis — mirrors swingAnalysisResultSchema. */
const SWING_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    videoQuality: { type: Type.STRING, enum: ['good', 'acceptable', 'poor', 'unusable'] },
    perspective: { type: Type.STRING, enum: ['face_on', 'down_the_line', 'unknown'] },
    strengths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          timestamp: { type: Type.NUMBER, nullable: true },
          confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
        },
        required: ['text', 'timestamp', 'confidence'],
      },
    },
    improvements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          timestamp: { type: Type.NUMBER, nullable: true },
          confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
        },
        required: ['text', 'timestamp', 'confidence'],
      },
    },
    topPriority: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        title: { type: Type.STRING },
        explanation: { type: Type.STRING },
        timestamp: { type: Type.NUMBER, nullable: true },
      },
      required: ['title', 'explanation', 'timestamp'],
    },
    drill: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
        reps: { type: Type.STRING },
        durationMinutes: { type: Type.NUMBER },
      },
      required: ['name', 'description', 'steps', 'reps', 'durationMinutes'],
    },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            enum: ['setup', 'backswing', 'transition', 'downswing', 'impact', 'follow_through'],
          },
          timestampStart: { type: Type.NUMBER },
          timestampEnd: { type: Type.NUMBER },
        },
        required: ['name', 'timestampStart', 'timestampEnd'],
      },
    },
    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
    recordingTip: { type: Type.STRING, nullable: true },
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
};

const SWING_ANALYSIS_PROMPT = `You are an expert golf instructor analyzing a swing video recorded on a phone.
Analyze ONLY what is actually observable in the footage. Rules:

- Describe observed facts; mark interpretations with lower confidence.
- Never invent clubhead speed, ball speed, launch angle, spin rate, clubface angle, or any number that cannot be measured from an ordinary phone video.
- Identify swing phases (setup, backswing, transition, downswing, impact, follow-through) with timestamps in seconds when they are visible.
- If the video does not clearly show a golfer swinging (too dark, cropped, wrong subject, too short, missing the ball/club), set videoQuality to "unusable", return an actionable recordingTip, and leave strengths/improvements mostly empty — do NOT pretend analysis succeeded.
- Evaluate observable items only: setup posture, stance width/balance, spine angle, head stability, hip and shoulder rotation, weight shift, sequencing, tempo rhythm, follow-through balance, alignment clues.
- Give exactly ONE topPriority: the single most impactful fix.
- Suggest ONE practical drill with concrete steps and reps doable at a range or home.
- Timestamps must reference real moments in the video (seconds, numeric).
- Be direct and encouraging but honest; no filler praise.`;

export interface SwingAnalysisOptions {
  fileUri?: string; // for inline small videos — not used when uploading via Files API
  filePath?: string; // local temp path on server
  mimeType: string;
  cameraView: string;
  clubType?: string;
  durationSeconds?: number;
}

export async function analyzeSwing(opts: SwingAnalysisOptions): Promise<SwingAnalysisResult> {
  const genai = client();

  const meta: string[] = [];
  if (opts.cameraView && opts.cameraView !== 'unknown') {
    meta.push(`Camera view reported by golfer: ${opts.cameraView}`);
  }
  if (opts.clubType) meta.push(`Club used: ${opts.clubType}`);
  if (opts.durationSeconds) meta.push(`Video length: about ${opts.durationSeconds}s`);

  let filePart: { fileData: { fileUri: string; mimeType: string } };
  let uploadedName: string | null = null;
  if (opts.filePath) {
    const upload = await genai.files.upload({
      file: opts.filePath,
      config: { mimeType: opts.mimeType },
    });
    uploadedName = upload.name ?? null;
    if (!upload.uri) throw new Error('Gemini file upload failed');
    filePart = { fileData: { fileUri: upload.uri, mimeType: opts.mimeType } };
    // Wait for processing when state is provided
    if (upload.name && upload.state === 'PROCESSING') {
      const deadline = Date.now() + 60000;
      let f = upload;
      while (f.state === 'PROCESSING' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        f = await genai.files.get({ name: upload.name });
      }
    }
  } else if (opts.fileUri) {
    filePart = { fileData: { fileUri: opts.fileUri, mimeType: opts.mimeType } };
  } else {
    throw new Error('No video provided');
  }

  try {
    const response = await genai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            filePart,
            {
              text: `${SWING_ANALYSIS_PROMPT}\n\n${meta.join('\n')}\n\nReturn the analysis as JSON matching the schema.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SWING_ANALYSIS_SCHEMA,
        temperature: 0.4,
        // Higher frame sampling for fast swing motion
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty analysis response');
    const parsed = swingAnalysisResultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`Analysis did not match schema: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
    }
    return parsed.data;
  } finally {
    if (uploadedName) {
      genai.files.delete({ name: uploadedName }).catch(() => {});
    }
  }
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
  const genai = client();

  const contextText = [
    `GOLFER PROFILE:\n${opts.context.profileSummary}`,
    `CLUB BAG (recorded carry/total distances):\n${opts.context.bagSummary}`,
    `RECENT ROUNDS:\n${opts.context.roundsSummary}`,
    `SWING ANALYSES:\n${opts.context.analysesSummary}`,
    `PRACTICE:\n${opts.context.practiceSummary}`,
  ].join('\n\n');

  const contents = [
    ...opts.history.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: opts.message }] },
  ];

  const response = await genai.models.generateContent({
    model: env.geminiCoachModel,
    contents,
    config: {
      systemInstruction: `${COACH_SYSTEM}\n\nCONTEXT:\n${contextText}`,
      temperature: 0.6,
      maxOutputTokens: 800,
    },
  });
  const reply = response.text?.trim() || 'I could not generate a response — try rephrasing.';

  const prompts = await genai.models.generateContent({
    model: env.geminiCoachModel,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Given this golf coaching exchange, suggest exactly 3 short follow-up questions the golfer might ask next (one per line, no numbering, max 12 words each).\n\nCoach: ${reply}\nGolfer asked: ${opts.message}`,
          },
        ],
      },
    ],
    config: { temperature: 0.7, maxOutputTokens: 120 },
  });
  const suggestedPrompts = (prompts.text ?? '')
    .split('\n')
    .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter((s) => s.length > 3 && s.length < 90)
    .slice(0, 3);

  return { reply, suggestedPrompts };
}

// ---------------- Post-round recap ----------------

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
  const genai = client();
  const schema = {
    type: Type.OBJECT,
    properties: {
      wentWell: { type: Type.ARRAY, items: { type: Type.STRING } },
      biggestOpportunity: { type: Type.STRING, nullable: true },
      observations: { type: Type.ARRAY, items: { type: Type.STRING } },
      practiceFocus: { type: Type.STRING, nullable: true },
      nextRoundGoal: { type: Type.STRING, nullable: true },
    },
    required: ['wentWell', 'biggestOpportunity', 'observations', 'practiceFocus', 'nextRoundGoal'],
  };
  const response = await genai.models.generateContent({
    model: env.geminiCoachModel,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Write a concise post-round recap for a ${input.skillLevel} golfer. Use ONLY these recorded stats — do not infer reasons that were not tracked. Be specific and constructive, under 140 words total.\n\n${JSON.stringify(input, null, 1)}`,
          },
        ],
      },
    ],
    config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.5 },
  });
  const text = response.text;
  if (!text) throw new Error('Empty recap');
  return JSON.parse(text);
}
