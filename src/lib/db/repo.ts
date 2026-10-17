import { enqueueWrite, getDb, loadRoundById, LOCAL_USER_ID, saveRoundSnapshotDb } from '@/lib/db/database';
import {
    rowToClub,
    rowToCoachMessage,
    rowToConversation,
    rowToDrill,
    rowToHoleScore,
    rowToOneThing,
    rowToParticipant,
    rowToPracticeSession,
    rowToProfile,
    rowToRound,
    rowToSwingAnalysis,
    rowToSwingVideo,
} from '@/lib/db/mappers';
import { newId } from '@/lib/id';
import type { SwingAnalysisResult } from '@/lib/validation/schemas';
import type {
    CoachConversation,
    CoachMessage,
    HoleScore,
    OneThingRecommendation,
    PracticeDrill,
    PracticeSession,
    Profile,
    Round,
    SwingAnalysis,
    SwingVideo,
    UserClub,
} from '@/types/domain';

const now = () => new Date().toISOString();
const uid = () => LOCAL_USER_ID;

// ---------- profile ----------

export async function getProfile(userId = uid()): Promise<Profile | null> {
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM profiles WHERE id = ?',
    [userId],
  );
  return row ? rowToProfile(row) : null;
}

export async function upsertProfile(patch: Partial<Profile>, userId = uid()): Promise<void> {
  const existing = await getProfile(userId);
  const ts = now();
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO profiles
        (id, display_name, handedness, skill_level, primary_goal, units, typical_score,
         avatar_url, onboarded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        patch.displayName ?? existing?.displayName ?? 'Golfer',
        patch.handedness ?? existing?.handedness ?? 'right',
        patch.skillLevel ?? existing?.skillLevel ?? 'intermediate',
        patch.primaryGoal ?? existing?.primaryGoal ?? '',
        patch.units ?? existing?.units ?? 'yards',
        patch.typicalScore ?? existing?.typicalScore ?? null,
        patch.avatarUrl ?? existing?.avatarUrl ?? null,
        patch.onboardedAt ?? existing?.onboardedAt ?? ts,
        existing?.createdAt ?? ts,
        ts,
      ],
    );
  });
}

// ---------- clubs ----------

export async function listClubs(userId = uid()): Promise<UserClub[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM user_clubs WHERE user_id = ? ORDER BY sort_order, name',
    [userId],
  );
  return rows.map(rowToClub);
}

export async function upsertClub(club: Partial<UserClub>, userId = uid()): Promise<void> {
  const id = club.id ?? newId();
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_clubs
        (id, user_id, club_type, name, brand, model, carry_yards, total_yards, confidence, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, club.clubType ?? 'other', club.name ?? '',
        club.brand ?? null, club.model ?? null, club.carryYards ?? null,
        club.totalYards ?? null, club.confidence ?? null, club.notes ?? null,
        club.sortOrder ?? 0,
      ],
    );
  });
}

export async function deleteClub(clubId: string): Promise<void> {
  await enqueueWrite((db) => db.runAsync('DELETE FROM user_clubs WHERE id = ?', [clubId]));
}

// ---------- rounds ----------

