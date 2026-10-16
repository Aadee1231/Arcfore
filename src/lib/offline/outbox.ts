import type { HoleScore, Round, RoundParticipant } from '@/types/domain';

/** Outbox mutations. Pure data — serializable to AsyncStorage, applied FIFO. */
export type ScorePatch = Partial<
  Pick<HoleScore, 'strokes' | 'putts' | 'fairway' | 'gir' | 'penalties' | 'notes'>
>;

export type OutboxMutation =
  | {
      kind: 'score_upsert';
      id: string; // mutation id (dedupe)
      roundId: string;
      participantId: string;
      holeNumber: number;
      patch: ScorePatch;
      clientTs: string; // ISO — drives last-write-wins
    }
  | {
      kind: 'round_upsert';
      id: string;
      round: Round;
      clientTs: string;
    }
  | {
      kind: 'participant_upsert';
      id: string;
      roundId: string;
      participant: RoundParticipant;
      clientTs: string;
    };

const cellKey = (participantId: string, holeNumber: number) => `${participantId}:${holeNumber}`;

/**
 * Fold a new mutation into the pending queue.
 * Score upserts to the same cell merge (latest patch wins per-field, latest ts wins).
 * Round/participant upserts collapse by entity id.
 */
export function enqueue(queue: OutboxMutation[], mutation: OutboxMutation): OutboxMutation[] {
  if (mutation.kind === 'score_upsert') {
    const idx = queue.findIndex(
      (m) =>
        m.kind === 'score_upsert' &&
        m.roundId === mutation.roundId &&
        cellKey(m.participantId, m.holeNumber) === cellKey(mutation.participantId, mutation.holeNumber),
    );
    if (idx === -1) return [...queue, mutation];
    const prev = queue[idx] as Extract<OutboxMutation, { kind: 'score_upsert' }>;
    const merged: OutboxMutation = {
      ...prev,
      patch: { ...prev.patch, ...mutation.patch },
      clientTs: mutation.clientTs > prev.clientTs ? mutation.clientTs : prev.clientTs,
    };
    const next = [...queue];
    next[idx] = merged;
    return next;
  }
  if (mutation.kind === 'round_upsert') {
    const idx = queue.findIndex(
      (m) => m.kind === 'round_upsert' && m.round.id === mutation.round.id,
    );
    if (idx === -1) return [...queue, mutation];
    const next = [...queue];
    next[idx] = mutation; // round snapshot: newest replaces
    return next;
  }
  const idx = queue.findIndex(
    (m) =>
      m.kind === 'participant_upsert' &&
      m.roundId === mutation.roundId &&
      m.participant.id === mutation.participant.id,
  );
  if (idx === -1) return [...queue, mutation];
  const next = [...queue];
  next[idx] = mutation;
  return next;
}

/**
 * Merge remote hole_scores into local ones.
 * Last-write-wins per cell: the row with the newer `updatedAt` survives.
 * Returns { merged, changed } — merged preserves local rows absent remotely.
 */
export function mergeScores(local: HoleScore[], remote: HoleScore[]): HoleScore[] {
  const map = new Map<string, HoleScore>();
  for (const s of local) map.set(cellKey(s.participantId, s.holeNumber), s);
  for (const s of remote) {
    const key = cellKey(s.participantId, s.holeNumber);
    const existing = map.get(key);
    if (!existing || s.updatedAt > existing.updatedAt) map.set(key, s);
  }
  return [...map.values()];
}

/** Which pending score mutations still need pushing given current queue (all of them — FIFO order). */
export function pendingScoreMutations(queue: OutboxMutation[]) {
  return queue.filter((m): m is Extract<OutboxMutation, { kind: 'score_upsert' }> => m.kind === 'score_upsert');
}

let seq = 0;
/** Deterministic-enough unique mutation id: timestamp + counter + random tail. */
export function mutationId(): string {
  seq += 1;
  return `m_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}
