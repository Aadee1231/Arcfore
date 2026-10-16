import { describe, expect, it } from 'vitest';
import { enqueue, mergeScores, mutationId, pendingScoreMutations, type OutboxMutation } from '@/lib/offline/outbox';
import { makeParticipant, makeRound, makeScore } from './fixtures';

function scoreMutation(roundId: string, participantId: string, hole: number, patch: OutboxMutation extends never ? never : { strokes?: number | null; putts?: number | null }, ts: string): OutboxMutation {
  return {
    kind: 'score_upsert',
    id: mutationId(),
    roundId,
    participantId,
    holeNumber: hole,
    patch,
    clientTs: ts,
  };
}

describe('enqueue', () => {
  it('merges two upserts to the same cell — latest patch per field', () => {
    let q: OutboxMutation[] = [];
    q = enqueue(q, scoreMutation('r1', 'p1', 3, { strokes: 5 }, '2026-01-01T00:00:01Z'));
    q = enqueue(q, scoreMutation('r1', 'p1', 3, { putts: 2 }, '2026-01-01T00:00:02Z'));
    expect(q).toHaveLength(1);
    const m = q[0] as Extract<OutboxMutation, { kind: 'score_upsert' }>;
    expect(m.patch).toEqual({ strokes: 5, putts: 2 });
    expect(m.clientTs).toBe('2026-01-01T00:00:02Z');
  });

  it('keeps distinct holes and participants separate', () => {
    let q: OutboxMutation[] = [];
    q = enqueue(q, scoreMutation('r1', 'p1', 3, { strokes: 5 }, 't1'));
    q = enqueue(q, scoreMutation('r1', 'p1', 4, { strokes: 4 }, 't2'));
    q = enqueue(q, scoreMutation('r1', 'p2', 3, { strokes: 6 }, 't3'));
    expect(q).toHaveLength(3);
    expect(pendingScoreMutations(q).map((m) => m.holeNumber)).toEqual([3, 4, 3]);
  });

  it('collapses repeated round_upsert snapshots', () => {
    const r1 = makeRound({ id: 'r1', courseName: 'A' });
    const r2 = makeRound({ id: 'r1', courseName: 'B' });
    let q: OutboxMutation[] = [];
    q = enqueue(q, { kind: 'round_upsert', id: 'm1', round: r1, clientTs: 't1' });
    q = enqueue(q, { kind: 'round_upsert', id: 'm2', round: r2, clientTs: 't2' });
    expect(q).toHaveLength(1);
    expect((q[0] as Extract<OutboxMutation, { kind: 'round_upsert' }>).round.courseName).toBe('B');
  });
});

describe('mergeScores — last-write-wins by updatedAt', () => {
  it('remote newer row wins', () => {
    const local = [makeScore('p1', 1, { strokes: 4, updatedAt: '2026-01-01T00:00:01Z' })];
    const remote = [makeScore('p1', 1, { strokes: 3, updatedAt: '2026-01-01T00:00:02Z' })];
    const merged = mergeScores(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].strokes).toBe(3);
  });

  it('local newer row wins', () => {
    const local = [makeScore('p1', 1, { strokes: 4, updatedAt: '2026-01-01T00:00:05Z' })];
    const remote = [makeScore('p1', 1, { strokes: 3, updatedAt: '2026-01-01T00:00:02Z' })];
    expect(mergeScores(local, remote)[0].strokes).toBe(4);
  });

  it('keeps local-only rows not present remotely (offline edits survive sync)', () => {
    const local = [
      makeScore('p1', 1, { strokes: 4 }),
      makeScore('p1', 2, { strokes: 5, updatedAt: '2026-01-01T00:00:09Z' }),
    ];
    const remote = [makeScore('p1', 1, { strokes: 4, updatedAt: '2026-01-01T00:00:01Z' })];
    const merged = mergeScores(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged.find((s) => s.holeNumber === 2)?.strokes).toBe(5);
  });
});
