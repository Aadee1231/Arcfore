import type { HoleScore, Round, RoundStats } from '@/types/domain';
import { participantStats, playedHoleNumbers } from '@/lib/scoring/engine';

/** Aggregates across completed rounds — only real recorded data, no fabrication. */
export interface CareerStats {
  roundsCompleted: number;
  rounds18: number;
  rounds9: number;
  averageScore18: number | null; // avg total strokes over 18-hole complete rounds
  averageToPar: number | null; // avg to-par across complete rounds (normalized to holes played)
  bestRoundToPar: { roundId: string; toPar: number; strokes: number; courseName: string; date: string } | null;
  averagePutts: number | null;
  fairwayPct: number | null;
  girPct: number | null;
  scoringByPar: { par3: number | null; par4: number | null; par5: number | null }; // avg strokes-to-par per hole type
  birdieRate: number | null;
  parRate: number | null;
  bogeyRate: number | null;
  trend: { date: string; toPar: number; label: string }[]; // chronological
  coursesPlayed: { courseName: string; rounds: number; bestToPar: number | null }[];
}

export interface RoundLike {
  round: Round;
  scores: HoleScore[];
}

/**
 * Compute career stats for a specific user (participant.userId) across rounds.
 * Only rounds with status 'completed' count. 9- and 18-hole rounds are
 * distinguished; averageScore18 only uses complete 18-hole rounds.
 */
