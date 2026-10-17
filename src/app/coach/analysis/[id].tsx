import { useAuthUser } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, Shield, Target } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen, } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { getSwingVideo } from '@/lib/db/repo';
import { useSwingAnalysis } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/theme';

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Low confidence — treat as a hint',
  medium: 'Moderate confidence',
  high: 'High confidence',
};

export default function AnalysisDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  useAuthUser();
  const [showSteps, setShowSteps] = useState(false);

  const analysis = useSwingAnalysis(id);

  const videoUri = useQuery({
    queryKey: ['analysis-video', analysis.data?.videoId],
    enabled: !!analysis.data?.videoId,
    queryFn: async () => {
      const video = await getSwingVideo(analysis.data!.videoId!);
      return video?.storagePath ?? null; // local file:// uri
    },
  });

  const player = useVideoPlayer(videoUri.data ?? null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const a = analysis.data;
  const qualityColor = a
    ? a.videoQuality === 'good'
      ? colors.birdie
      : a.videoQuality === 'acceptable'
        ? colors.brass
        : colors.danger
    : colors.textSecondary;

  const phaseLabel = (n: string) =>
    ({ setup: 'Setup', backswing: 'Backswing', transition: 'Transition', downswing: 'Downswing', impact: 'Impact', follow_through: 'Follow-through' }[n] ?? n);

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: 'Swing analysis', headerBackTitle: 'Back' }} />
      <View style={styles.body}>
        {analysis.isFetching ? (
          <Text variant="body" secondary style={{ marginTop: spacing.xxl }}>
            Loading analysis…
          </Text>
        ) : !a ? (
          <Text variant="body" secondary style={{ marginTop: spacing.xxl }}>
            Analysis not found — it may have been deleted.
          </Text>
        ) : (
          <>
            {/* Video — stored on-device, plays from the local file */}
            {videoUri.data ? (
              <View style={styles.videoWrap}>
                <VideoView player={player} style={styles.video} contentFit="cover" nativeControls />
              </View>
            ) : null}

            {/* Status */}
            <View style={styles.statusRow}>
              <Text variant="caption" secondary>
                {new Date(a.createdAt).toLocaleDateString()} ·{' '}
                {a.perspective === 'down_the_line'
                  ? 'Down the line'
                  : a.perspective === 'face_on'
                    ? 'Face on'
                    : 'Angle unknown'}
              </Text>
              <View style={[styles.qualityPill, { borderColor: qualityColor }]}>
                <Text variant="micro" style={{ color: qualityColor }}>
                  {a.videoQuality.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Unusable → recording tip prominently */}
            {a.videoQuality === 'unusable' && a.recordingTip ? (
              <Card style={{ borderColor: colors.danger }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AlertTriangle size={16} color={colors.danger} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="label">Couldn't analyze this one</Text>
                    <Text variant="body" secondary>
                      {a.recordingTip}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Summary */}
            <Text variant="body">{a.summary}</Text>

            {/* Phase timeline */}
            {a.phases.length > 0 ? (
              <Card>
                <Text variant="label" secondary>
                  SWING PHASES
                </Text>
                <View style={styles.phaseWrap}>
                  {a.phases.map((p) => (
                    <View key={p.name} style={styles.phaseRow}>
                      <View style={[styles.phaseDot, { backgroundColor: colors.brass }]} />
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {phaseLabel(p.name)}
                      </Text>
                      <Text variant="caption" secondary>
                        {p.timestampStart.toFixed(1)}s – {p.timestampEnd.toFixed(1)}s
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Top priority */}
            {a.topPriority ? (
              <Card dark>
                <View style={styles.priorityHeader}>
                  <Target size={14} color={colors.brass} />
                  <Text variant="micro" style={{ color: colors.brass }}>
                    YOUR ONE THING
                  </Text>
                </View>
                <Text variant="h3" style={{ color: '#F7F4EC' }}>
                  {a.topPriority.title}
                </Text>
                <Text variant="body" style={{ color: '#C6D4CB' }}>
                  {a.topPriority.explanation}
                </Text>
                {a.topPriority.timestamp != null ? (
                  <Text variant="caption" style={{ color: colors.brass }}>
                    Visible around {a.topPriority.timestamp.toFixed(1)}s in your video
                  </Text>
                ) : null}
              </Card>
            ) : null}

            {/* Strengths / improvements */}
            {a.strengths.length > 0 ? (
              <Card>
                <Text variant="label" secondary>
                  WHAT'S WORKING
                </Text>
                {a.strengths.map((s, i) => (
                  <View key={i} style={styles.obsRow}>
                    <CheckCircle2 size={15} color={colors.birdie} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{s.text}</Text>
                      {s.timestamp != null ? (
                        <Text variant="micro" secondary>
                          ~{s.timestamp.toFixed(1)}s · {s.confidence} confidence
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
            {a.improvements.length > 0 ? (
              <Card>
                <Text variant="label" secondary>
                  TO WORK ON
                </Text>
                {a.improvements.map((s, i) => (
                  <View key={i} style={styles.obsRow}>
                    <AlertTriangle size={15} color={colors.brass} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{s.text}</Text>
                      {s.timestamp != null ? (
                        <Text variant="micro" secondary>
                          ~{s.timestamp.toFixed(1)}s · {s.confidence} confidence
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            {/* Drill */}
            {a.drill ? (
              <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.forest }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="label" secondary>
                    RECOMMENDED DRILL
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={colors.textSecondary} />
                    <Text variant="micro" secondary>
                      {a.drill.durationMinutes} min
                    </Text>
                  </View>
                </View>
                <Text variant="h3">{a.drill.name}</Text>
                <Text variant="body" secondary>
                  {a.drill.description}
                </Text>
                <Text variant="label">{a.drill.reps}</Text>
                <Button
                  title={showSteps ? 'Hide steps' : 'Show steps'}
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowSteps((v) => !v)}
                />
                {showSteps
                  ? a.drill.steps.map((s, i) => (
                      <Text key={i} variant="body" secondary>
                        {i + 1}. {s}
                      </Text>
                    ))
                  : null}
                <Button
                  title="Save drill to practice"
                  variant="outline"
                  onPress={() => router.push('/practice')}
                />
              </Card>
            ) : null}

            {/* Limitations + confidence */}
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Shield size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="caption" secondary>
                    {CONFIDENCE_LABEL[a.confidence] ?? ''} — an AI estimate, not a launch monitor.
                  </Text>
                  {a.limitations.map((l, i) => (
                    <Text key={i} variant="caption" secondary>
                      · {l}
                    </Text>
                  ))}
                </View>
              </View>
            </Card>

            <Button
              title="Ask the coach about this"
              variant="outline"
              icon={<MessageCircle size={16} color={colors.text} />}
              onPress={() =>
                router.push({
                  pathname: '/coach/chat',
                  params: { prefill: `Tell me more about my swing analysis "${a.topPriority?.title ?? a.summary}"` },
                })
              }
            />
          </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, gap: spacing.md },
  videoWrap: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    height: 260,
  },
  video: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qualityPill: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  priorityHeader: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginBottom: spacing.sm },
  phaseWrap: { marginTop: spacing.sm, gap: spacing.xs },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  obsRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: 6 },
});
