import { getSupabase, isSupabaseReady } from '@/lib/supabase';
import { rowToHoleScore } from '@/lib/offline/sync';
import { useActiveRound } from '@/store/activeRound';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Round } from '@/types/domain';

/**
 * Live multi-device sync: subscribe to postgres changes for the active round.
 * Incoming score rows are merged into local state by updatedAt (LWW).
 */
export function subscribeToRound(roundId: string): RealtimeChannel | null {
  if (!isSupabaseReady()) return null;
  const sb = getSupabase();

  const channel = sb
    .channel(`round:${roundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'hole_scores', filter: `round_id=eq.${roundId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row) return;
        const score = rowToHoleScore(row);
        useActiveRound.getState().applyRemoteScores([score]);
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_participants', filter: `round_id=eq.${roundId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) return;
        const store = useActiveRound.getState();
        const round = store.round;
        if (!round) return;
        const participant = {
          id: row.id as string,
          userId: row.user_id as string | null,
          displayName: row.display_name as string,
          isGuest: row.is_guest as boolean,
          sortOrder: row.sort_order as number,
          teeLabel: row.tee_label as string | null,
        };
        const exists = round.participants.some((p) => p.id === participant.id);
        if (!exists) {
          store.adoptRound({
            ...round,
            participants: [...round.participants, participant].sort(
              (a, b) => a.sortOrder - b.sortOrder,
            ),
          });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) return;
        const store = useActiveRound.getState();
        const round = store.round;
        if (!round || round.id !== roundId) return;
        // Remote status change (e.g. someone completed the round)
        if (row.status !== round.status) {
          store.adoptRound({
            ...round,
            status: row.status as Round['status'],
            completedAt: row.completed_at as string | null,
          });
        }
      },
    )
    .subscribe();
  return channel;
}
