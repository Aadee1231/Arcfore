import { describe, expect, it } from 'vitest';
import { careerStats } from '@/lib/analytics/stats';
import { mergeScores, enqueue, type OutboxMutation } from '@/lib/offline/outbox';
import { findScore, isRoundComplete, participantStats, playedHoleNumbers } from '@/lib/scoring/engine';
import { holeData18, makeParticipant, makeRound, makeScore } from './fixtures';
import type { HoleScore } from '@/types/domain';

/**
 * Integration-level flow: start round → record scores for a group →
 * go offline → sync back → finish → verify stats. Mirrors the real
 * startRound/updateScore/outbox/merge path the store exercises.
 */
describe('round lifecycle e2e', () => {
  it('start → group scoring → offline queue → sync → complete → stats', () => {
    // 1. Create a round with three guests on one device
    const players = [
      makeParticipant({ displayName: 'Aadee', isGuest: false, userId: 'u_aadee' }),
      makeParticipant({ displayName: 'Rehan' }),
      makeParticipant({ displayName: 'Srujan' }),
    ];
    const round = makeRound({ participants: players, holesPlanned: 9, status: 'active' });
    const holes = playedHoleNumbers(round);
    expect(holes).toHaveLength(9);

    // 2. Record scores: everyone plays every hole
    let scores: HoleScore[] = [];
    let outbox: OutboxMutation[] = [];
    const recordScore = (pIdx: number, hole: number, strokes: number, ts: string) => {
      const p = players[pIdx];
      const existing = findScore(scores, p.id, hole);
      const cell: HoleScore = {
        participantId: p.id,
        holeNumber: hole,
        strokes,
        putts: existing?.putts ?? null,
        fairway: existing?.fairway ?? null,
        gir: existing?.gir ?? null,
        penalties: existing?.penalties ?? null,
        notes: existing?.notes ?? null,
        updatedAt: ts,
      };
      scores = mergeScores(scores, [cell]);
      outbox = enqueue(outbox, {
        kind: 'score_upsert',
        id: `m_${p.id}_${hole}`,
        roundId: round.id,
        participantId: p.id,
        holeNumber: hole,
        patch: { strokes },
        clientTs: ts,
      });
    };
    let t = 0;
    for (const hole of holes) {
      for (let p = 0; p < 3; p++) {
        t += 1;
        recordScore(p, hole, holeData18()[hole - 1].par + (p === 0 ? -1 : p === 1 ? 0 : 1), `2026-10-01T12:${String(t).padStart(2, '0')}:00Z`);
      }
    }

    // 3. Simulate offline: edit a score while disconnected (queued, merged locally)
    recordScore(1, 3, 3, '2026-10-01T13:00:00Z'); // Rehan edits hole 3 to a birdie
    expect(outbox.filter((m) => m.kind === 'score_upsert')).toHaveLength(27);

    // 4. Connectivity returns: server sends back its view (stale for hole 3)
    const serverView = scores.map((s) => ({ ...s }));
    // index 7 = hole 3, participant[1] (hole-major, then player)
    serverView[7] = makeScore(players[1].id, 3, { strokes: 5, updatedAt: '2026-10-01T12:00:00Z' });
    const synced = mergeScores(scores, serverView);
    // local newer edit wins
    expect(findScore(synced, players[1].id, 3)?.strokes).toBe(3);

    // 5. Round completes — every participant has strokes on every hole
    const completed = { ...round, status: 'completed' as const, scores: synced };
    expect(isRoundComplete(completed, synced)).toBe(true);

    // 6. Stats: Aadee is -9 (birdie every hole), Rehan E-ish with an edit, Srujan +9
    const aadeeStats = participantStats(players[0], completed, synced);
    expect(aadeeStats.totalStrokes).toBe(27); // front-nine par 36 − 9 birdies
    expect(aadeeStats.toPar).toBe(-9);
    expect(aadeeStats.birdies).toBe(9);
    const rehanStats = participantStats(players[1], completed, synced);
    expect(findScore(synced, players[1].id, 3)?.strokes).toBe(3);

    // 7. Career stats include the round for Aadee's account
    const career = careerStats([{ round: completed, scores: synced }], 'u_aadee');
    expect(career.roundsCompleted).toBe(1);
    expect(career.bestRoundToPar?.toPar).toBe(-9);
  });

  it('abandoned-then-resumed round survives restart (scores persist)', () => {
    const p = makeParticipant();
    const scores = [makeScore(p.id, 1, { strokes: 4 }), makeScore(p.id, 2, { strokes: 5 })];
    // serialize/deserialize like AsyncStorage does
    const revived: HoleScore[] = JSON.parse(JSON.stringify(scores));
    const round = makeRound({ participants: [p] });
    expect(findScore(revived, p.id, 1)?.strokes).toBe(4);
    expect(isRoundComplete(round, revived)).toBe(false);
  });
});
