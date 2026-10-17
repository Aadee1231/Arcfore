import * as repo from '@/lib/db/repo';
import type {
    CoachMessage,
    Profile,
    UserClub
} from '@/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Local-first data hooks — everything reads/writes the on-device SQLite DB.
 * The `userId` params that used to scope Supabase queries are accepted for
 * call-site compatibility but ignored (one local profile per device).
 */

// ---------- profile ----------

export function useProfile(_userId?: string | null) {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => repo.getProfile(),
    staleTime: 60_000,
  });
}

export function useUpsertProfile(_userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => repo.upsertProfile(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

// ---------- rounds history ----------

export function useRounds(_userId?: string | null) {
  return useQuery({
    queryKey: ['rounds'],
    queryFn: () => repo.listRounds(),
    staleTime: 15_000,
  });
}

export function useRound(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round', roundId],
    queryFn: () => repo.getRound(roundId!),
    enabled: !!roundId,
    staleTime: 15_000,
  });
}

// ---------- clubs ----------

export function useClubs(_userId?: string | null) {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: () => repo.listClubs(),
  });
}

export function useClubMutations(_userId?: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['clubs'] });
  const upsert = useMutation({
    mutationFn: (club: Partial<UserClub> & { id?: string }) => repo.upsertClub(club),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (clubId: string) => repo.deleteClub(clubId),
    onSuccess: invalidate,
  });
  return { upsert, remove };
}

// ---------- swing analyses ----------

export function useSwingAnalyses(_userId?: string | null) {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: () => repo.listSwingAnalyses(),
  });
}

export function useSwingAnalysis(id: string | undefined) {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => repo.getSwingAnalysis(id!),
    enabled: !!id,
  });
}

// ---------- practice ----------

export function useDrills() {
  return useQuery({
    queryKey: ['drills'],
    queryFn: () => repo.listDrills(),
    staleTime: 300_000,
  });
}

export function usePracticeSessions(_userId?: string | null) {
  return useQuery({
    queryKey: ['practice'],
    queryFn: () => repo.listPracticeSessions(),
  });
}

export function useLogPractice(_userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { drillId: string; durationMinutes?: number; notes?: string; repsCompleted?: number }) =>
      repo.logPracticeSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice'] }),
  });
}

// ---------- one thing ----------

export function useOneThing(_userId?: string | null) {
  return useQuery({
    queryKey: ['oneThing'],
    queryFn: () => repo.getActiveOneThing(),
  });
}

export function useResolveOneThing(_userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'improved' | 'dismissed' }) =>
      repo.resolveOneThing(input.id, input.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oneThing'] }),
  });
}

// ---------- coach conversations ----------

export function useConversations(_userId?: string | null) {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => repo.listConversations(),
  });
}

export function useConversationMessages(conversationId: string | null | undefined) {
  return useQuery<CoachMessage[]>({
    queryKey: ['conversation', conversationId],
    queryFn: () => repo.getConversationMessages(conversationId!),
    enabled: !!conversationId,
  });
}
