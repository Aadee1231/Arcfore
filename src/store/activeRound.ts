import * as repo from '@/lib/db/repo';
import { newId } from '@/lib/id';
import type { ScorePatch } from '@/lib/offline/outbox';
import { mergeScores } from '@/lib/offline/outbox';
import { findScore, playedHoleNumbers } from '@/lib/scoring/engine';
import type {
    HoleScore,
    Round,
    RoundParticipant,
    RoundStatus,
    TeeHoleInfo,
} from '@/types/domain';
import { create } from 'zustand';

type UndoEntry = {
  participantId: string;
  holeNumber: number;
  previous: HoleScore | null;
};

interface ActiveRoundState {
  round: Round | null;
  hydrated: boolean;
  undoStack: UndoEntry[];

  hydrate: () => Promise<void>;
  createRound: (input: {
    id: string;
    ownerId: string;
    courseId: string | null;
    courseProvider: string | null;
    courseProviderId: string | null;
    courseName: string;
    teeSetId: string | null;
    teeName: string | null;
    teeColor?: string | null;
    holesPlanned: 9 | 18;
    startingHole: number;
    format: Round['format'];
    isMultiDevice: boolean;
    shareCode: string | null;
    holeData: TeeHoleInfo[];
    participants: Omit<RoundParticipant, 'id' | 'sortOrder'>[];
  }) => Round;
  adoptRound: (round: Round) => void; // restoring an existing round from the local DB
  updateScore: (participantId: string, holeNumber: number, patch: ScorePatch) => void;
  undoLast: () => void;
  setStatus: (status: RoundStatus) => void;
  addParticipant: (p: Omit<RoundParticipant, 'id' | 'sortOrder'>) => void;
  clearRound: () => Promise<void>;
}

const now = () => new Date().toISOString();

/** Writes are fire-and-forget but serialized via repo's write queue; failures
 * are logged — the in-memory state remains authoritative for the session and
 * the next mutation retries persistence anyway. */
const persist = (p: Promise<unknown>, what: string) =>
  p.catch((e) => console.warn(`Arcfore: failed to persist ${what}:`, e));

export const useActiveRound = create<ActiveRoundState>((set, get) => ({
  round: null,
  hydrated: false,
  undoStack: [],

  hydrate: async () => {
    const round = await repo.getActiveRound().catch(() => null);
    set({ round, hydrated: true });
  },

  createRound: (input) => {
    const round: Round = {
      id: input.id,
      ownerId: input.ownerId,
      courseId: input.courseId,
      courseProvider: input.courseProvider,
      courseProviderId: input.courseProviderId,
      courseName: input.courseName,
      teeSetId: input.teeSetId,
      teeName: input.teeName,
      teeColor: input.teeColor ?? null,
      holesPlanned: input.holesPlanned,
      startingHole: input.startingHole,
      format: input.format,
      status: 'active',
      isMultiDevice: input.isMultiDevice,
      shareCode: input.shareCode,
      holeData: input.holeData,
      startedAt: now(),
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
      participants: input.participants.map((p, i) => ({ ...p, id: newId(), sortOrder: i })),
      scores: [],
    };
    set({ round, undoStack: [] });
    persist(repo.saveRound(round), 'new round');
    return round;
  },

  adoptRound: (round) => {
    set({ round, undoStack: [] });
    persist(repo.saveRound(round), 'restored round');
  },

  updateScore: (participantId, holeNumber, patch) => {
    const { round, undoStack } = get();
    if (!round || round.status !== 'active') return;

    const previous = findScore(round.scores, participantId, holeNumber);
    const nextScore: HoleScore = {
      participantId,
      holeNumber,
      strokes: previous?.strokes ?? null,
      putts: previous?.putts ?? null,
      fairway: previous?.fairway ?? null,
      gir: previous?.gir ?? null,
      penalties: previous?.penalties ?? null,
      notes: previous?.notes ?? null,
      ...patch,
      updatedAt: now(),
    };
    const scores = [
      ...round.scores.filter(
        (s) => !(s.participantId === participantId && s.holeNumber === holeNumber),
      ),
      nextScore,
    ];
    const nextRound = { ...round, scores, updatedAt: now() };
    set({
      round: nextRound,
      undoStack: [...undoStack.slice(-49), { participantId, holeNumber, previous }],
    });
    persist(
      repo.upsertScoreCell(round.id, nextScore, nextRound.updatedAt),
      `score ${participantId}:${holeNumber}`,
    );
  },

  undoLast: () => {
    const { round, undoStack } = get();
    if (!round || undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    let scores: HoleScore[];
    if (entry.previous == null) {
      scores = round.scores.filter(
        (s) => !(s.participantId === entry.participantId && s.holeNumber === entry.holeNumber),
      );
    } else {
      scores = [
        ...round.scores.filter(
          (s) => !(s.participantId === entry.participantId && s.holeNumber === entry.holeNumber),
        ),
        entry.previous,
      ];
    }
    const nextRound = { ...round, scores, updatedAt: now() };
    set({ round: nextRound, undoStack: undoStack.slice(0, -1) });
    persist(
      entry.previous
        ? repo.upsertScoreCell(round.id, entry.previous, nextRound.updatedAt)
        : repo.deleteScoreCell(round.id, entry.participantId, entry.holeNumber),
      'undo',
    );
  },

  setStatus: (status) => {
    const { round } = get();
    if (!round) return;
    const nextRound = {
      ...round,
      status,
      completedAt: status === 'completed' ? now() : round.completedAt,
      updatedAt: now(),
    };
    set({ round: nextRound });
    persist(repo.saveRound(nextRound), `round ${status}`);
  },

  addParticipant: (p) => {
    const { round } = get();
    if (!round) return;
    const participant: RoundParticipant = { ...p, id: newId(), sortOrder: round.participants.length };
    const nextRound = { ...round, participants: [...round.participants, participant], updatedAt: now() };
    set({ round: nextRound });
    persist(repo.saveRound(nextRound), 'new participant');
  },

  clearRound: async () => {
    const { round } = get();
    set({ round: null, undoStack: [] });
    if (round) {
      // Keep the record (abandoned) rather than deleting user history.
      await repo
        .updateRoundStatus(round.id, 'abandoned', round.completedAt)
        .catch((e) => console.warn('Arcfore: failed to abandon round:', e));
    }
  },
}));

/** Convenience selector helpers. */
export function useHoleScore(participantId: string, holeNumber: number) {
  return useActiveRound((s) =>
    s.round ? findScore(s.round.scores, participantId, holeNumber) : null,
  );
}
export function usePlayedHoles() {
  return useActiveRound((s) =>
    s.round ? playedHoleNumbers({ holesPlanned: s.round.holesPlanned, startingHole: s.round.startingHole }) : [],
  );
}

/** Merge helper kept for tests/importers. */
export { mergeScores };
