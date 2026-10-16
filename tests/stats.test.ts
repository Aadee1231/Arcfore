import { describe, expect, it } from 'vitest';
import { careerStats, unofficialHandicapEstimate, type RoundLike } from '@/lib/analytics/stats';
import { holeData18, makeParticipant, makeRound, makeScore } from './fixtures';
import type { HoleScore, Round } from '@/types/domain';

const ME = 'u_me';

/** Completed round where every hole is `par + delta` for the given participant. */
function completedRound(over: Partial<Round> & { delta?: number; putts?: number }): RoundLike {
  const { delta = 0, putts, ...roundOver } = over;
  const me = makeParticipant({ userId: ME, displayName: 'Me', isGuest: false });
  const others = (roundOver.participants ?? []).filter((p) => p.id !== me.id);
  const round = makeRound({ status: 'completed', ...roundOver, participants: [me, ...others] });
  const holes = round.holeData.filter((h) =>
    round.holesPlanned === 9 ? h.hole >= round.startingHole && h.hole < round.startingHole + 9 : true,
  );
  const scores: HoleScore[] = holes.map((h) =>
    makeScore(me.id, h.hole, { strokes: h.par + delta, putts: putts ?? null, fairway: 'hit', gir: true }),
  );
  return { round, scores };
}

describe('careerStats', () => {
  it('ignores in-progress rounds', () => {
    const active = completedRound({ status: 'active', delta: 10 });
    const done = completedRound({ status: 'completed', delta: 1, id: 'r_done' });
    const stats = careerStats([active, done], ME);
    expect(stats.roundsCompleted).toBe(1);
    expect(stats.rounds18).toBe(1);
  });

  it('computes average score and to-par for an 18-hole round', () => {
    // all bogeys (+1 on 18 holes) → toPar +18
    const r = completedRound({ delta: 1 });
    const stats = careerStats([r], ME);
    const parTotal = holeData18().reduce((a, h) => a + h.par, 0);
    expect(stats.averageScore18).toBe(parTotal + 18);
    expect(stats.averageToPar).toBe(18);
    expect(stats.bestRoundToPar?.toPar).toBe(18);
  });

  it('distinguishes 9-hole and 18-hole rounds', () => {
    const nine = completedRound({ holesPlanned: 9, startingHole: 10, delta: 0, id: 'r9' });
    const eighteen = completedRound({ delta: 0, id: 'r18' });
    const stats = careerStats([nine, eighteen], ME);
    expect(stats.rounds9).toBe(1);
    expect(stats.rounds18).toBe(1);
    expect(stats.roundsCompleted).toBe(2);
    // averageScore18 only counts complete 18-hole rounds
    expect(stats.averageScore18).toBe(holeData18().reduce((a, h) => a + h.par, 0));
  });

  it('tracks putts/fir/gir only when recorded', () => {
    const withPutts = completedRound({ delta: 0, putts: 2 });
    const stats = careerStats([withPutts], ME);
    expect(stats.averagePutts).toBe(36);
    expect(stats.fairwayPct).toBe(100);
    expect(stats.girPct).toBe(100);
  });

  it('scores by par bucket: par3/4/5 differentials', () => {
    const r = completedRound({ delta: 1 });
    const stats = careerStats([r], ME);
    expect(stats.scoringByPar.par3).toBe(1);
    expect(stats.scoringByPar.par4).toBe(1);
    expect(stats.scoringByPar.par5).toBe(1);
  });
});

describe('unofficialHandicapEstimate', () => {
  it('returns null with fewer than 3 rounds', () => {
    expect(unofficialHandicapEstimate([completedRound({}), completedRound({})], ME)).toBeNull();
  });

  it('produces an estimate from the best 8 of last 20', () => {
    const rounds = Array.from({ length: 10 }, (_, i) => completedRound({ delta: 1, id: `r_${i}` }));
    const est = unofficialHandicapEstimate(rounds, ME);
    expect(est).not.toBeNull();
    expect(est).toBeGreaterThan(0);
    // 10 rounds all +18 → best-8 avg = 18.0 (plainly labeled estimate)
    expect(est!).toBeCloseTo(18, 0);
  });
});
