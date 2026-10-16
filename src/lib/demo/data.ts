import type { OneThingRecommendation, PracticeSession, Round, SwingAnalysis } from '@/types/domain';

/**
 * Developer-only preview dataset. Rendered in UI lists ONLY when
 * EXPO_PUBLIC_DEMO_MODE=true is set — never stored, never counted as real data.
 * Production installs never see this.
 */

const mkScores = (participantId: string, pars: number[], deltas: number[]) =>
  pars.map((par, i) => ({
    participantId,
    holeNumber: i + 1,
    strokes: par + (deltas[i] ?? 0),
    putts: i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : null,
    fairway: (i % 4 === 0 ? 'left' : i % 5 === 0 ? 'right' : 'hit') as 'hit' | 'left' | 'right',
    gir: i % 3 !== 1,
    penalties: null,
    notes: null,
    updatedAt: '2026-10-10T16:00:00Z',
  }));

const PARS_18 = [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];

function demoRound(
  id: string,
  courseName: string,
  date: string,
  deltas: number[],
  holesPlanned: 9 | 18 = 18,
): Round {
  const me = { id: `${id}_me`, userId: 'demo-user', displayName: 'You', isGuest: false, sortOrder: 0, teeLabel: 'White' };
  const scores = mkScores(me.id, PARS_18.slice(0, holesPlanned), deltas);
  return {
    id,
    ownerId: 'demo-user',
    courseId: `demo_${id}`,
    courseProvider: 'gca',
    courseProviderId: 'demo',
    courseName,
    teeSetId: null,
    teeName: 'White',
    teeColor: '#FFFFFF',
    holesPlanned,
    startingHole: 1,
    format: 'stroke',
    status: 'completed',
    isMultiDevice: false,
    shareCode: null,
    holeData: PARS_18.slice(0, holesPlanned).map((par, i) => ({ hole: i + 1, par, yards: par === 3 ? 165 : par === 5 ? 515 : 385, handicap: i + 1, handicapWomen: i + 1 })),
    participants: [me],
    scores,
    startedAt: `${date}T07:30:00Z`,
    completedAt: `${date}T12:05:00Z`,
    createdAt: `${date}T07:30:00Z`,
    updatedAt: `${date}T12:05:00Z`,
  };
}

export const DEMO_ROUNDS: Round[] = [
  demoRound('demo_r1', 'Lonnie Poole Golf Course', '2026-10-12', [0, 1, 0, 2, 0, 0, -1, 1, 0, 1, 0, 0, 1, 2, 0, 0, 1, 0]),
  demoRound('demo_r2', 'Winchester Country Club', '2026-10-05', [1, 0, 1, 1, 0, 2, 0, 1, 0, 0, -1, 1, 0, 1, 0, 2, 0, 0]),
  demoRound('demo_r3', 'Heritage Golf Club', '2026-09-27', [0, 0, 1, 0, 0, 0, 1, 0, 0], 9),
];

export const DEMO_ANALYSES: SwingAnalysis[] = [
  {
    id: 'demo_a1',
    userId: 'demo-user',
    videoId: 'demo_v1',
    status: 'completed',
    model: 'gemini-demo',
    summary: 'Balanced setup and a connected takeaway. The main opportunity is hip depth through impact — the pelvis drifts toward the ball in the downswing.',
    videoQuality: 'acceptable',
    perspective: 'down_the_line',
    strengths: [
      { text: 'Athletic, repeatable setup posture', timestamp: 0.5, confidence: 'medium' },
      { text: 'Club and arms move together off the ball', timestamp: 1.2, confidence: 'medium' },
    ],
    improvements: [{ text: 'Early extension — hips move toward the ball through impact', timestamp: 2.4, confidence: 'low' }],
    topPriority: {
      title: 'Maintain hip depth through impact',
      explanation: 'Your pelvis drifts toward the ball in the downswing, which can push contact toward the heel and thin shots.',
      timestamp: 2.4,
    },
    drill: {
      name: 'Chair-behind-hips drill',
      description: 'Rehearse slow swings keeping contact with a chair placed just behind your lead hip.',
      steps: ['Place a chair behind your hips at address', 'Make half swings keeping hip contact', 'Progress to full swings'],
      reps: '3 sets of 10',
      durationMinutes: 10,
    },
    phases: [
      { name: 'setup', timestampStart: 0, timestampEnd: 1.0 },
      { name: 'backswing', timestampStart: 1.0, timestampEnd: 2.0 },
      { name: 'downswing', timestampStart: 2.0, timestampEnd: 2.5 },
      { name: 'impact', timestampStart: 2.5, timestampEnd: 2.7 },
      { name: 'follow_through', timestampStart: 2.7, timestampEnd: 3.5 },
    ],
    confidence: 'medium',
    limitations: ['Single camera angle', 'No ball-flight data'],
    recordingTip: null,
    createdAt: '2026-10-11T18:20:00Z',
  },
];

export const DEMO_SESSIONS: PracticeSession[] = [
  {
    id: 'demo_s1',
    userId: 'demo-user',
    drillId: 'local-lag-putting',
    durationMinutes: 15,
    notes: 'Solid distance control from 20+ feet.',
    repsCompleted: 3,
    completedAt: '2026-10-13T17:00:00Z',
  },
];

export const DEMO_ONE_THING: OneThingRecommendation = {
  id: 'demo_ot1',
  userId: 'demo-user',
  focus: 'Hip depth through impact',
  explanation:
    'Your last swing analysis flagged early extension — the pelvis drifting toward the ball through impact. Keeping your trail hip back preserves posture and contact quality.',
  drillId: 'local-chair-drill',
  drillName: 'Chair-behind-hips drill',
  status: 'active',
  source: 'analysis',
  createdAt: '2026-10-11T18:25:00Z',
};
