import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase, isSupabaseReady } from '@/lib/supabase';
import type {
  OneThingRecommendation,
  PracticeDrill,
  PracticeSession,
  Profile,
  Round,
  SwingAnalysis,
  UserClub,
 HoleScore } from '@/types/domain';
import { rowToHoleScore, rowToRound } from '@/lib/offline/sync';
import { config } from '@/lib/config';
import { DEMO_ANALYSES, DEMO_ONE_THING, DEMO_ROUNDS, DEMO_SESSIONS } from '@/lib/demo/data';

// ---------- profile ----------

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId && isSupabaseReady(),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        displayName: data.display_name,
        handedness: data.handedness,
        skillLevel: data.skill_level,
        primaryGoal: data.primary_goal,
        units: data.units,
        typicalScore: data.typical_score,
        avatarUrl: data.avatar_url,
        onboardedAt: data.onboarded_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
    staleTime: 60_000,
  });
}

export function useUpsertProfile(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!userId) throw new Error('Not signed in');
      const row = {
        id: userId,
        display_name: patch.displayName,
        handedness: patch.handedness,
        skill_level: patch.skillLevel,
        primary_goal: patch.primaryGoal,
        units: patch.units,
        typical_score: patch.typicalScore,
        avatar_url: patch.avatarUrl,
        onboarded_at: patch.onboardedAt,
      };
      const { error } = await getSupabase().from('profiles').upsert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

// ---------- rounds history ----------

export function useRounds(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['rounds', userId],
    // Demo mode shows preview data only when explicitly enabled — never stored.
    enabled: config.demoMode ? false : !!userId && isSupabaseReady(),
    initialData: config.demoMode ? DEMO_ROUNDS : undefined,
    queryFn: async (): Promise<Round[]> => {
      const sb = getSupabase();
      // rounds I own OR participate in
      const { data: participantRows, error: pErr } = await sb
        .from('round_participants')
        .select('round_id')
        .eq('user_id', userId!);
      if (pErr) throw pErr;
      const ids = [...new Set((participantRows ?? []).map((r) => r.round_id))];
      if (!ids.length) return [];

      const { data: rounds, error: rErr } = await sb
        .from('rounds')
        .select('*')
        .in('id', ids)
        .order('started_at', { ascending: false })
        .limit(50);
      if (rErr) throw rErr;
      const { data: parts, error: ppErr } = await sb
        .from('round_participants')
        .select('*')
        .in('round_id', ids);
      if (ppErr) throw ppErr;
      const { data: scores, error: sErr } = await sb
        .from('hole_scores')
        .select('*')
        .in('round_id', ids);
      if (sErr) throw sErr;

      return (rounds ?? []).map((row) => {
        const rp = (parts ?? [])
          .filter((p) => p.round_id === row.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({
            id: p.id,
            userId: p.user_id,
            displayName: p.display_name,
            isGuest: p.is_guest,
            sortOrder: p.sort_order,
            teeLabel: p.tee_label,
          }));
        const rs: HoleScore[] = (scores ?? [])
          .filter((s) => s.round_id === row.id)
          .map(rowToHoleScore);
        return rowToRound(row, rp, rs);
      });
    },
    staleTime: 30_000,
  });
}

// ---------- clubs ----------

export function useClubs(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['clubs', userId],
    enabled: !!userId && isSupabaseReady(),
    queryFn: async (): Promise<UserClub[]> => {
      const { data, error } = await getSupabase()
        .from('user_clubs')
        .select('*')
        .eq('user_id', userId!)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        clubType: c.club_type,
        name: c.name,
        brand: c.brand,
        model: c.model,
        carryYards: c.carry_yards,
        totalYards: c.total_yards,
        confidence: c.confidence,
        notes: c.notes,
        sortOrder: c.sort_order,
      }));
    },
  });
}

