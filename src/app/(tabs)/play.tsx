import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Compass, MapPin, Search, SlidersHorizontal, Users } from 'lucide-react-native';

import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CourseCard } from '@/components/golf/CourseCard';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { nearbyCourses, searchCourses } from '@/lib/api/courses';
import { offlineStorage } from '@/lib/offline/storage';
import type { CourseSummary } from '@/types/domain';
import { useProfile } from '@/lib/hooks/data';
import { useAuth } from '@clerk/expo';
import { isClerkConfigured } from '@/lib/config';

interface RecentCourse extends CourseSummary {
  savedAt: string;
}

export default function PlayScreen() {
  const colors = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const profile = useProfile(isClerkConfigured() ? userId : null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<RecentCourse[]>([]);
  const [locationState, setLocationState] = useState<
    'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'
  >('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    void offlineStorage.loadRecentCourses().then((r) => setRecent(r as RecentCourse[]));
  }, []);

  const search = useQuery({
    queryKey: ['courses', 'search', debounced],
    enabled: debounced.length >= 2,
    queryFn: () => searchCourses(debounced),
    staleTime: 120_000,
  });

  const nearby = useQuery({
    queryKey: ['courses', 'nearby', coords?.latitude, coords?.longitude],
    enabled: !!coords,
    queryFn: () => nearbyCourses(coords!.latitude, coords!.longitude, 30),
    staleTime: 300_000,
  });

  const requestLocation = useCallback(async () => {
    setLocationState('loading');
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        setLocationState('unavailable');
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationState('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLocationState('granted');
    } catch {
      setLocationState('unavailable');
    }
  }, []);

  const openCourse = (course: CourseSummary) => {
    const next = [
      { ...course, savedAt: new Date().toISOString() },
      ...recent.filter((r) => !(r.provider === course.provider && r.providerId === course.providerId)),
    ].slice(0, 8);
    setRecent(next);
    void offlineStorage.saveRecentCourses(next);
    router.push(`/course/${course.provider}:${course.providerId}`);
  };

  const units = profile.data?.units ?? 'yards';
  const showing = debounced.length >= 2 ? 'search' : nearby.data ? 'nearby' : 'recent';

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title" style={{ color: colors.forest }}>
          Play
        </Text>
        <Text variant="body" secondary>
          Find a real course and start your round.
        </Text>
      </View>

      <Input
        placeholder="Search courses by name…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        returnKeyType="search"
        leftIcon={<Search size={18} color={colors.textSecondary} />}
        right={
          query ? (
            <Button title="Clear" variant="ghost" size="sm" onPress={() => setQuery('')} />
          ) : undefined
        }
      />

      <View style={styles.actionsRow}>
        <Button
          title={coords ? 'Nearby' : 'Use my location'}
          variant="outline"
          size="sm"
          loading={locationState === 'loading'}
          icon={<Compass size={15} color={colors.text} />}
          onPress={requestLocation}
        />
        <Button
          title="Manual course"
          variant="ghost"
          size="sm"
          icon={<SlidersHorizontal size={15} color={colors.textSecondary} />}
          onPress={() => router.push('/course/manual')}
        />
        <Button
          title="Join with code"
          variant="ghost"
          size="sm"
          icon={<Users size={15} color={colors.textSecondary} />}
          onPress={() => router.push('/round/join')}
        />
      </View>

      {locationState === 'denied' ? (
        <Card style={styles.notice}>
          <Text variant="label">Location is off</Text>
          <Text variant="caption" secondary>
            Enable location in Settings → Arcfore to see courses near you. You can still search by name.
          </Text>
        </Card>
      ) : null}
      {locationState === 'unavailable' ? (
        <Card style={styles.notice}>
          <Text variant="caption" secondary>
            Location services are unavailable on this device.
          </Text>
        </Card>
      ) : null}

      <FlatList
        data={
          showing === 'search'
            ? search.data ?? []
            : showing === 'nearby'
              ? nearby.data ?? []
              : recent
        }
        keyExtractor={(item) => `${item.provider}:${item.providerId}`}
        renderItem={({ item }) => (
          <CourseCard course={item} units={units} onPress={() => openCourse(item)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <SectionHeader
            title={
              showing === 'search'
                ? `Results for “${debounced}”`
                : showing === 'nearby'
                  ? 'Near you'
                  : 'Recent courses'
            }
          />
        }
        ListEmptyComponent={
          search.isFetching || nearby.isFetching ? (
            <View style={styles.loadingWrap}>
              <Text variant="body" secondary>
                Searching…
              </Text>
            </View>
          ) : showing === 'search' && search.data && !search.isFetching ? (
            <EmptyState
              icon={<Search size={26} color={colors.textSecondary} />}
              title="No courses found"
              message="Try another spelling, or add the course manually."
              action={
                <Button title="Add manual course" variant="outline" onPress={() => router.push('/course/manual')} />
              }
            />
          ) : showing === 'search' && search.error ? (
            <EmptyState
              icon={<Search size={26} color={colors.textSecondary} />}
              title="Course search unavailable"
              message="The course provider could not be reached — check the API key or try again later."
              action={
                <Button title="Add manual course" variant="outline" onPress={() => router.push('/course/manual')} />
              }
            />
          ) : showing === 'recent' ? (
            <EmptyState
              icon={<MapPin size={26} color={colors.textSecondary} />}
              title="No recent courses"
              message="Search above or use your location to find a course and get playing."
            />
          ) : (
            <View />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  notice: { marginTop: spacing.md, gap: 2 },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { paddingVertical: spacing.xxxl, alignItems: 'center' },
});
