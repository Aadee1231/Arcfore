import { useAuthUser } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
    BookOpen,
    ChevronRight,
    Download,
    Flag,
    Hand,
    LogOut,
    Ruler,
    Trash2
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Chip';
import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { clearAllData, exportBackup } from '@/lib/db/repo';
import { useProfile, useUpsertProfile } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import type { SkillLevel } from '@/types/domain';

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
  const { signOut, isSignedIn } = useAuthUser();
  const { displayName, email: authEmail } = useAuthUser();
  const profile = useProfile();
  const upsert = useUpsertProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const onSignOut = () => {
    Alert.alert('Sign out?', 'Your data stays on this device.', [
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

  const onExport = async () => {
    try {
      setBusy(true);
      const backup = await exportBackup();
      const uri = `${FileSystem.cacheDirectory}arcfore-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Arcfore data' });
      } else {
        Alert.alert('Export saved', `Backup written to ${uri}`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not create a backup right now.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Erase all data on this device?',
      'This permanently removes your profile, rounds, swing videos, analyses, and practice history stored locally. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            await qc.invalidateQueries();
            router.replace('/');
          },
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
          onChange={(v) => upsert.mutate({ skillLevel: v })}
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
          onChange={(v) => upsert.mutate({ units: v })}
        />
      </View>
      <Row
        icon={<BookOpen size={18} color={colors.forest} />}
        label="Privacy & terms"
        onPress={() => router.push('/legal')}
      />

      <SectionHeader title="Data" />
      <Row
        icon={<Download size={18} color={colors.forest} />}
        label="Export my data (JSON)"
        onPress={() => void onExport()}
      />

      <SectionHeader title="Account" />
      {isSignedIn ? (
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
      ) : null}
      <Card>
        <Button
          title="Erase all data on this device"
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