export async function listRounds(userId = uid(), limit = 50): Promise<Round[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT DISTINCT r.* FROM rounds r
     LEFT JOIN round_participants p ON p.round_id = r.id
     WHERE r.owner_id = ? OR p.user_id = ?
     ORDER BY r.started_at DESC LIMIT ?`,
    [userId, userId, limit],
  );
  const rounds: Round[] = [];
  for (const row of rows) {
    const id = row.id as string;
    const parts = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM round_participants WHERE round_id = ? ORDER BY sort_order',
      [id],
    );
    const scores = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM hole_scores WHERE round_id = ?',
      [id],
    );
    rounds.push(rowToRound(row, parts.map(rowToParticipant), scores.map(rowToHoleScore)));
  }
  return rounds;
}

export const getRound = loadRoundById;

/** Fetch the currently-active round (for resume-after-kill). */
export async function getActiveRound(): Promise<Round | null> {
  const row = await getDb().getFirstAsync<{ id: string }>(
    "SELECT id FROM rounds WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1",
  );
  return row ? loadRoundById(row.id) : null;
}

/** Persist the whole round snapshot (upsert; used by the round store). */
export async function saveRound(round: Round): Promise<void> {
  await enqueueWrite((db) => saveRoundSnapshotDb(db, round));
}

/** Fast path for a single score cell — avoids rewriting the whole snapshot. */
export async function upsertScoreCell(
  roundId: string,
  score: HoleScore,
  roundUpdatedAt: string,
): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO hole_scores
        (round_id, participant_id, hole_number, strokes, putts, fairway, gir, penalties, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roundId, score.participantId, score.holeNumber, score.strokes, score.putts,
        score.fairway, score.gir == null ? null : score.gir ? 1 : 0,
        score.penalties, score.notes, score.updatedAt,
      ],
    );
    await db.runAsync('UPDATE rounds SET updated_at = ? WHERE id = ?', [roundUpdatedAt, roundId]);
  });
}

export async function deleteScoreCell(
  roundId: string,
  participantId: string,
  holeNumber: number,
): Promise<void> {
  await enqueueWrite((db) =>
    db.runAsync(
      'DELETE FROM hole_scores WHERE round_id = ? AND participant_id = ? AND hole_number = ?',
      [roundId, participantId, holeNumber],
    ),
  );
}

export async function updateRoundStatus(roundId: string, status: string, completedAt: string | null) {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      'UPDATE rounds SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [status, completedAt, now(), roundId],
    );
  });
}

// ---------- swing videos + analyses ----------

export async function insertSwingVideo(video: {
  id: string;
  localUri: string;
  durationSeconds: number | null;
  cameraView: string;
  clubType: string | null;
  sizeBytes: number | null;
}): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO swing_videos
        (id, user_id, local_uri, duration_seconds, camera_view, club_type, size_bytes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'analyzed', ?)`,
      [
        video.id, uid(), video.localUri, video.durationSeconds,
        video.cameraView, video.clubType, video.sizeBytes, now(),
      ],
    );
  });
}

export async function insertSwingAnalysis(
  result: SwingAnalysisResult,
  opts: { id?: string; videoId: string | null; model: string },
): Promise<string> {
  const id = opts.id ?? newId();
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO swing_analyses
        (id, user_id, video_id, status, model, summary, video_quality, perspective,
         strengths, improvements, top_priority, drill, phases, confidence, limitations,
         recording_tip, created_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, uid(), opts.videoId, opts.model, result.summary, result.videoQuality,
        result.perspective, JSON.stringify(result.strengths), JSON.stringify(result.improvements),
        result.topPriority ? JSON.stringify(result.topPriority) : null,
        result.drill ? JSON.stringify(result.drill) : null,
        JSON.stringify(result.phases), result.confidence, JSON.stringify(result.limitations),
        result.recordingTip, now(),
      ],
    );
    if (result.topPriority && result.videoQuality !== 'unusable') {
      await db.runAsync(
        `INSERT INTO one_thing_recommendations
          (id, user_id, focus, explanation, drill_id, drill_name, status, source, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, 'active', 'analysis', ?)`,
        [newId(), uid(), result.topPriority.title, result.topPriority.explanation, result.drill?.name ?? null, now()],
      );
    }
  });
  return id;
}

export async function listSwingAnalyses(userId = uid()): Promise<SwingAnalysis[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM swing_analyses WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(rowToSwingAnalysis);
}

export async function getSwingAnalysis(id: string): Promise<SwingAnalysis | null> {
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM swing_analyses WHERE id = ?',
    [id],
  );
  return row ? rowToSwingAnalysis(row) : null;
}

export async function getSwingVideo(id: string): Promise<SwingVideo | null> {
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM swing_videos WHERE id = ?',
    [id],
  );
  return row ? rowToSwingVideo(row) : null;
}

// ---------- practice ----------

export async function listDrills(): Promise<PracticeDrill[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM practice_drills ORDER BY skill, name',
  );
  return rows.map(rowToDrill);
}

