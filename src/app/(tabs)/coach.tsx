import { useAuthUser } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, MessageCircle, Scan, Target } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useOneThing, useSwingAnalyses } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/theme';

export default function CoachScreen() {
  const colors = useColors();
  const router = useRouter();
  useAuthUser();
  const analyses = useSwingAnalyses();
  const oneThing = useOneThing();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title" style={{ color: colors.forest }}>
          Coach
        </Text>
        <Text variant="body" secondary>
          Film your swing, get honest feedback, practice one thing at a time.
        </Text>
      </View>

      <View style={styles.ctaRow}>
        <Button
          title="Analyze my swing"
          size="xl"
          fullWidth
          icon={<Camera size={20} color="#F7F4EC" />}
          onPress={() => router.push('/coach/record')}
        />
        <Button
          title="Ask the coach"
          variant="outline"
          size="lg"
          fullWidth
          icon={<MessageCircle size={18} color={colors.text} />}
          onPress={() => router.push('/coach/chat')}
        />
      </View>

      {oneThing.data ? (
        <Card style={styles.oneThing} onPress={() => router.push('/practice')}>
          <View style={styles.oneThingHeader}>
            <Target size={14} color={colors.brass} />
            <Text variant="micro" style={{ color: colors.brass }}>
              YOUR ONE THING
            </Text>
          </View>
          <Text variant="h3">{oneThing.data.focus}</Text>
          <Text variant="caption" secondary numberOfLines={2}>
            {oneThing.data.explanation}
          </Text>
        </Card>
      ) : null}

      <FlatList
        data={analyses.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<SectionHeader title="Swing analyses" />}
        renderItem={({ item }) => (
          <Card style={styles.analysisCard} onPress={() => router.push(`/coach/analysis/${item.id}`)}>
            <View style={styles.analysisRow}>
              <View style={[styles.thumb, { backgroundColor: colors.sage }]}>
                <Scan size={20} color={colors.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.topPriority?.title ?? item.summary ?? 'Swing analysis'}
                </Text>
                <Text variant="caption" secondary>
                  {new Date(item.createdAt).toLocaleDateString()} ·{' '}
                  {item.status === 'completed'
                    ? `${item.confidence} confidence`
                    : item.status === 'processing'
                      ? 'Processing…'
                      : 'Failed'}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon={<Scan size={26} color={colors.textSecondary} />}
              title="No analyses yet"
              message="Record or upload a swing video and Arcfore will find your top priority to work on."
              action={
                <Button title="Record a swing" variant="outline" onPress={() => router.push('/coach/record')} />
              }
            />
          </Card>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: 2 },
  ctaRow: { gap: spacing.sm, marginBottom: spacing.lg },
  oneThing: { marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: '#C8A46B', gap: spacing.xs },
  oneThingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  list: { paddingBottom: spacing.xxxl },
  analysisCard: { marginBottom: spacing.sm },
  analysisRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
