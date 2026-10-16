import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useColors } from '@/theme/ThemeProvider';

interface Props {
  values: number[];
  width: number;
  height?: number;
  /** values below this "par" baseline draw in birdie green, above in brass */
  baseline?: number;
}

/** Minimal editorial sparkline for scoring trends (to-par per round). */
export function TrendChart({ values, width, height = 72, baseline = 0 }: Props) {
  const colors = useColors();
  if (values.length < 2) return <View style={{ height }} />;

  const min = Math.min(...values, baseline);
  const max = Math.max(...values, baseline);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const y = (v: number) => height - 8 - ((v - min) / span) * (height - 16);

  const pts = values.map((v, i) => ({ x: i * stepX, y: y(v) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const baseY = y(baseline);
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height} style={styles.svg}>
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.brass} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.brass} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#fill)" />
      <Path
        d={`M0,${baseY.toFixed(1)} L${width},${baseY.toFixed(1)}`}
        stroke={colors.border}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <Path d={line} fill="none" stroke={colors.brass} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={4} fill={colors.brass} />
    </Svg>
  );
}

const styles = StyleSheet.create({ svg: {} });