export async function listPracticeSessions(userId = uid()): Promise<PracticeSession[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM practice_sessions WHERE user_id = ? ORDER BY completed_at DESC',
    [userId],
  );
  return rows.map(rowToPracticeSession);
}

export async function logPracticeSession(input: {
  drillId: string;
  durationMinutes?: number;
  notes?: string;
  repsCompleted?: number;
}): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO practice_sessions (id, user_id, drill_id, completed_at, duration_minutes, notes, reps_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), uid(), input.drillId, now(), input.durationMinutes ?? null, input.notes ?? null, input.repsCompleted ?? null],
    );
  });
}

// ---------- one thing ----------

export async function getActiveOneThing(userId = uid()): Promise<OneThingRecommendation | null> {
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM one_thing_recommendations WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return row ? rowToOneThing(row) : null;
}

export async function resolveOneThing(id: string, status: 'improved' | 'dismissed'): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      'UPDATE one_thing_recommendations SET status = ?, resolved_at = ? WHERE id = ?',
      [status, now(), id],
    );
  });
}

// ---------- coach conversations ----------

export async function createConversation(title: string, userId = uid()): Promise<string> {
  const id = newId();
  const ts = now();
  await enqueueWrite(async (db) => {
    await db.runAsync(
      'INSERT INTO coach_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, title.slice(0, 60), ts, ts],
    );
  });
  return id;
}

export async function addCoachMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      'INSERT INTO coach_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [newId(), conversationId, role, content, now()],
    );
    await db.runAsync(
      'UPDATE coach_conversations SET updated_at = ? WHERE id = ?',
      [now(), conversationId],
    );
  });
}

export async function listConversations(userId = uid()): Promise<CoachConversation[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM coach_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20',
    [userId],
  );
  return rows.map(rowToConversation);
}

export async function getConversationMessages(conversationId: string): Promise<CoachMessage[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM coach_messages WHERE conversation_id = ? ORDER BY created_at',
    [conversationId],
  );
  return rows.map(rowToCoachMessage);
}

// ---------- course cache ----------

export async function cacheCourseDetail(provider: string, providerId: string, payload: unknown) {
  await enqueueWrite(async (db) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO course_cache (provider, provider_id, payload, fetched_at) VALUES (?, ?, ?, ?)',
      [provider, providerId, JSON.stringify(payload), now()],
    );
  });
}

export async function getCachedCourseDetail<T>(provider: string, providerId: string): Promise<T | null> {
  const row = await getDb().getFirstAsync<{ payload: string }>(
    'SELECT payload FROM course_cache WHERE provider = ? AND provider_id = ?',
    [provider, providerId],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

// ---------- kv ----------

export async function kvGet(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM app_kv WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  await enqueueWrite(async (db) => {
    await db.runAsync('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)', [key, value]);
  });
}

/** Wipe all user data (profile, rounds, analyses, chats). Keeps seeded drills. */
export async function clearAllData(): Promise<void> {
  await enqueueWrite(async (db) => {
    const tables = [
      'coach_messages', 'coach_conversations', 'one_thing_recommendations',
      'practice_sessions', 'swing_analyses', 'swing_videos',
      'hole_scores', 'round_participants', 'rounds',
      'user_clubs', 'profiles', 'course_cache', 'app_kv',
    ];
    for (const t of tables) await db.runAsync(`DELETE FROM ${t}`);
  });
}

// ---------- backup / export ----------

/** Portable JSON backup of all user data — used by the profile screen. */
export async function exportBackup(): Promise<Record<string, unknown>> {
  const db = getDb();
  const tables = [
    'profiles', 'user_clubs', 'rounds', 'round_participants', 'hole_scores',
    'swing_videos', 'swing_analyses', 'practice_sessions', 'one_thing_recommendations',
    'coach_conversations', 'coach_messages', 'course_cache',
  ] as const;
  const dump: Record<string, unknown> = { exportedAt: now(), version: 1 };
  for (const t of tables) {
    dump[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return dump;
}
