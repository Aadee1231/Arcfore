import { rowToHoleScore, rowToParticipant, rowToRound } from '@/lib/db/mappers';
import { MIGRATIONS } from '@/lib/db/schema';
import { DRILL_CATALOG } from '@/lib/drills';
import { newId } from '@/lib/id';
import { offlineStorage } from '@/lib/offline/storage';
import type { Round } from '@/types/domain';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Single on-device SQLite database — the source of truth for profile, bag,
 * rounds, scores, swing analyses, practice, and coach history.
 *
 * - `initDb()` is idempotent and called once from the root layout before
 *   hydration; subsequent calls return the cached promise.
 * - All writes are funneled through `enqueueWrite` so concurrent callers
 *   (score entry, imports, hooks) never interleave transactions.
 */

let db: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

export const LOCAL_USER_ID = 'local-user';

export function getDb(): SQLiteDatabase {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

/** Serialize writes. Reads can go through getDb() directly. */
export function enqueueWrite<T>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const next = writeChain.then(() => task(getDb()));
  writeChain = next.catch(() => {});
  return next;
}

export async function initDb(): Promise<SQLiteDatabase> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = openDatabaseSync('arcfore.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    await seedDrills(db);
    await migrateLegacyStorage(db);
    return db;
  })();
  // If init fails, allow a retry on next call instead of caching the rejection.
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

async function runMigrations(database: SQLiteDatabase) {
  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const current = row?.user_version ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    try {
      await database.withTransactionAsync(async () => {
        for (const statement of migration.statements) {
          await database.execAsync(statement);
        }
        await database.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (e) {
      // Surface a clear error — a failed migration must not silently continue.
      throw new Error(
        `Arcfore DB migration v${migration.version} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/** Seed the bundled drill catalog once (idempotent upserts). */
async function seedDrills(database: SQLiteDatabase) {
  const existing = await database.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM practice_drills',
  );
  if ((existing?.n ?? 0) > 0) return;
  for (const d of DRILL_CATALOG) {
    await database.runAsync(
      `INSERT OR IGNORE INTO practice_drills
        (id, slug, name, skill, description, steps, duration_minutes, equipment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), d.slug, d.name, d.skill, d.description, JSON.stringify(d.steps), d.durationMinutes, JSON.stringify(d.equipment)],
    );
  }
}

/**
 * One-time import of pre-SQLite local data:
 * the AsyncStorage active-round snapshot + its outbox are folded into SQLite
 * (the round + participants + all scores). Active rounds are never erased.
 */
async function migrateLegacyStorage(database: SQLiteDatabase) {
  try {
    const marker = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_kv WHERE key = 'legacy_migrated'",
    );
    if (marker) return;

    const legacy = await offlineStorage.loadActiveRound();
    if (legacy?.id) {
      await saveRoundSnapshotDb(database, legacy);
    }
    await database.runAsync(
      "INSERT OR REPLACE INTO app_kv (key, value) VALUES ('legacy_migrated', ?)",
      [new Date().toISOString()],
    );
    // Clear the old keys — SQLite is authoritative from here on.
    await offlineStorage.saveActiveRound(null);
    await offlineStorage.saveOutbox([]);
  } catch (e) {
    // Migration failure must not block startup — log and leave data in place.
    console.warn('Arcfore legacy storage migration failed:', e);
  }
}

/**
 * Write a full round snapshot: upsert the round row, then participants and
 * every score cell. Idempotent — safe to replay after crashes.
 */
export async function saveRoundSnapshotDb(database: SQLiteDatabase, round: Round) {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT OR REPLACE INTO rounds
        (id, owner_id, course_id, course_provider, course_provider_id, course_name,
         tee_set_id, tee_name, tee_color, holes_planned, starting_hole, format, status,
         is_multi_device, share_code, hole_data, started_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        round.id, round.ownerId, round.courseId, round.courseProvider, round.courseProviderId,
        round.courseName, round.teeSetId, round.teeName, round.teeColor, round.holesPlanned,
        round.startingHole, round.format, round.status, round.isMultiDevice ? 1 : 0,
        round.shareCode, JSON.stringify(round.holeData), round.startedAt, round.completedAt,
        round.createdAt, round.updatedAt,
      ],
    );
    for (const p of round.participants) {
      await database.runAsync(
        `INSERT OR REPLACE INTO round_participants
          (id, round_id, user_id, display_name, is_guest, sort_order, tee_label)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, round.id, p.userId, p.displayName, p.isGuest ? 1 : 0, p.sortOrder, p.teeLabel],
      );
    }
    for (const s of round.scores) {
      await database.runAsync(
        `INSERT OR REPLACE INTO hole_scores
          (round_id, participant_id, hole_number, strokes, putts, fairway, gir, penalties, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          round.id, s.participantId, s.holeNumber, s.strokes, s.putts, s.fairway,
          s.gir == null ? null : s.gir ? 1 : 0, s.penalties, s.notes, s.updatedAt,
        ],
      );
    }
  });
}

/** Load one round (with participants + scores) as a domain object. */
export async function loadRoundById(roundId: string): Promise<Round | null> {
  const database = getDb();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM rounds WHERE id = ?',
    [roundId],
  );
  if (!row) return null;
  const parts = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM round_participants WHERE round_id = ? ORDER BY sort_order',
    [roundId],
  );
  const scores = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM hole_scores WHERE round_id = ?',
    [roundId],
  );
  return rowToRound(row, parts.map(rowToParticipant), scores.map(rowToHoleScore));
}
