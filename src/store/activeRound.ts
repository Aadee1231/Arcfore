import { create } from 'zustand';
import type {
  HoleScore,
  Round,
  RoundParticipant,
  RoundStatus,
  TeeHoleInfo,
} from '@/types/domain';
import type { OutboxMutation, ScorePatch } from '@/lib/offline/outbox';
import { enqueue, mergeScores, mutationId } from '@/lib/offline/outbox';
import { offlineStorage } from '@/lib/offline/storage';
import { findScore, playedHoleNumbers } from '@/lib/scoring/engine';
import { newId } from '@/lib/id';

type UndoEntry = {
  participantId: string;
  holeNumber: number;
  previous: HoleScore | null;
};

interface ActiveRoundState {
  round: Round | null;
  hydrated: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSyncError: string | null;
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
  adoptRound: (round: Round) => void; // joining an existing round or restoring from server
  updateScore: (participantId: string, holeNumber: number, patch: ScorePatch) => void;
  undoLast: () => void;
  setStatus: (status: RoundStatus) => void;
  addParticipant: (p: Omit<RoundParticipant, 'id' | 'sortOrder'>) => void;
  applyRemoteScores: (remote: HoleScore[]) => void;
  setSyncing: (v: boolean, error?: string | null) => void;
  setPendingCount: (n: number) => void;
  clearRound: () => Promise<void>;
}

const now = () => new Date().toISOString();

async function persist(round: Round | null, queue?: OutboxMutation[]) {
  await offlineStorage.saveActiveRound(round);
  if (queue) await offlineStorage.saveOutbox(queue);
}

export const useActiveRound = create<ActiveRoundState>((set, get) => ({
  round: null,
  hydrated: false,
  syncing: false,
  pendingCount: 0,
  lastSyncError: null,
  undoStack: [],

  hydrate: async () => {
    const [round, queue] = await Promise.all([
      offlineStorage.loadActiveRound(),
      offlineStorage.loadOutbox(),
    ]);
    set({ round, pendingCount: queue.length, hydrated: true });
    // Keep the outbox in memory too for sync engine access
    _outbox = queue;
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
    _outbox = enqueue(_outbox, { kind: 'round_upsert', id: mutationId(), round, clientTs: now() });
    for (const p of round.participants) {
      _outbox = enqueue(_outbox, {
        kind: 'participant_upsert',
        id: mutationId(),
        roundId: round.id,
        participant: p,
        clientTs: now(),
      });
    }
    set({ round, undoStack: [], pendingCount: _outbox.length });
    void persist(round, _outbox);
    return round;
  },

  adoptRound: (round) => {
    set({ round, undoStack: [] });
    void persist(round);
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

    // Enqueue the COMPLETE cell state (not the partial patch) so the upsert is
    // idempotent and never clobbers fields the user didn't edit.
    _outbox = enqueue(_outbox, {
      kind: 'score_upsert',
      id: mutationId(),
      roundId: round.id,
      participantId,
      holeNumber,
      patch: {
        strokes: nextScore.strokes,
        putts: nextScore.putts,
        fairway: nextScore.fairway,
        gir: nextScore.gir,
        penalties: nextScore.penalties,
        notes: nextScore.notes,
      },
      clientTs: nextScore.updatedAt,
    });
    set({
      round: nextRound,
      undoStack: [...undoStack.slice(-49), { participantId, holeNumber, previous }],
      pendingCount: _outbox.length,
    });
    void persist(nextRound, _outbox);
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
    // Undo is itself a local edit — push the restored/cleared value
    _outbox = enqueue(_outbox, {
      kind: 'score_upsert',
      id: mutationId(),
      roundId: round.id,
      participantId: entry.participantId,
      holeNumber: entry.holeNumber,
      patch: entry.previous
        ? {
            strokes: entry.previous.strokes,
            putts: entry.previous.putts,
            fairway: entry.previous.fairway,
            gir: entry.previous.gir,
            penalties: entry.previous.penalties,
            notes: entry.previous.notes,
          }
        : { strokes: null, putts: null, fairway: null, gir: null, penalties: null, notes: null },
      clientTs: now(),
    });
    set({ round: nextRound, undoStack: undoStack.slice(0, -1), pendingCount: _outbox.length });
    void persist(nextRound, _outbox);
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
    _outbox = enqueue(_outbox, { kind: 'round_upsert', id: mutationId(), round: nextRound, clientTs: now() });
    set({ round: nextRound, pendingCount: _outbox.length });
    void persist(nextRound, _outbox);
  },

  addParticipant: (p) => {
    const { round } = get();
    if (!round) return;
    const participant: RoundParticipant = { ...p, id: newId(), sortOrder: round.participants.length };
    const nextRound = { ...round, participants: [...round.participants, participant], updatedAt: now() };
    _outbox = enqueue(_outbox, {
      kind: 'participant_upsert',
      id: mutationId(),
      roundId: round.id,
      participant,
      clientTs: now(),
    });
    set({ round: nextRound, pendingCount: _outbox.length });
    void persist(nextRound, _outbox);
  },

  applyRemoteScores: (remote) => {
    const { round } = get();
    if (!round) return;
    const merged = mergeScores(round.scores, remote);
    if (merged.length === round.scores.length && merged.every((m) => round.scores.includes(m))) return;
    const nextRound = { ...round, scores: merged };
    set({ round: nextRound });
    void persist(nextRound);
  },

  setSyncing: (v, error = null) => set({ syncing: v, lastSyncError: error }),
  setPendingCount: (n) => set({ pendingCount: n }),

  clearRound: async () => {
    _outbox = _outbox.filter((m) => {
      const { round } = get();
      return !(m.kind === 'round_upsert' && round && m.round.id === round.id);
    });
    set({ round: null, undoStack: [], pendingCount: _outbox.length });
    await persist(null, _outbox);
  },
}));

/** Module-level pending queue shared with the sync engine (hydrated from storage on boot). */
let _outbox: OutboxMutation[] = [];

export function getOutbox(): OutboxMutation[] {
  return _outbox;
}
export function setOutbox(queue: OutboxMutation[]) {
  _outbox = queue;
  useActiveRound.setState({ pendingCount: queue.length });
  void offlineStorage.saveOutbox(queue);
}

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
