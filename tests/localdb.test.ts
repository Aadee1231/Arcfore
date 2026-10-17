import {
    rowToHoleScore,
    rowToParticipant,
    rowToProfile,
    rowToRound,
    rowToSwingAnalysis,
    rowToSwingVideo,
} from '@/lib/db/mappers';
import { MIGRATIONS, SCHEMA_VERSION } from '@/lib/db/schema';
import { MAX_FRAMES, planFrameTimestamps } from '@/lib/swing/frames';
import { describe, expect, it } from 'vitest';

describe('schema migrations', () => {
  it('versions are strictly increasing and start at 1', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
      expect(m.statements.length).toBeGreaterThan(0);
    });
    expect(MIGRATIONS[MIGRATIONS.length - 1].version).toBe(SCHEMA_VERSION);
  });

  it('every statement is a non-empty SQL string', () => {
    for (const m of MIGRATIONS) {
      for (const s of m.statements) {
        expect(typeof s).toBe('string');
        expect(s.trim().length).toBeGreaterThan(10);
      }
    }
  });
});

describe('row mappers', () => {
  it('maps a profile row', () => {
    const p = rowToProfile({
      id: 'local-user',
      display_name: 'Aadi',
      handedness: 'left',
      skill_level: 'advanced',
      primary_goal: 'Break 80',
      units: 'meters',
      typical_score: 82,
      avatar_url: null,
      onboarded_at: '2026-03-01T00:00:00Z',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    });
    expect(p.displayName).toBe('Aadi');
    expect(p.handedness).toBe('left');
    expect(p.units).toBe('meters');
    expect(p.typicalScore).toBe(82);
  });

  it('maps round + participants + scores round-trip shape', () => {
    const part = rowToParticipant({
      id: 'p1', round_id: 'r1', user_id: null, display_name: 'Guest Sam',
      is_guest: 1, sort_order: 1, tee_label: 'Blue',
    });
    expect(part.isGuest).toBe(true);
    expect(part.userId).toBeNull();
    expect(part.teeLabel).toBe('Blue');

    const score = rowToHoleScore({
      round_id: 'r1', participant_id: 'p1', hole_number: 7,
      strokes: 5, putts: 2, fairway: 'right', gir: 0, penalties: 1,
      notes: null, updated_at: '2026-03-01T12:00:00Z',
    });
    expect(score.strokes).toBe(5);
    expect(score.gir).toBe(false);
    expect(score.penalties).toBe(1);

    const round = rowToRound(
      {
        id: 'r1', owner_id: 'local-user', course_id: null, course_provider: 'gca',
        course_provider_id: 'abc', course_name: 'Knights Play', tee_set_id: 't1',
        tee_name: 'Blue', tee_color: '#1234', holes_planned: 9, starting_hole: 1,
        format: 'match', status: 'active', is_multi_device: 0, share_code: null,
        hole_data: JSON.stringify([{ hole: 1, par: 4, yards: 380, handicap: 5, handicapWomen: 9 }]),
        started_at: '2026-03-01T11:00:00Z', completed_at: null,
        created_at: '2026-03-01T11:00:00Z', updated_at: '2026-03-01T12:00:00Z',
      },
      [part],
      [score],
    );
    expect(round.holesPlanned).toBe(9);
    expect(round.format).toBe('match');
    expect(round.holeData).toHaveLength(1);
    expect(round.holeData[0].par).toBe(4);
    expect(round.participants[0].displayName).toBe('Guest Sam');
    expect(round.scores[0].holeNumber).toBe(7);
  });

  it('maps swing video + analysis with JSON columns', () => {
    const video = rowToSwingVideo({
      id: 'v1', user_id: 'local-user', local_uri: 'file:///docs/videos/v1.mp4',
      duration_seconds: 6.4, camera_view: 'down_the_line', club_type: 'Iron',
      size_bytes: 12345, status: 'analyzed', created_at: '2026-03-01T10:00:00Z',
    });
    expect(video.storagePath).toBe('file:///docs/videos/v1.mp4');
    expect(video.durationSeconds).toBeCloseTo(6.4);

    const a = rowToSwingAnalysis({
      id: 'a1', user_id: 'local-user', video_id: 'v1', status: 'completed',
      model: 'gpt-5.2', summary: 'Solid move.', video_quality: 'good',
      perspective: 'down_the_line',
      strengths: JSON.stringify([{ text: 'Stable head', timestamp: 1.2, confidence: 'high' }]),
      improvements: '[]',
      top_priority: JSON.stringify({ title: 'Hip slide', explanation: 'Shift, don\'t slide', timestamp: 2.1 }),
      drill: JSON.stringify({ name: 'Step drill', description: 'd', steps: ['s1'], reps: '10', durationMinutes: 10 }),
      phases: JSON.stringify([{ name: 'setup', timestampStart: 0, timestampEnd: 1.5 }]),
      confidence: 'high', limitations: '[]', recording_tip: null,
      created_at: '2026-03-01T10:05:00Z',
    });
    expect(a.strengths).toHaveLength(1);
    expect(a.topPriority?.title).toBe('Hip slide');
    expect(a.drill?.steps).toEqual(['s1']);
    expect(a.phases[0].name).toBe('setup');
  });
});

describe('frame timestamp planning', () => {
  it('spreads frames across a known-duration clip', () => {
    const ts = planFrameTimestamps(10);
    expect(ts).toHaveLength(MAX_FRAMES);
    expect(ts[0]).toBeGreaterThan(0);
    expect(ts[ts.length - 1]).toBeLessThanOrEqual(9.85);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it('falls back to a fixed schedule when duration is unknown', () => {
    const ts = planFrameTimestamps(null);
    expect(ts.length).toBeGreaterThan(4);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it('handles very short clips', () => {
    const ts = planFrameTimestamps(0.8);
    expect(ts.every((t) => t > 0 && t <= 0.65)).toBe(true);
  });
});
