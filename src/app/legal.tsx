import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';

export default function LegalScreen() {
  useColors();
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Privacy & terms', headerBackTitle: 'Back' }} />
      <View style={styles.body}>
        <SectionHeader title="Privacy" />
        <Text variant="body" secondary>
          Arcfore stores your profile, rounds, clubs, practice history, coach chats, and swing videos
          locally on this device. Your swing videos never leave your phone — Arcfore extracts a handful of
          frames and sends only those frames to OpenAI for analysis, along with your golf stats for context.
          Share cards contain names, course, and scores only; we never include your precise location.
        </Text>
        <Text variant="body" secondary>
          We don't sell data, run ads, or track you across other apps. Erasing your data removes your
          profile, rounds, videos, analyses, and chat history from this device.
        </Text>

        <SectionHeader title="Terms" />
        <Text variant="body" secondary>
          Arcfore provides golf tracking and AI coaching for recreational improvement. Swing feedback is an AI
          estimate — not professional instruction, and not a launch-monitor measurement. GPS distances and
          yardages are aids; you're responsible for your own decisions and safety on the course. You must be 13
          or older to use Arcfore.
        </Text>

        <SectionHeader title="Data providers" />
        <Text variant="body" secondary>
          Course data: golfcoursesapi.com (Golf Courses API). AI analysis: OpenAI. Optional sign-in: Clerk.
          All of your golf data lives on this device. Location and camera permissions are used only when you
          use the related feature.
        </Text>
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.lg, gap: spacing.sm },
});
