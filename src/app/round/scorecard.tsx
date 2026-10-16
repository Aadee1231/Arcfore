import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ScorecardGrid } from '@/components/golf/ScorecardGrid';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { useActiveRound } from '@/store/activeRound';
import { playedHoleNumbers } from '@/lib/scoring/engine';

/** Full classic scorecard for the live round (modal over the scoring screen). */
export default function ScorecardScreen() {
  useColors();
  const router = useRouter();
  const round = useActiveRound((s) => s.round);

  if (!round) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Scorecard', presentation: 'modal' }} />
        <Text variant="body" secondary>
          No active round.
        </Text>
      </View>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          title: round.courseName,
          presentation: 'modal',
          headerRight: () => (
            <Button title="Done" variant="ghost" size="sm" onPress={() => router.back()} />
          ),
        }}
      />
      <Text variant="caption" secondary style={{ letterSpacing: 1, marginTop: spacing.md }}>
        SCORECARD · {round.teeName ? `${round.teeName.toUpperCase()} TEES · ` : ''}
        {round.holesPlanned} HOLES
      </Text>
      <ScorecardGrid
        holeNumbers={playedHoleNumbers(round)}
        holeData={round.holeData}
        participants={round.participants}
        scores={round.scores}
        style={{ marginTop: spacing.md }}
      />
      <Text variant="micro" secondary style={{ marginTop: spacing.md }}>
        Scores save automatically. Tap a hole on the scoring screen to edit any earlier hole.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