export function useClubMutations(userId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['clubs', userId] });
  const upsert = useMutation({
    mutationFn: async (club: Partial<UserClub> & { id?: string }) => {
      const row = {
        ...(club.id ? { id: club.id } : {}),
        user_id: userId,
        club_type: club.clubType,
        name: club.name,
        brand: club.brand ?? null,
        model: club.model ?? null,
        carry_yards: club.carryYards ?? null,
        total_yards: club.totalYards ?? null,
        confidence: club.confidence ?? null,
        notes: club.notes ?? null,
        sort_order: club.sortOrder ?? 0,
      };
      const { error } = await getSupabase().from('user_clubs').upsert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (clubId: string) => {
      const { error } = await getSupabase().from('user_clubs').delete().eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { upsert, remove };
}

// ---------- swing analyses ----------

export function useSwingAnalyses(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['analyses', userId],
    enabled: config.demoMode ? false : !!userId && isSupabaseReady(),
    initialData: config.demoMode ? DEMO_ANALYSES : undefined,
    queryFn: async (): Promise<SwingAnalysis[]> => {
      const { data, error } = await getSupabase()
        .from('swing_analyses')
        .select('*, swing_videos(storage_path, duration_seconds, camera_view, club_type)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        userId: a.user_id,
        videoId: a.video_id,
        status: a.status,
        model: a.model ?? '',
        summary: a.summary ?? '',
        videoQuality: a.video_quality ?? 'acceptable',
        perspective: a.perspective ?? 'unknown',
        strengths: a.strengths ?? [],
        improvements: a.improvements ?? [],
        topPriority: a.top_priority,
        drill: a.drill,
        phases: a.phases ?? [],
        confidence: a.confidence ?? 'medium',
        limitations: a.limitations ?? [],
        recordingTip: a.recording_tip,
        createdAt: a.created_at,
      }));
    },
  });
}

// ---------- practice ----------

export function useDrills() {
  return useQuery({
    queryKey: ['drills'],
    enabled: isSupabaseReady(),
    queryFn: async (): Promise<PracticeDrill[]> => {
      const { data, error } = await getSupabase().from('practice_drills').select('*').order('skill');
      if (error) throw error;
      return (data ?? []) as PracticeDrill[];
    },
    staleTime: 300_000,
  });
}

export function usePracticeSessions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['practice', userId],
    enabled: config.demoMode ? false : !!userId && isSupabaseReady(),
    initialData: config.demoMode ? DEMO_SESSIONS : undefined,
    queryFn: async (): Promise<PracticeSession[]> => {
      const { data, error } = await getSupabase()
        .from('practice_sessions')
        .select('*')
        .eq('user_id', userId!)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PracticeSession[];
    },
  });
}

export function useLogPractice(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { drillId: string; durationMinutes?: number; notes?: string; repsCompleted?: number }) => {
      const { error } = await getSupabase().from('practice_sessions').insert({
        user_id: userId,
        drill_id: input.drillId,
        duration_minutes: input.durationMinutes ?? null,
        notes: input.notes ?? null,
        reps_completed: input.repsCompleted ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', userId] }),
  });
}

// ---------- one thing ----------

export function useOneThing(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['oneThing', userId],
    enabled: config.demoMode ? false : !!userId && isSupabaseReady(),
    initialData: config.demoMode ? DEMO_ONE_THING : undefined,
    queryFn: async (): Promise<OneThingRecommendation | null> => {
      const { data, error } = await getSupabase()
        .from('one_thing_recommendations')
        .select('*, practice_drills(name)')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        focus: data.focus,
        explanation: data.explanation,
        drillId: data.drill_id,
        drillName: data.drill_name ?? data.practice_drills?.name ?? null,
        status: data.status,
        source: data.source,
        createdAt: data.created_at,
      };
    },
  });
}

export function useResolveOneThing(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'improved' | 'dismissed' }) => {
      const { error } = await getSupabase()
        .from('one_thing_recommendations')
        .update({ status: input.status, resolved_at: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oneThing', userId] }),
  });
}
