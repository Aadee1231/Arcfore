import type {
  HoleScore,
  Round,
  RoundParticipant,
  RoundStats,
  TeeHoleInfo,
} from '@/types/domain';

/** Score relative to par for a single hole: -1 birdie, 0 par, +1 bogey. */
export function scoreToPar(strokes: number | null, par: number): number | null {
  if (strokes == null) return null;
  return strokes - par;
}

export function scoreName(strokes: number | null, par: number): string | null {
  if (strokes == null) return null;
  const diff = strokes - par;
  if (strokes === 1) return 'Hole in one';
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  if (diff === 3) return 'Triple bogey';
  return `+${diff}`;
}

/** Ordered list of hole numbers actually played (handles 9-hole and non-1 starts). */
export function playedHoleNumbers(round: Pick<Round, 'holesPlanned' | 'startingHole'>): number[] {
  const start = Math.min(Math.max(round.startingHole || 1, 1), 18);
  const holes: number[] = [];
  for (let i = 0; i < round.holesPlanned; i++) {
    holes.push(((start - 1 + i) % 18) + 1);
  }
  return holes;
}

export function holeInfoFor(round: Pick<Round, 'holeData'>, holeNumber: number): TeeHoleInfo | null {
  return round.holeData.find((h) => h.hole === holeNumber) ?? null;
}

export function findScore(
  scores: HoleScore[],
  participantId: string,
  holeNumber: number,
): HoleScore | null {
  return (
    scores.find((s) => s.participantId === participantId && s.holeNumber === holeNumber) ?? null
  );
}

/** Compute full stats for one participant over the played holes. */
export function participantStats(
  participant: RoundParticipant,
  round: Pick<Round, 'holesPlanned' | 'startingHole' | 'holeData'>,
  scores: HoleScore[],
): RoundStats {
  const holes = playedHoleNumbers(round);
  const mine = scores.filter((s) => s.participantId === participant.id);

  let totalStrokes = 0;
  let toPar = 0;
  let played = 0;
  let frontNine: number | null = 0;
  let backNine: number | null = 0;
  let puttsTotal = 0;
  let anyPutts = false;
  let girCount = 0;
  let girTracked = 0;
  let fairwaysHit = 0;
  let fairwaysTracked = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doublePlus = 0;

  for (const holeNumber of holes) {
    const info = holeInfoFor(round, holeNumber);
    const par = info?.par ?? null;
    const score = mine.find((s) => s.holeNumber === holeNumber);
    if (score == null || score.strokes == null) {
      // untracked hole → front/back sums stay partial
      if (holeNumber <= 9) frontNine = null;
      else backNine = null;
      continue;
    }
    played += 1;
    totalStrokes += score.strokes;
    if (par != null) {
      toPar += score.strokes - par;
      const diff = score.strokes - par;
      if (diff <= -2) eagles += 1;
      else if (diff === -1) birdies += 1;
      else if (diff === 0) pars += 1;
      else if (diff === 1) bogeys += 1;
      else doublePlus += 1;
    }
    if (frontNine != null && holeNumber <= 9) frontNine += score.strokes;
    if (backNine != null && holeNumber >= 10) backNine += score.strokes;
    if (score.putts != null) {
      puttsTotal += score.putts;
      anyPutts = true;
    }
    if (score.gir === true) {
      girCount += 1;
      girTracked += 1;
    } else if (score.gir === false) {
      girTracked += 1;
    }
    if (score.fairway === 'hit') {
      fairwaysHit += 1;
      fairwaysTracked += 1;
    } else if (score.fairway === 'left' || score.fairway === 'right') {
      fairwaysTracked += 1;
    }
  }

  return {
    participantId: participant.id,
    displayName: participant.displayName,
    holesPlayed: played,
    totalStrokes,
    toPar,
    frontNine,
    backNine,
    puttsTotal: anyPutts ? puttsTotal : null,
    girCount,
    girTracked,
    fairwaysHit,
    fairwaysTracked,
    eagles,
    birdies,
    pars,
    bogeys,
    doublePlus,
    completedAllHoles: played === holes.length,
  };
}

export function roundStats(
  round: Pick<Round, 'holesPlanned' | 'startingHole' | 'holeData' | 'participants'>,
  scores: HoleScore[],
): RoundStats[] {
  return round.participants.map((p) => participantStats(p, round, scores));
}

/** Format a to-par number: "E", "+2", "-1". */
export function formatToPar(toPar: number | null): string {
  if (toPar == null) return '—';
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

/** The next unplayed hole number for the round, or null when complete. */
export function nextUnplayedHole(
  round: Pick<Round, 'holesPlanned' | 'startingHole' | 'participants'>,
  scores: HoleScore[],
): number | null {
  const holes = playedHoleNumbers(round);
  for (const holeNumber of holes) {
    const complete = round.participants.every((p) => {
      const s = findScore(scores, p.id, holeNumber);
      return s != null && s.strokes != null;
    });
    if (!complete) return holeNumber;
  }
  return null;
}

export function isRoundComplete(
  round: Pick<Round, 'holesPlanned' | 'startingHole' | 'participants'>,
  scores: HoleScore[],
): boolean {
  return nextUnplayedHole(round, scores) === null;
}

/** Match-play helper: state of the match after each hole ("A 2 UP", "AS"). */
export function matchPlayState(
  a: HoleScore[],
  b: HoleScore[],
  holeData: TeeHoleInfo[],
): { leader: 'a' | 'b' | null; up: number; thru: number } {
  const byHole = new Map<number, { a: number | null; b: number | null }>();
  for (const s of a) {
    byHole.set(s.holeNumber, { ...(byHole.get(s.holeNumber) ?? { a: null, b: null }), a: s.strokes });
  }
  for (const s of b) {
    byHole.set(s.holeNumber, { ...(byHole.get(s.holeNumber) ?? { a: null, b: null }), b: s.strokes });
  }
  let diff = 0; // positive = a leads
  let thru = 0;
  const ordered = holeData.map((h) => h.hole).sort((x, y) => x - y);
  for (const holeNumber of ordered) {
    const cell = byHole.get(holeNumber);
    if (!cell || cell.a == null || cell.b == null) continue;
    thru += 1;
    if (cell.a < cell.b) diff += 1;
    else if (cell.b < cell.a) diff -= 1;
  }
  return {
    leader: diff === 0 ? null : diff > 0 ? 'a' : 'b',
    up: Math.abs(diff),
    thru,
  };
}
