import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthUser } from '@/lib/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronRight,
  Flag,
  Hand,
  LogOut,
  Ruler,
  Trash2,
  } from 'lucide-react-native';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { useProfile } from '@/lib/hooks/data';
import { getSupabase, isSupabaseReady } from '@/lib/supabase';
import { isClerkConfigured } from '@/lib/config';
import type { SkillLevel, Units } from '@/types/domain';

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Card onPress={onPress} style={styles.rowCard}>
      <View style={styles.rowInner}>
        {icon}
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {label}
        </Text>
        {value ? (
          <Text variant="body" secondary>
            {value}
          </Text>
        ) : null}
        {onPress ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { userId, signOut } = useAuthUser();
  const { displayName, email: authEmail } = useAuthUser();
  const profile = useProfile(isClerkConfigured() ? userId : null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const updateUnits = useMutation({
    mutationFn: async (units: Units) => {
      if (!userId || !isSupabaseReady()) return;
      const { error } = await getSupabase().from('profiles').update({ units }).eq('id', userId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });

  const updateSkill = useMutation({
    mutationFn: async (skill_level: SkillLevel) => {
      if (!userId || !isSupabaseReady()) return;
      const { error } = await getSupabase().from('profiles').update({ skill_level }).eq('id', userId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });

  const onSignOut = () => {
    Alert.alert('Sign out?', 'Your data stays on this device and in your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await signOut().catch(() => undefined);
          setBusy(false);
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your profile, rounds, swing videos, and analyses. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Contact support', 'Email support@aadeec.com with subject "Delete Arcfore account" and your account will be fully removed within 7 days.'),
        },
      ],
    );
  };

  const p = profile.data;
  const name = p?.displayName ?? displayName ?? 'Golfer';
  const email = authEmail;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.forest }]}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text variant="title">{name}</Text>
        {email ? (
          <Text variant="body" secondary>
            {email}
          </Text>
        ) : null}
        {p?.primaryGoal ? (
          <Text variant="caption" secondary>
            Goal: {p.primaryGoal}
          </Text>
        ) : null}
      </View>

      <SectionHeader title="Golf" />
      <Row
        icon={<Flag size={18} color={colors.forest} />}
        label="Skill level"
        onPress={() => undefined}
      />
      <View style={styles.pad}>
        <SegmentedControl
          options={(['beginner', 'intermediate', 'advanced', 'scratch'] as SkillLevel[]).map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
          }))}
          value={p?.skillLevel ?? 'intermediate'}
          onChange={(v) => updateSkill.mutate(v)}
        />
      </View>
      <Row
        icon={<Hand size={18} color={colors.forest} />}
        label="Dominant hand"
        value={p?.handedness === 'left' ? 'Left' : 'Right'}
        onPress={() => router.push('/profile/edit')}
      />
      <Row
        icon={<Ruler size={18} color={colors.forest} />}
        label="My bag"
        value={`${''}`}
        onPress={() => router.push('/bag')}
      />

      <SectionHeader title="Preferences" />
      <View style={styles.pad}>
        <Text variant="label" secondary>
          Distance units
        </Text>
        <SegmentedControl
          options={[
            { value: 'yards', label: 'Yards' },
            { value: 'meters', label: 'Meters' },
          ]}
          value={p?.units ?? 'yards'}
          onChange={(v) => updateUnits.mutate(v)}
        />
      </View>
      <Row
        icon={<BookOpen size={18} color={colors.forest} />}
        label="Privacy & terms"
        onPress={() => router.push('/legal')}
      />

      <SectionHeader title="Account" />
      <Card>
        <Button
          title={busy ? 'Signing out…' : 'Sign out'}
          variant="outline"
          fullWidth
          loading={busy}
          icon={<LogOut size={16} color={colors.text} />}
          onPress={onSignOut}
        />
      </Card>
      <Card>
        <Button
          title="Delete account"
          variant="ghost"
          fullWidth
          icon={<Trash2 size={16} color={colors.danger} />}
          onPress={onDelete}
        />
      </Card>

      <Text variant="micro" secondary center style={{ marginTop: spacing.xl }}>
        Arcfore · Your game. Understood.
      </Text>
      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.xs },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#F7F4EC' },
  rowCard: { marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pad: { marginBottom: spacing.sm, gap: spacing.xs },
});
