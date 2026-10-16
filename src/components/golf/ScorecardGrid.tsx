import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { spacing, tabularNums, type } from '@/theme/theme';
import { Text } from '@/components/ui/Text';
import type { HoleScore, RoundParticipant, TeeHoleInfo } from '@/types/domain';
import { findScore, formatToPar } from '@/lib/scoring/engine';

interface Props {
  holeNumbers: number[]; // 9 or 18 cells
  holeData: TeeHoleInfo[];
  participants: RoundParticipant[];
  scores: HoleScore[];
  highlightParticipantId?: string;
  /** Optional second score column per player (ghost round comparison). */
  ghostScores?: HoleScore[];
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Classic printed-scorecard grid: hole numbers across the top, par + yardage
 * rows, then one row per player with running score and F/B/total marks.
 * Scrolls horizontally — never squishes columns unreadably small.
 */
export function ScorecardGrid({
  holeNumbers,
  holeData,
  participants,
  scores,
  highlightParticipantId,
  ghostScores,
  compact,
  style,
}: Props) {
  const colors = useColors();
  const cellW = compact ? 34 : 40;
  const labelW = compact ? 86 : 104;

  const parAt = (h: number) => holeData.find((x) => x.hole === h)?.par ?? null;
  const yardsAt = (h: number) => holeData.find((x) => x.hole === h)?.yards ?? null;

  const front = holeNumbers.filter((h) => h <= 9);
  const back = holeNumbers.filter((h) => h > 9);

  const playerTotal = (pid: string, holes: number[]) =>
    holes.reduce((acc, h) => {
      const s = findScore(scores, pid, h);
      return acc + (s?.strokes ?? 0);
    }, 0);
  const parTotal = (holes: number[]) =>
    holes.reduce((a, h) => a + (parAt(h) ?? 0), 0);

  const diffColor = (strokes: number | null, par: number | null) => {
    if (strokes == null || par == null) return colors.text;
    const d = strokes - par;
    if (d <= -1) return colors.birdie;
    if (d >= 2) return colors.danger;
    return colors.text;
  };

  const Cell = ({
    children,
    w = cellW,
    bg,
    strong,
    color,
  }: {
    children?: React.ReactNode;
    w?: number;
    bg?: string;
    strong?: boolean;
    color?: string;
  }) => (
    <View style={[styles.cell, { width: w, backgroundColor: bg ?? 'transparent' }]}>
      <Text
        variant={compact ? 'caption' : 'number'}
        style={[
          tabularNums,
          { color: color ?? colors.text },
          strong && type.bodyStrong,
        ]}
      >
        {children ?? ''}
      </Text>
    </View>
  );

  const LabelCell = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
    <View style={[styles.cell, { width: labelW, alignItems: 'flex-start', paddingLeft: spacing.sm }]}>
      <Text variant={compact ? 'caption' : 'label'} style={strong && type.bodyStrong} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );

  const blockFor = (holes: number[], title: string) => (
    <View key={title}>
      <View style={styles.row}>
        <LabelCell strong>{title}</LabelCell>
        {holes.map((h) => (
          <Cell key={h} strong bg={colors.sage}>
            {h}
          </Cell>
        ))}
        <Cell strong bg={colors.sage}>
          {holes === front ? 'OUT' : holes === back ? 'IN' : 'TOT'}
        </Cell>
      </View>
      <View style={styles.row}>
        <LabelCell>Par</LabelCell>
        {holes.map((h) => (
          <Cell key={h}>{parAt(h) ?? '·'}</Cell>
        ))}
        <Cell strong>{parTotal(holes)}</Cell>
      </View>
      {holeData.some((h) => h.yards != null) && (
        <View style={styles.row}>
          <LabelCell>Yards</LabelCell>
          {holes.map((h) => (
            <Cell key={h}>
              <Text variant="caption" secondary style={tabularNums}>
                {yardsAt(h) ?? '·'}
              </Text>
            </Cell>
          ))}
          <Cell />
        </View>
      )}
      {participants.map((p) => {
        const subtotal = playerTotal(p.id, holes);
        const ghostRow = ghostScores?.length
          ? ghostScores.filter((s) => s.participantId === p.id)
          : null;
        return (
          <React.Fragment key={p.id}>
            <View
              style={[
                styles.row,
                p.id === highlightParticipantId && { backgroundColor: colors.sage },
              ]}
            >
              <LabelCell strong={p.id === highlightParticipantId}>{p.displayName}</LabelCell>
              {holes.map((h) => {
                const s = findScore(scores, p.id, h);
                const par = parAt(h);
                return (
                  <Cell key={h} color={diffColor(s?.strokes ?? null, par)} strong={s?.strokes != null && par != null && s.strokes < par}>
                    {s?.strokes ?? '·'}
                  </Cell>
                );
              })}
              <Cell strong>{subtotal || '·'}</Cell>
            </View>
            {ghostRow ? (
              <View style={styles.row}>
                <LabelCell>
                  <Text variant="micro" secondary>
                    GHOST
                  </Text>
                </LabelCell>
                {holes.map((h) => {
                  const s = findScore(ghostRow, p.id, h);
                  return (
                    <Cell key={h}>
                      <Text variant="caption" secondary style={tabularNums}>
                        {s?.strokes ?? '·'}
                      </Text>
                    </Cell>
                  );
                })}
                <Cell>
                  <Text variant="caption" secondary style={tabularNums}>
                    {holes.reduce((a, h) => a + (findScore(ghostRow, p.id, h)?.strokes ?? 0), 0) || '·'}
                  </Text>
                </Cell>
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
      {participants.length > 0 && (
        <View style={styles.row}>
          <LabelCell>To par</LabelCell>
          {holes.map(() => null) /* spacer */}
          <Cell strong>
            {(() => {
              const played = participants.some((p) =>
                holes.some((h) => findScore(scores, p.id, h)?.strokes != null),
              );
              if (!played) return '·';
              // leader to-par for the block
              const best = participants.map((p) => {
                let t = 0, playedHoles = 0;
                for (const h of holes) {
                  const s = findScore(scores, p.id, h);
                  if (s?.strokes != null && parAt(h) != null) {
                    t += s.strokes - (parAt(h) ?? 0);
                    playedHoles += 1;
                  }
                }
                return playedHoles ? t : null;
              }).filter((x): x is number => x != null);
              if (!best.length) return '·';
              const leader = Math.min(...best);
              return `Best ${formatToPar(leader)}`;
            })()}
          </Cell>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
      <View>
        {front.length ? blockFor(front, 'Hole') : null}
        {back.length ? <View style={{ marginTop: spacing.md }}>{blockFor(back, 'Hole')}</View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