export function careerStats(rounds: RoundLike[], userId: string): CareerStats {
  const completed = rounds.filter((r) => r.round.status === 'completed');
  const perRound: { round: Round; stats: RoundStats }[] = [];

  for (const { round, scores } of completed) {
    const me = round.participants.find((p) => p.userId === userId);
    if (!me) continue;
    perRound.push({ round, stats: participantStats(me, round, scores) });
  }

  const complete18 = perRound.filter((p) => p.round.holesPlanned === 18 && p.stats.completedAllHoles);
  const complete9 = perRound.filter((p) => p.round.holesPlanned === 9 && p.stats.completedAllHoles);

  // Average to-par normalized per hole played, projected over all rounds
  let totalToPar = 0;
  let totalHoles = 0;
  let puttsSum = 0;
  let puttsRounds = 0;
  let fwHit = 0;
  let fwTracked = 0;
  let girHit = 0;
  let girTracked = 0;
  let birdies = 0, pars = 0, bogeys = 0, holesScored = 0;
  const byPar: Record<3 | 4 | 5, { strokes: number; parTotal: number; count: number }> = {
    3: { strokes: 0, parTotal: 0, count: 0 },
    4: { strokes: 0, parTotal: 0, count: 0 },
    5: { strokes: 0, parTotal: 0, count: 0 },
  };
  let best: CareerStats['bestRoundToPar'] = null;
  const trend: CareerStats['trend'] = [];
  const courseMap = new Map<string, { rounds: number; bestToPar: number | null }>();

  const sorted = [...perRound].sort(
    (a, b) => new Date(a.round.startedAt).getTime() - new Date(b.round.startedAt).getTime(),
  );

  for (const { round, stats } of sorted) {
    totalToPar += stats.toPar;
    totalHoles += stats.holesPlayed;
    if (stats.puttsTotal != null) {
      puttsSum += stats.puttsTotal;
      puttsRounds += 1;
    }
    fwHit += stats.fairwaysHit;
    fwTracked += stats.fairwaysTracked;
    girHit += stats.girCount;
    girTracked += stats.girTracked;
    birdies += stats.birdies;
    pars += stats.pars;
    bogeys += stats.bogeys;
    holesScored += stats.holesPlayed;

    if (stats.completedAllHoles) {
      if (best == null || stats.toPar < best.toPar) {
        best = {
          roundId: round.id,
          toPar: stats.toPar,
          strokes: stats.totalStrokes,
          courseName: round.courseName,
          date: round.startedAt,
        };
      }
      trend.push({
        date: round.startedAt,
        toPar: stats.toPar,
        label: round.courseName,
      });
    }

    const c = courseMap.get(round.courseName) ?? { rounds: 0, bestToPar: null };
    c.rounds += 1;
    if (stats.completedAllHoles && (c.bestToPar == null || stats.toPar < c.bestToPar)) {
      c.bestToPar = stats.toPar;
    }
    courseMap.set(round.courseName, c);

    // Per-par scoring
    const holes = playedHoleNumbers(round);
    const mine = new Map<number, HoleScore>();
    for (const s of rounds.find((r) => r.round.id === round.id)?.scores ?? []) {
      if (s.participantId === stats.participantId) mine.set(s.holeNumber, s);
    }
    for (const holeNumber of holes) {
      const info = round.holeData.find((h) => h.hole === holeNumber);
      const score = mine.get(holeNumber);
      if (!info || !score || score.strokes == null) continue;
      const bucket = info.par === 3 ? byPar[3] : info.par === 4 ? byPar[4] : info.par === 5 ? byPar[5] : null;
      if (bucket) {
        bucket.strokes += score.strokes;
        bucket.parTotal += info.par;
        bucket.count += 1;
      }
    }
  }

  const avg = (num: number, den: number) => (den > 0 ? num / den : null);
  const avg18List = complete18.map((p) => p.stats.totalStrokes);

  return {
    roundsCompleted: perRound.length,
    rounds18: complete18.length,
    rounds9: complete9.length,
    averageScore18: avg18List.length ? avg(avg18List.reduce((a, b) => a + b, 0), avg18List.length) : null,
    averageToPar: avg(totalToPar, totalHoles) != null ? avg(totalToPar, totalHoles)! * 18 : null, // per-18-holes basis
    bestRoundToPar: best,
    averagePutts: puttsRounds > 0 ? avg(puttsSum, puttsRounds) : null,
    fairwayPct: fwTracked > 0 ? (fwHit / fwTracked) * 100 : null,
    girPct: girTracked > 0 ? (girHit / girTracked) * 100 : null,
    scoringByPar: {
      par3: byPar[3].count ? byPar[3].strokes / byPar[3].count - 3 : null,
      par4: byPar[4].count ? byPar[4].strokes / byPar[4].count - 4 : null,
      par5: byPar[5].count ? byPar[5].strokes / byPar[5].count - 5 : null,
    },
    birdieRate: holesScored ? (birdies / holesScored) * 100 : null,
    parRate: holesScored ? (pars / holesScored) * 100 : null,
    bogeyRate: holesScored ? (bogeys / holesScored) * 100 : null,
    trend,
    coursesPlayed: [...courseMap.entries()].map(([courseName, v]) => ({
      courseName,
      rounds: v.rounds,
      bestToPar: v.bestToPar,
    })),
  };
}

/** One-line, honest unofficial handicap-style estimate: best-8 avg to-par over last 20 complete rounds. */
export function unofficialHandicapEstimate(rounds: RoundLike[], userId: string): number | null {
  const completed = rounds
    .filter((r) => r.round.status === 'completed')
    .sort((a, b) => new Date(b.round.startedAt).getTime() - new Date(a.round.startedAt).getTime())
    .slice(0, 20);
  const diffs: number[] = [];
  for (const { round, scores } of completed) {
    const me = round.participants.find((p) => p.userId === userId);
    if (!me) continue;
    const stats = participantStats(me, round, scores);
    if (!stats.completedAllHoles) continue;
    diffs.push(round.holesPlanned === 9 ? stats.toPar * 2 : stats.toPar); // normalize 9→18
  }
  if (diffs.length < 3) return null;
  diffs.sort((a, b) => a - b);
  const best8 = diffs.slice(0, Math.min(8, diffs.length));
  return Math.round((best8.reduce((a, b) => a + b, 0) / best8.length) * 10) / 10;
}
