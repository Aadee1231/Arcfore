import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useColors } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme/theme';

export default function NotFound() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text variant="display" style={{ color: colors.forest }}>
        Lost ball.
      </Text>
      <Text variant="body" secondary center>
        This page doesn't exist — maybe it took a bad bounce.
      </Text>
      <Link href="/(tabs)">
        <Text variant="bodyStrong" style={{ color: colors.forest }}>
          Back to the clubhouse →
        </Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
});
