import type { UserClub } from '@/types/domain';

export interface ClubRecommendation {
  club: UserClub;
  /** Why this club was picked — always grounded in recorded data. */
  explanation: string;
  /** True when the pick is an extrapolation (sparse data). */
  estimated: boolean;
  /** Alternates within the distance window, closest first. */
  alternates: { club: UserClub; difference: number }[];
}

/**
 * Recommend a club for a target carry distance using the player's recorded bag.
 * Pure function — unit-tested. Never invents distances.
 */
export function recommendClub(
  bag: UserClub[],
  targetYards: number,
  opts?: { preferConservative?: boolean; excludeTypes?: string[] },
): ClubRecommendation | null {
  const excluded = new Set(opts?.excludeTypes ?? ['putter']);
  const candidates = bag.filter(
    (c) => !excluded.has(c.clubType) && (c.carryYards != null || c.totalYards != null),
  );
  if (candidates.length === 0) return null;

  const withDist = candidates
    .map((c) => {
      const dist = c.carryYards ?? c.totalYards!;
      const metric = c.carryYards != null ? 'carry' : 'total';
      const diff = dist - targetYards; // positive = club goes further than target
      return { c, dist, metric, diff };
    })
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

  const conservative = opts?.preferConservative ?? false;
  let pick = withDist[0];
  if (conservative) {
    // Prefer the club that covers the target (slightly long) over coming up short.
    // Prefer the tightest club that still covers the target (least overshoot).
    const covering = withDist.filter((d) => d.diff >= 0);
    if (covering.length) pick = covering[0];
  }

  const conf = pick.c.confidence;
  const confNote =
    conf === 'low' ? ' (your distance confidence for this club is low)' : '';
  const explanation =
    `Your recorded ${pick.c.name} ${pick.metric} is about ${pick.dist} yards` +
    `${pick.diff === 0 ? ', matching' : pick.diff > 0 ? `, ${pick.diff} yards more than` : `, ${Math.abs(pick.diff)} yards less than`}` +
    ` the ${targetYards}-yard target.${confNote}`;

  return {
    club: pick.c,
    explanation,
    estimated: pick.c.carryYards == null || conf === 'low',
    alternates: withDist
      .filter((d) => d.c.id !== pick.c.id)
      .slice(0, 3)
      .map((d) => ({ club: d.c, difference: d.diff })),
  };
}

/** Sensible default bag skeleton for onboarding ("add my clubs later" fills names only). */
export const DEFAULT_BAG_SKELETON: { clubType: UserClub['clubType']; name: string }[] = [
  { clubType: 'driver', name: 'Driver' },
  { clubType: 'wood', name: '3 Wood' },
  { clubType: 'hybrid', name: 'Hybrid' },
  { clubType: 'iron', name: '4 Iron' },
  { clubType: 'iron', name: '5 Iron' },
  { clubType: 'iron', name: '6 Iron' },
  { clubType: 'iron', name: '7 Iron' },
  { clubType: 'iron', name: '8 Iron' },
  { clubType: 'iron', name: '9 Iron' },
  { clubType: 'wedge', name: 'Pitching Wedge' },
  { clubType: 'wedge', name: 'Gap Wedge' },
  { clubType: 'wedge', name: 'Sand Wedge' },
  { clubType: 'wedge', name: 'Lob Wedge' },
  { clubType: 'putter', name: 'Putter' },
];
