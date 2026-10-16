import type { HoleScore, Round, RoundParticipant, TeeHoleInfo, UserClub } from '@/types/domain';

export function holeData18(parPattern?: number[]): TeeHoleInfo[] {
  const pars = parPattern ?? [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
  return pars.map((par, i) => ({
    hole: i + 1,
    par,
    yards: par === 3 ? 160 : par === 5 ? 520 : 380,
    handicap: i + 1,
    handicapWomen: i + 1,
  }));
}

let seq = 0;
export function pid(): string {
  seq += 1;
  return `p_${seq}`;
}

export function makeParticipant(over: Partial<RoundParticipant> = {}): RoundParticipant {
  return {
    id: over.id ?? pid(),
    userId: over.userId ?? null,
    displayName: over.displayName ?? 'Player',
    isGuest: over.isGuest ?? true,
    sortOrder: over.sortOrder ?? 0,
    teeLabel: over.teeLabel ?? null,
  };
}

export function makeRound(over: Partial<Round> = {}): Round {
  const now = new Date('2026-10-01T12:00:00Z').toISOString();
  return {
    id: over.id ?? 'round_1',
    ownerId: over.ownerId ?? 'u_owner',
    courseId: over.courseId ?? 'c_1',
    courseProvider: over.courseProvider ?? 'gca',
    courseProviderId: over.courseProviderId ?? '123',
    courseName: over.courseName ?? 'Test Golf Club',
    teeSetId: over.teeSetId ?? 't_1',
    teeName: over.teeName ?? 'White',
    teeColor: over.teeColor ?? '#FFFFFF',
    holesPlanned: over.holesPlanned ?? 18,
    startingHole: over.startingHole ?? 1,
    format: over.format ?? 'stroke',
    status: over.status ?? 'active',
    isMultiDevice: over.isMultiDevice ?? false,
    shareCode: over.shareCode ?? null,
    holeData: over.holeData ?? holeData18(),
    participants: over.participants ?? [makeParticipant({ displayName: 'Aadee' })],
    scores: over.scores ?? [],
    startedAt: over.startedAt ?? now,
    completedAt: over.completedAt ?? null,
    createdAt: over.createdAt ?? now,
    updatedAt: over.updatedAt ?? now,
  };
}

export function makeScore(participantId: string, holeNumber: number, over: Partial<HoleScore> = {}): HoleScore {
  return {
    participantId,
    holeNumber,
    strokes: 'strokes' in over ? (over.strokes ?? null) : 4,
    putts: over.putts ?? null,
    fairway: over.fairway ?? null,
    gir: over.gir ?? null,
    penalties: over.penalties ?? null,
    notes: over.notes ?? null,
    updatedAt: over.updatedAt ?? '2026-10-01T12:00:00Z',
  };
}

export function makeClub(over: Partial<UserClub> = {}): UserClub {
  return {
    id: over.id ?? `club_${(seq += 1)}`,
    userId: 'u_1',
    clubType: over.clubType ?? 'iron',
    name: over.name ?? '7-iron',
    brand: over.brand ?? null,
    model: over.model ?? null,
    carryYards: over.carryYards ?? null,
    totalYards: over.totalYards ?? null,
    confidence: over.confidence ?? 'medium',
    notes: over.notes ?? null,
    sortOrder: over.sortOrder ?? 0,
  };
}
