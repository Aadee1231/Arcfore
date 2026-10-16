import { getSupabase, isSupabaseReady } from '@/lib/supabase';
import { getOutbox, setOutbox, useActiveRound } from '@/store/activeRound';
import type { HoleScore, Round, RoundParticipant } from '@/types/domain';
import type { OutboxMutation } from '@/lib/offline/outbox';
import NetInfo from '@react-native-community/netinfo';

/**
 * Sync engine: drains the local outbox to Supabase and pulls remote changes
 * for multi-device rounds. Scores are upserts on
 * (round_id, participant_id, hole_number) so replays are idempotent.
 */

let flushing = false;
let unsubscribeNet: (() => void) | null = null;

export function initSyncEngine() {
  if (unsubscribeNet) return;
  unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected) void flushOutbox();
  });
}

export async function flushOutbox(): Promise<{ pushed: number; failed: boolean }> {
  if (flushing || !isSupabaseReady()) return { pushed: 0, failed: false };
  const net = await NetInfo.fetch();
  if (!net.isConnected) return { pushed: 0, failed: false };

  flushing = true;
  const store = useActiveRound.getState();
  store.setSyncing(true);
  let pushed = 0;
  try {
    const sb = getSupabase();
    let queue = getOutbox();
    const remaining: OutboxMutation[] = [];
    for (const m of queue) {
      try {
        await applyMutation(sb, m);
        pushed += 1;
      } catch {
        // Stop at first failure to preserve FIFO ordering; retry next flush.
        remaining.push(m);
        const idx = queue.indexOf(m);
        remaining.push(...queue.slice(idx + 1));
        break;
      }
    }
    setOutbox(remaining);
    store.setSyncing(false, null);
    return { pushed, failed: remaining.length > 0 && pushed === 0 };
  } catch (e) {
    store.setSyncing(false, e instanceof Error ? e.message : 'Sync failed');
    return { pushed, failed: true };
  } finally {
    flushing = false;
  }
}

async function applyMutation(sb: ReturnType<typeof getSupabase>, m: OutboxMutation) {
  if (m.kind === 'round_upsert') {
    const r = m.round;
    const { error } = await sb.from('rounds').upsert(
      {
        id: r.id,
        owner_id: r.ownerId,
        course_id: r.courseId,
        course_name: r.courseName,
        course_provider: r.courseProvider,
        course_provider_id: r.courseProviderId,
        tee_set_id: r.teeSetId,
        tee_name: r.teeName,
        tee_color: r.teeColor,
        holes_planned: r.holesPlanned,
        starting_hole: r.startingHole,
        format: r.format,
        status: r.status,
        is_multi_device: r.isMultiDevice,
        share_code: r.shareCode,
        hole_data: r.holeData,
        started_at: r.startedAt,
        completed_at: r.completedAt,
        updated_at: r.updatedAt,
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(error.message);
    return;
  }
  if (m.kind === 'participant_upsert') {
    const p = m.participant;
    const { error } = await sb.from('round_participants').upsert(
      {
        id: p.id,
        round_id: m.roundId,
        user_id: p.userId,
        display_name: p.displayName,
        is_guest: p.isGuest,
        sort_order: p.sortOrder,
        tee_label: p.teeLabel,
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(error.message);
    return;
  }
  // score_upsert
  const { error } = await sb.from('hole_scores').upsert(
    {
      round_id: m.roundId,
      participant_id: m.participantId,
      hole_number: m.holeNumber,
      strokes: m.patch.strokes ?? null,
      putts: m.patch.putts ?? null,
      fairway: m.patch.fairway ?? null,
      gir: m.patch.gir ?? null,
      penalties: m.patch.penalties ?? null,
      notes: m.patch.notes ?? null,
      updated_at: m.clientTs,
    },
    { onConflict: 'round_id,participant_id,hole_number', ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);
}

/** Fetch the remote round + participants + scores (join/share flows). */
export async function fetchRemoteRound(roundId: string) {
  const sb = getSupabase();
  const { data: roundRow, error: rErr } = await sb.from('rounds').select('*').eq('id', roundId).single();
  if (rErr) throw new Error(rErr.message);
  const { data: parts, error: pErr } = await sb
    .from('round_participants')
    .select('*')
    .eq('round_id', roundId)
    .order('sort_order');
  if (pErr) throw new Error(pErr.message);
  const { data: scores, error: sErr } = await sb
    .from('hole_scores')
    .select('*')
    .eq('round_id', roundId);
  if (sErr) throw new Error(sErr.message);
  return { roundRow, parts: parts ?? [], scores: (scores ?? []).map(rowToHoleScore) };
}

export function rowToHoleScore(row: Record<string, unknown>): HoleScore {
  return {
    participantId: row.participant_id as string,
    holeNumber: row.hole_number as number,
    strokes: row.strokes as number | null,
    putts: row.putts as number | null,
    fairway: row.fairway as HoleScore['fairway'],
    gir: row.gir as boolean | null,
    penalties: row.penalties as number | null,
    notes: row.notes as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function rowToRound(row: Record<string, unknown>, participants: RoundParticipant[], scores: HoleScore[]): Round {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    courseId: row.course_id as string | null,
    courseProvider: row.course_provider as string | null,
    courseProviderId: row.course_provider_id as string | null,
    courseName: row.course_name as string,
    teeSetId: row.tee_set_id as string | null,
    teeName: row.tee_name as string | null,
    teeColor: row.tee_color as string | null,
    holesPlanned: row.holes_planned as 9 | 18,
    startingHole: row.starting_hole as number,
    format: row.format as Round['format'],
    status: row.status as Round['status'],
    isMultiDevice: row.is_multi_device as boolean,
    shareCode: row.share_code as string | null,
    holeData: (row.hole_data as Round['holeData']) ?? [],
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    participants,
    scores,
  };
}

/** Map a round_participants row to the domain type. */
export function rowToParticipant(row: Record<string, unknown>): RoundParticipant {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    displayName: row.display_name as string,
    isGuest: row.is_guest as boolean,
    sortOrder: row.sort_order as number,
    teeLabel: (row.tee_label as string | null) ?? null,
  };
}

/** Fetch a round from Supabase and return the full domain object. */
export async function fetchRemoteRoundDomain(roundId: string): Promise<Round | null> {
  const { roundRow, parts, scores } = await fetchRemoteRound(roundId);
  if (!roundRow) return null;
  return rowToRound(
    roundRow as Record<string, unknown>,
    (parts as Record<string, unknown>[]).map(rowToParticipant),
    scores,
  );
}

/** Look up a joinable round by share code (for joining a friend's round). Returns the full domain round. */
export async function fetchRoundByShareCode(code: string): Promise<Round | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('rounds')
    .select('id')
    .eq('share_code', code.toUpperCase().trim())
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  return fetchRemoteRoundDomain(data.id as string);
}
