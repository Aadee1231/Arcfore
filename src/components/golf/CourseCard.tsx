import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Flag, MapPin } from 'lucide-react-native';
import { useColors } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/theme';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatDistanceKm } from '@/lib/geo';
import type { CourseSummary } from '@/types/domain';

export function CourseCard({
  course,
  onPress,
  units = 'yards',
}: {
  course: CourseSummary;
  onPress?: () => void;
  units?: 'yards' | 'meters';
}) {
  const colors = useColors();
  const location = [course.city, course.state].filter(Boolean).join(', ');
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={course.name}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.sage }]}>
          <Flag size={18} color={colors.forest} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {course.name}
          </Text>
          {location ? (
            <View style={styles.locRow}>
              <MapPin size={12} color={colors.textSecondary} />
              <Text variant="caption" secondary numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
        {course.distanceKm != null ? (
          <Text variant="label" secondary style={type.number}>
            {formatDistanceKm(course.distanceKm, units)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
