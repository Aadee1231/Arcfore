import { getActiveRound, getRound, saveRound } from '@/lib/db/repo';
import type { Round } from '@/types/domain';

/**
 * Local persistence facade for the active-round store.
 * (Kept under lib/offline — this used to be the Supabase sync engine; every
 * write now lands in the on-device SQLite DB instead.)
 */

/** Initialize: nothing to wire — kept for the boot call-site. */
export function initPersistence() {
  // no-op: writes go straight to SQLite via repo helpers
}

export async function loadActiveRound(): Promise<Round | null> {
  return getActiveRound();
}

export async function persistRound(round: Round): Promise<void> {
  await saveRound(round);
}

/** Fetch a round from the local DB (summary/share/history screens). */
export async function fetchLocalRound(roundId: string): Promise<Round | null> {
  return getRound(roundId);
}
