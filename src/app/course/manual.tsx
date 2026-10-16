import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { spacing, tabularNums } from '@/theme/theme';
import { newId } from '@/lib/id';
import type { CourseDetail, TeeSet } from '@/types/domain';

/**
 * Manual course builder: name + par per hole + optional yardages.
 * Produces a CourseDetail shaped like the API so the rest of the app is uniform.
 */
export default function ManualCourseScreen() {
  const colors = useColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [pars, setPars] = useState<number[]>(Array(18).fill(4));
  const [yards, setYards] = useState<(string)[]>(Array(18).fill(''));
  const [error, setError] = useState<string | null>(null);

  const setPar = (i: number, v: number) => {
    const next = [...pars];
    next[i] = Math.min(6, Math.max(3, v));
    setPars(next);
  };
  const setYd = (i: number, v: string) => {
    const next = [...yards];
    next[i] = v.replace(/[^0-9]/g, '');
    setYards(next);
  };

  const build = (): CourseDetail | null => {
    if (!name.trim()) {
      setError('Give the course a name.');
      return null;
    }
    const holes = Array.from({ length: holeCount }, (_, i) => ({
      hole: i + 1,
      par: pars[i],
      yards: yards[i] ? parseInt(yards[i], 10) : null,
      handicap: null,
      handicapWomen: null,
    }));
    const tee: TeeSet = {
      id: newId(),
      name: 'Standard',
      rating: null,
      slope: null,
      ratingWomen: null,
      slopeWomen: null,
      totalYards: holes.reduce((n, h) => n + (h.yards ?? 0), 0) || null,
      holes,
    };
    return {
      provider: 'manual',
      providerId: `manual-${newId()}`,
      name: name.trim(),
      clubName: null,
      city: city.trim() || null,
      state: null,
      country: null,
      latitude: null,
      longitude: null,
      address: null,
      postalCode: null,
      phone: null,
      website: null,
      holeCount,
      pars: pars.slice(0, holeCount),
      teeSets: [tee],
      greenCentersAvailable: false,
    };
  };

  const save = () => {
    const course = build();
    if (!course) return;
    router.push({
      pathname: '/round/setup',
      params: { manualCourse: JSON.stringify(course) },
    });
  };

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: 'Manual course', headerBackTitle: 'Back' }} />
      <View style={styles.body}>
        <Text variant="title" style={{ color: colors.forest, marginTop: spacing.md }}>
          Course not listed?
        </Text>
        <Text variant="body" secondary>
          Build a quick scorecard yourself — scoring works exactly the same. It stays on this device.
        </Text>

        <Input label="Course name" value={name} onChangeText={setName} placeholder="Oak Hollow GC" />
        <Input label="City (optional)" value={city} onChangeText={setCity} placeholder="Raleigh" />

        <Text variant="label" secondary>
          Holes
        </Text>
        <View style={styles.holeToggle}>
          <Button
            title="9 holes"
            variant={holeCount === 9 ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setHoleCount(9)}
          />
          <Button
            title="18 holes"
            variant={holeCount === 18 ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setHoleCount(18)}
          />
        </View>

        <SectionHeader title="Pars & yardages" />
        <Card>
          <View style={styles.gridHeader}>
            <Text variant="micro" secondary style={styles.holeLabel}>
              HOLE
            </Text>
            <Text variant="micro" secondary style={styles.parLabel}>
              PAR
            </Text>
            <Text variant="micro" secondary style={styles.ydLabel}>
              YARDS (opt.)
            </Text>
          </View>
          {Array.from({ length: holeCount }, (_, i) => (
            <View key={i} style={styles.gridRow}>
              <Text variant="bodyStrong" style={[styles.holeLabel, tabularNums]}>
                {i + 1}
              </Text>
              <View style={styles.parStepper}>
                <Button title="−" variant="ghost" size="sm" onPress={() => setPar(i, pars[i] - 1)} />
                <Text variant="bodyStrong" style={tabularNums}>
                  {pars[i]}
                </Text>
                <Button title="+" variant="ghost" size="sm" onPress={() => setPar(i, pars[i] + 1)} />
              </View>
              <Input
                value={yards[i]}
                onChangeText={(v) => setYd(i, v)}
                keyboardType="number-pad"
                placeholder="—"
                style={styles.ydInput}
                dense
              />
            </View>
          ))}
          <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>
            Total par {pars.slice(0, holeCount).reduce((a, b) => a + b, 0)}
          </Text>
        </Card>

        {error ? (
          <Text variant="caption" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Button title="Use this course" size="lg" fullWidth onPress={save} />
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, gap: spacing.md },
  holeToggle: { flexDirection: 'row', gap: spacing.sm },
  gridHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000012',
  },
  holeLabel: { width: 36 },
  parLabel: { width: 120, textAlign: 'center' },
  ydLabel: { flex: 1, textAlign: 'right' },
  parStepper: { flexDirection: 'row', alignItems: 'center', width: 120, justifyContent: 'center' },
  ydInput: { flex: 1 },
});
