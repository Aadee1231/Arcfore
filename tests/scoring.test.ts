import { describe, expect, it } from 'vitest';
import {
  findScore,
  formatToPar,
  isRoundComplete,
  matchPlayState,
  nextUnplayedHole,
  participantStats,
  playedHoleNumbers,
  scoreName,
  scoreToPar,
} from '@/lib/scoring/engine';
import { holeData18, makeParticipant, makeRound, makeScore } from './fixtures';

describe('scoreToPar / scoreName / formatToPar', () => {
  it('computes relative-to-par correctly', () => {
    expect(scoreToPar(3, 4)).toBe(-1);
    expect(scoreToPar(4, 4)).toBe(0);
    expect(scoreToPar(6, 5)).toBe(1);
    expect(scoreToPar(null, 4)).toBeNull();
  });

  it('names scores correctly', () => {
    expect(scoreName(1, 3)).toBe('Hole in one');
    expect(scoreName(2, 5)).toBe('Albatross');
    expect(scoreName(3, 5)).toBe('Eagle');
    expect(scoreName(2, 3)).toBe('Birdie');
    expect(scoreName(4, 4)).toBe('Par');
    expect(scoreName(5, 4)).toBe('Bogey');
    expect(scoreName(6, 4)).toBe('Double bogey');
    expect(scoreName(7, 4)).toBe('Triple bogey');
    expect(scoreName(8, 4)).toBe('+4');
    expect(scoreName(null, 4)).toBeNull();
  });

  it('formats to-par', () => {
    expect(formatToPar(0)).toBe('E');
    expect(formatToPar(-2)).toBe('-2');
    expect(formatToPar(3)).toBe('+3');
    expect(formatToPar(null)).toBe('—');
  });
});

describe('playedHoleNumbers', () => {
  it('returns 1–18 for a full round', () => {
    expect(playedHoleNumbers(makeRound())).toHaveLength(18);
    expect(playedHoleNumbers(makeRound())[17]).toBe(18);
  });

  it('returns front nine for 9-hole round starting on 1', () => {
    const r = makeRound({ holesPlanned: 9, startingHole: 1 });
    expect(playedHoleNumbers(r)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns back nine for 9-hole round starting on 10', () => {
    const r = makeRound({ holesPlanned: 9, startingHole: 10 });
    expect(playedHoleNumbers(r)[0]).toBe(10);
    expect(playedHoleNumbers(r)).toHaveLength(9);
  });
});

describe('participantStats', () => {
  it('totals strokes, to-par, and front/back nine for a multi-player round', () => {
    const a = makeParticipant({ displayName: 'Aadee' });
    const b = makeParticipant({ displayName: 'Rehan' });
    const round = makeRound({ participants: [a, b] });
    // A: birdie on 1, par on 2; B: 5,6
    const scores = [
      makeScore(a.id, 1, { strokes: 3, putts: 1, fairway: 'hit', gir: true }),
      makeScore(a.id, 2, { strokes: 5, putts: 2, fairway: 'left', gir: false }),
      makeScore(b.id, 1, { strokes: 5 }),
      makeScore(b.id, 2, { strokes: 6 }),
    ];
    const sa = participantStats(a, round, scores);
    expect(sa.totalStrokes).toBe(8);
    expect(sa.toPar).toBe(-1); // -1 birdie, 0 par(5→0)
    expect(sa.frontNine).toBeNull(); // holes 3–9 unplayed → partial nine is null
    expect(sa.backNine).toBeNull(); // no back-nine holes played yet
    expect(sa.puttsTotal).toBe(3);
    expect(sa.fairwaysHit).toBe(1);
    expect(sa.fairwaysTracked).toBe(2);
    expect(sa.girCount).toBe(1);
    expect(sa.birdies).toBe(1);
    expect(sa.pars).toBe(1);

    const sb = participantStats(b, round, scores);
    expect(sb.totalStrokes).toBe(11);
    expect(sb.toPar).toBe(2);
    expect(sb.puttsTotal).toBeNull(); // never tracked
  });

  it('handles score edits: latest patch fields win', () => {
    const p = makeParticipant();
    const round = makeRound({ participants: [p] });
    const edited = [makeScore(p.id, 1, { strokes: 3, updatedAt: '2026-10-01T12:05:00Z' })];
    const stats = participantStats(p, round, edited);
    expect(stats.totalStrokes).toBe(3);
    expect(stats.toPar).toBe(-1);
  });

  it('respects par-3 holes for fairway tracking semantics', () => {
    const p = makeParticipant();
    const round = makeRound({ participants: [p], holesPlanned: 9 });
    const scores = [makeScore(p.id, 3, { strokes: 3, fairway: 'na' })]; // par 3 hole
    const stats = participantStats(p, round, scores);
    expect(stats.fairwaysTracked).toBe(0); // 'na' not tracked
  });
});

describe('round completion', () => {
  it('detects a complete round only when every hole has strokes', () => {
    const p = makeParticipant();
    const round = makeRound({ participants: [p], holesPlanned: 9 });
    const partial = [makeScore(p.id, 1), makeScore(p.id, 2)];
    expect(isRoundComplete(round, partial)).toBe(false);
    const full = Array.from({ length: 9 }, (_, i) => makeScore(p.id, i + 1));
    expect(isRoundComplete(round, full)).toBe(true);
    // a null-strokes cell blocks completion
    const withNull = [...full.slice(0, 8), makeScore(p.id, 9, { strokes: null })];
    expect(isRoundComplete(round, withNull)).toBe(false);
  });

  it('finds the next unplayed hole respecting starting hole', () => {
    const p = makeParticipant();
    const round = makeRound({ participants: [p], holesPlanned: 9, startingHole: 10 });
    expect(nextUnplayedHole(round, [makeScore(p.id, 10)])).toBe(11);
    const full = Array.from({ length: 9 }, (_, i) => makeScore(p.id, i + 10));
    expect(nextUnplayedHole(round, full)).toBeNull();
  });
});

describe('match play', () => {
  it('computes holes-up and thru', () => {
    const a = makeParticipant();
    const b = makeParticipant();
    const holeData = holeData18().slice(0, 4);
    const scoresA = [makeScore(a.id, 1, { strokes: 3 }), makeScore(a.id, 2, { strokes: 6 })];
    const scoresB = [makeScore(b.id, 1, { strokes: 4 }), makeScore(b.id, 2, { strokes: 4 })];
    const m = matchPlayState(scoresA, scoresB, holeData);
    expect(m.leader).toBeNull(); // a won h1, lost h2 → AS
    expect(m.thru).toBe(2);
    const m2 = matchPlayState(scoresA, [makeScore(b.id, 1, { strokes: 5 })], holeData);
    expect(m2.leader).toBe('a');
    expect(m2.up).toBe(1);
  });
});

describe('findScore', () => {
  it('locates a cell by participant+hole', () => {
    const s = makeScore('p1', 5, { strokes: 3 });
    expect(findScore([s], 'p1', 5)?.strokes).toBe(3);
    expect(findScore([s], 'p1', 6)).toBeNull();
  });
});
