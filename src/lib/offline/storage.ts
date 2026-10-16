import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OutboxMutation } from '@/lib/offline/outbox';
import type { Round } from '@/types/domain';

const KEYS = {
  activeRound: 'arcfore:activeRound:v1',
  outbox: 'arcfore:outbox:v1',
  recentCourses: 'arcfore:recentCourses:v1',
  lastSync: 'arcfore:lastSync:v1',
} as const;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/corrupt — fail soft; in-memory state is still authoritative
  }
}

export const offlineStorage = {
  loadActiveRound: () => readJson<Round>(KEYS.activeRound),
  saveActiveRound: (round: Round | null) =>
    round ? writeJson(KEYS.activeRound, round) : AsyncStorage.removeItem(KEYS.activeRound),

  loadOutbox: async () => (await readJson<OutboxMutation[]>(KEYS.outbox)) ?? [],
  saveOutbox: (queue: OutboxMutation[]) => writeJson(KEYS.outbox, queue),

  loadRecentCourses: async () =>
    (await readJson<{ provider: string; providerId: string; name: string; city: string | null; state: string | null; savedAt: string }[]>(KEYS.recentCourses)) ?? [],
  saveRecentCourses: (courses: unknown[]) => writeJson(KEYS.recentCourses, courses),

  loadLastSync: () => readJson<Record<string, string>>(KEYS.lastSync),
  saveLastSync: (map: Record<string, string>) => writeJson(KEYS.lastSync, map),
};
