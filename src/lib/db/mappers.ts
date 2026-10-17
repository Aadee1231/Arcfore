import type {
  CoachConversation,
  CoachMessage,
  HoleScore,
  OneThingRecommendation,
  PracticeDrill,
  PracticeSession,
  Profile,
  Round,
  RoundParticipant,
  SwingAnalysis,
  SwingVideo,
  UserClub,
} from '@/types/domain';

/** Pure row ↔ domain mappers. Rows are untyped sqlite results; keep these
 * side-effect free so they're unit-testable in vitest. */

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const bool = (v: unknown): boolean => v === 1 || v === true;
const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== 'string' || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

// ---------- profile ----------

export function rowToProfile(row: Row): Profile {
  return {
    id: str(row.id),
    displayName: str(row.display_name, 'Golfer'),
    handedness: row.handedness === 'left' ? 'left' : 'right',
    skillLevel: (str(row.skill_level, 'intermediate') as Profile['skillLevel']),
    primaryGoal: str(row.primary_goal),
    units: row.units === 'meters' ? 'meters' : 'yards',
    typicalScore: numOrNull(row.typical_score),
    avatarUrl: strOrNull(row.avatar_url),
    onboardedAt: strOrNull(row.onboarded_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

// ---------- clubs ----------

export function rowToClub(row: Row): UserClub {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    clubType: str(row.club_type, 'other') as UserClub['clubType'],
    name: str(row.name),
    brand: strOrNull(row.brand),
    model: strOrNull(row.model),
    carryYards: numOrNull(row.carry_yards),
    totalYards: numOrNull(row.total_yards),
    confidence: strOrNull(row.confidence) as UserClub['confidence'],
    notes: strOrNull(row.notes),
    sortOrder: num(row.sort_order),
  };
}

// ---------- rounds ----------

export function rowToParticipant(row: Row): RoundParticipant {
  return {
    id: str(row.id),
    userId: strOrNull(row.user_id),
    displayName: str(row.display_name),
    isGuest: bool(row.is_guest),
    sortOrder: num(row.sort_order),
    teeLabel: strOrNull(row.tee_label),
  };
}

export function rowToHoleScore(row: Row): HoleScore {
  return {
    participantId: str(row.participant_id),
    holeNumber: num(row.hole_number),
    strokes: numOrNull(row.strokes),
    putts: numOrNull(row.putts),
    fairway: strOrNull(row.fairway) as HoleScore['fairway'],
    gir: row.gir == null ? null : bool(row.gir),
    penalties: numOrNull(row.penalties),
    notes: strOrNull(row.notes),
    updatedAt: str(row.updated_at),
  };
}

export function rowToRound(row: Row, participants: RoundParticipant[], scores: HoleScore[]): Round {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    courseId: strOrNull(row.course_id),
    courseProvider: strOrNull(row.course_provider),
    courseProviderId: strOrNull(row.course_provider_id),
    courseName: str(row.course_name),
    teeSetId: strOrNull(row.tee_set_id),
    teeName: strOrNull(row.tee_name),
    teeColor: strOrNull(row.tee_color),
    holesPlanned: num(row.holes_planned, 18) === 9 ? 9 : 18,
    startingHole: num(row.starting_hole, 1),
    format: str(row.format, 'stroke') as Round['format'],
    status: str(row.status, 'active') as Round['status'],
    isMultiDevice: bool(row.is_multi_device),
    shareCode: strOrNull(row.share_code),
    holeData: json<Round['holeData']>(row.hole_data, []),
    startedAt: str(row.started_at),
    completedAt: strOrNull(row.completed_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    participants,
    scores,
  };
}

// ---------- swing ----------

export function rowToSwingVideo(row: Row): SwingVideo {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    storagePath: str(row.local_uri),
    durationSeconds: numOrNull(row.duration_seconds),
    cameraView: str(row.camera_view, 'unknown') as SwingVideo['cameraView'],
    clubType: strOrNull(row.club_type),
    status: str(row.status, 'uploaded') as SwingVideo['status'],
    createdAt: str(row.created_at),
  };
}

export function rowToSwingAnalysis(row: Row): SwingAnalysis {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    videoId: strOrNull(row.video_id),
    status: str(row.status, 'completed') as SwingAnalysis['status'],
    model: str(row.model),
    summary: str(row.summary),
    videoQuality: str(row.video_quality, 'acceptable') as SwingAnalysis['videoQuality'],
    perspective: str(row.perspective, 'unknown') as SwingAnalysis['perspective'],
    strengths: json<SwingAnalysis['strengths']>(row.strengths, []),
    improvements: json<SwingAnalysis['improvements']>(row.improvements, []),
    topPriority: json<SwingAnalysis['topPriority']>(row.top_priority, null),
    drill: json<SwingAnalysis['drill']>(row.drill, null),
    phases: json<SwingAnalysis['phases']>(row.phases, []),
    confidence: str(row.confidence, 'medium') as SwingAnalysis['confidence'],
    limitations: json<string[]>(row.limitations, []),
    recordingTip: strOrNull(row.recording_tip),
    createdAt: str(row.created_at),
  };
}

// ---------- practice ----------

export function rowToDrill(row: Row): PracticeDrill {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    skill: str(row.skill),
    description: str(row.description),
    steps: json<string[]>(row.steps, []),
    durationMinutes: num(row.duration_minutes, 10),
    equipment: json<string[]>(row.equipment, []),
  };
}

export function rowToPracticeSession(row: Row): PracticeSession {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    drillId: str(row.drill_id),
    completedAt: str(row.completed_at),
    durationMinutes: numOrNull(row.duration_minutes),
    notes: strOrNull(row.notes),
    repsCompleted: numOrNull(row.reps_completed),
  };
}

export function rowToOneThing(row: Row): OneThingRecommendation {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    focus: str(row.focus),
    explanation: str(row.explanation),
    drillId: strOrNull(row.drill_id),
    drillName: strOrNull(row.drill_name),
    status: str(row.status, 'active') as OneThingRecommendation['status'],
    source: str(row.source, 'analysis') as OneThingRecommendation['source'],
    createdAt: str(row.created_at),
  };
}

// ---------- coach ----------

export function rowToConversation(row: Row): CoachConversation {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    title: str(row.title),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToCoachMessage(row: Row): CoachMessage {
  return {
    id: str(row.id),
    conversationId: str(row.conversation_id),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: str(row.content),
    createdAt: str(row.created_at),
  };
}
