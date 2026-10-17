import * as repo from '@/lib/db/repo';
import { participantStats } from '@/lib/scoring/engine';
import type { CoachContextBlock } from '@/lib/api/ai';
import { LOCAL_USER_ID } from '@/lib/db/database';

/**
 * Builds the coaching context from the local DB — the coach only ever sees
 * this data, and only what the user has actually recorded.
 */
export async function buildCoachContext(): Promise<CoachContextBlock> {
  const [profile, clubs, rounds, analyses, sessions, oneThing] = await Promise.all([
    repo.getProfile(),
    repo.listClubs(),
    repo.listRounds(undefined, 8),
    repo.listSwingAnalyses(),
    repo.listPracticeSessions(),
    repo.getActiveOneThing(),
  ]);

  const profileSummary = profile
    ? [
        `Name: ${profile.displayName || 'unknown'}`,
        `Skill: ${profile.skillLevel}`,
        `Handedness: ${profile.handedness}-handed`,
        `Goal: ${profile.primaryGoal || 'not set'}`,
        profile.typicalScore ? `Typical score: ${profile.typicalScore}` : 'Typical score: not recorded',
        `Units: ${profile.units}`,
      ].join('; ')
    : 'No profile on file yet — skill level unknown.';

  const bagSummary = clubs.length
    ? clubs
        .map(
          (c) =>
            `${c.name} (${c.clubType}): ` +
            (c.carryYards != null ? `carry ~${c.carryYards}yd` : 'carry not recorded') +
            (c.totalYards != null ? `, total ~${c.totalYards}yd` : '') +
            (c.confidence ? ` [confidence: ${c.confidence}]` : ''),
        )
        .join('\n')
    : 'No clubs recorded yet.';

  const roundsSummary = rounds.length
    ? rounds
        .map((r) => {
          const me = r.participants.find((p) => p.userId === LOCAL_USER_ID) ?? r.participants[0];
          const s = me ? participantStats(me, r, r.scores) : null;
          return (
            `${r.startedAt.slice(0, 10)} — ${r.courseName} (${r.holesPlanned} holes, ${r.status})` +
            (s && s.holesPlayed > 0
              ? ` — ${s.totalStrokes} strokes, ${s.toPar >= 0 ? '+' : ''}${s.toPar} vs par`
              : '')
          );
        })
        .join('\n')
    : 'No completed rounds on record.';

  const analysesSummary = analyses.length
    ? analyses
        .slice(0, 5)
        .map(
          (a, i) =>
            `Analysis ${i + 1} (${a.createdAt.slice(0, 10)}): ${a.summary}` +
            (a.topPriority?.title ? ` — top priority: ${a.topPriority.title}` : '') +
            ` [confidence: ${a.confidence}]`,
        )
        .join('\n')
    : 'No swing analyses on record.';

  const practiceSummary = [
    sessions.length
      ? `Recent practice: ${sessions.length} session(s), latest ${sessions[0].completedAt.slice(0, 10)}.`
      : 'No practice sessions logged yet.',
    oneThing?.focus ? `Current "One Thing" focus: ${oneThing.focus} (${oneThing.status})` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { profileSummary, bagSummary, roundsSummary, analysesSummary, practiceSummary };
}
