import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachContextBlock } from './gemini.js';

/**
 * Builds the coaching context for one user from Supabase — permission-scoped
 * (service role queried by user_id). The coach only ever sees this data.
 */
export async function buildCoachContext(
  sb: SupabaseClient,
  userId: string,
): Promise<CoachContextBlock> {
  const [profileRes, clubsRes, roundsRes, analysesRes, practiceRes, oneThingRes] =
    await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
      sb.from('user_clubs').select('*').eq('user_id', userId).order('sort_order'),
      sb
        .from('rounds')
        .select('id, course_name, holes_planned, status, started_at')
        .eq('owner_id', userId)
        .order('started_at', { ascending: false })
        .limit(8),
      sb
        .from('swing_analyses')
        .select('created_at, summary, video_quality, top_priority, confidence, improvements')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),
      sb
        .from('practice_sessions')
        .select('completed_at, duration_minutes, notes, drill_id')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(10),
      sb
        .from('one_thing_recommendations')
        .select('focus, explanation, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

  const p = profileRes.data;
  const profileSummary = p
    ? [
        `Name: ${p.display_name || 'unknown'}`,
        `Skill: ${p.skill_level}`,
        `Handedness: ${p.handedness}-handed`,
        `Goal: ${p.primary_goal || 'not set'}`,
        p.typical_score ? `Typical score: ${p.typical_score}` : 'Typical score: not recorded',
        `Units: ${p.units}`,
      ].join('; ')
    : 'No profile on file yet — skill level unknown.';

  const clubs = clubsRes.data ?? [];
  const bagSummary = clubs.length
    ? clubs
        .map(
          (c) =>
            `${c.name} (${c.club_type}): ` +
            (c.carry_yards != null ? `carry ~${c.carry_yards}yd` : 'carry not recorded') +
            (c.total_yards != null ? `, total ~${c.total_yards}yd` : '') +
            (c.confidence ? ` [confidence: ${c.confidence}]` : ''),
        )
        .join('\n')
    : 'No clubs recorded yet.';

  const rounds = roundsRes.data ?? [];
  let roundsSummary = 'No completed rounds on record.';
  if (rounds.length) {
    const lines: string[] = [];
    for (const r of rounds) {
      // aggregate their score row if they played as owner — quick stats
      const { data: parts } = await sb
        .from('round_participants')
        .select('id')
        .eq('round_id', r.id)
        .eq('user_id', userId);
      let total: number | null = null;
      let toPar: number | null = null;
      if (parts?.length) {
        const { data: scores } = await sb
          .from('hole_scores')
          .select('hole_number, strokes')
          .eq('round_id', r.id)
          .eq('participant_id', parts[0].id);
        const played = (scores ?? []).filter((s) => s.strokes != null);
        if (played.length) {
          total = played.reduce((a, s) => a + (s.strokes ?? 0), 0);
          const holeData = (r as Record<string, unknown>).hole_data as { hole: number; par: number }[] | undefined;
          if (Array.isArray(holeData)) {
            toPar = played.reduce((a, s) => {
              const par = holeData.find((h) => h.hole === s.hole_number)?.par ?? null;
              return a + (par != null ? (s.strokes ?? 0) - par : 0);
            }, 0);
          }
        }
      }
      lines.push(
        `${r.started_at?.slice(0, 10)} — ${r.course_name} (${r.holes_planned} holes, ${r.status})` +
          (total != null ? ` — ${total} strokes${toPar != null ? `, ${toPar >= 0 ? '+' : ''}${toPar} vs par` : ''}` : ''),
      );
    }
    roundsSummary = lines.join('\n');
  }

  const analyses = analysesRes.data ?? [];
  const analysesSummary = analyses.length
    ? analyses
        .map((a, i) => {
          const tp = a.top_priority as { title?: string } | null;
          return `Analysis ${i + 1} (${a.created_at?.slice(0, 10)}): ${a.summary ?? ''}` +
            (tp?.title ? ` — top priority: ${tp.title}` : '') +
            (a.confidence ? ` [confidence: ${a.confidence}]` : '');
        })
        .join('\n')
    : 'No swing analyses on record.';

  const practice = practiceRes.data ?? [];
  const ot = oneThingRes.data?.[0];
  const practiceSummary = [
    practice.length
      ? `Recent practice: ${practice.length} session(s), latest ${practice[0].completed_at?.slice(0, 10)}.`
      : 'No practice sessions logged yet.',
    ot?.focus ? `Current "One Thing" focus: ${ot.focus} (${ot.status})` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { profileSummary, bagSummary, roundsSummary, analysesSummary, practiceSummary };
}
