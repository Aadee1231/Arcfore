/** Domain model shared across app code. DB row shapes mirror lib/db/schema.ts. */

export type Units = 'yards' | 'meters';
export type Handedness = 'right' | 'left';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'scratch';

export interface Profile {
  id: string; // clerk user id
  displayName: string;
  handedness: Handedness;
  skillLevel: SkillLevel;
  primaryGoal: string;
  units: Units;
  typicalScore: number | null;
  avatarUrl: string | null;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Normalized course shape returned by our API (provider-agnostic). */
export interface CourseSummary {
  provider: 'gca' | 'manual';
  providerId: string;
  name: string;
  clubName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number;
}

export interface TeeHoleInfo {
  hole: number;
  par: number;
  yards: number | null;
  handicap: number | null;
  handicapWomen: number | null;
}

export interface TeeSet {
  id: string; // local uuid or provider-derived key
  name: string;
  rating: number | null;
  slope: number | null;
  ratingWomen: number | null;
  slopeWomen: number | null;
  totalYards: number | null;
  holes: TeeHoleInfo[];
}

export interface CourseDetail extends CourseSummary {
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
  holeCount: number;
  pars: number[]; // canonical pars per hole (hole_count long)
  teeSets: TeeSet[];
  greenCentersAvailable: boolean;
}

export interface HoleScore {
  participantId: string;
  holeNumber: number;
  strokes: number | null;
  putts: number | null;
  fairway: 'hit' | 'left' | 'right' | 'na' | null;
  gir: boolean | null;
  penalties: number | null;
  notes: string | null;
  updatedAt: string; // client timestamp, drives LWW merge
}

export interface RoundParticipant {
  id: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  sortOrder: number;
  teeLabel: string | null;
}

export type RoundFormat = 'stroke' | 'scramble' | 'match';
export type RoundStatus = 'active' | 'completed' | 'abandoned';

export interface Round {
  id: string;
  ownerId: string;
  courseId: string | null;
  courseProvider: string | null;
  courseProviderId: string | null;
  courseName: string;
  teeSetId: string | null;
  teeName: string | null;
  teeColor: string | null;
  holesPlanned: 9 | 18;
  startingHole: number;
  format: RoundFormat;
  status: RoundStatus;
  isMultiDevice: boolean;
  shareCode: string | null;
  // snapshot of tee hole data so scoring never depends on the API later
  holeData: TeeHoleInfo[];
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: RoundParticipant[];
  scores: HoleScore[];
}

export type ClubType =
  | 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter' | 'other';

export interface UserClub {
  id: string;
  userId: string;
  clubType: ClubType;
  name: string;
  brand: string | null;
  model: string | null;
  carryYards: number | null;
  totalYards: number | null;
  confidence: 'low' | 'medium' | 'high' | null;
  notes: string | null;
  sortOrder: number;
}

export type SwingCameraView = 'face_on' | 'down_the_line' | 'unknown';

export interface SwingVideo {
  id: string;
  userId: string;
  storagePath: string;
  durationSeconds: number | null;
  cameraView: SwingCameraView;
  clubType: string | null;
  status: 'uploaded' | 'processing' | 'analyzed' | 'failed';
  createdAt: string;
}

export interface SwingPhase {
  name: 'setup' | 'backswing' | 'transition' | 'downswing' | 'impact' | 'follow_through';
  timestampStart: number;
  timestampEnd: number;
}

export interface AnalysisObservation {
  text: string;
  timestamp: number | null; // seconds
  confidence: 'low' | 'medium' | 'high';
}

export interface SwingAnalysis {
  id: string;
  userId: string;
  videoId: string | null;
  status: 'processing' | 'completed' | 'failed';
  model: string;
  summary: string;
  videoQuality: 'good' | 'acceptable' | 'poor' | 'unusable';
  perspective: SwingCameraView;
  strengths: AnalysisObservation[];
  improvements: AnalysisObservation[];
  topPriority: { title: string; explanation: string; timestamp: number | null } | null;
  drill: {
    name: string;
    description: string;
    steps: string[];
    reps: string;
    durationMinutes: number;
  } | null;
  phases: SwingPhase[];
  confidence: 'low' | 'medium' | 'high';
  limitations: string[];
  recordingTip: string | null;
  createdAt: string;
}

export interface PracticeDrill {
  id: string;
  slug: string;
  name: string;
  skill: string;
  description: string;
  steps: string[];
  durationMinutes: number;
  equipment: string[];
}

export interface PracticeSession {
  id: string;
  userId: string;
  drillId: string;
  completedAt: string;
  durationMinutes: number | null;
  notes: string | null;
  repsCompleted: number | null;
}

export interface OneThingRecommendation {
  id: string;
  userId: string;
  focus: string;
  explanation: string;
  drillId: string | null;
  drillName: string | null;
  status: 'active' | 'improved' | 'dismissed';
  source: 'analysis' | 'stats' | 'fallback';
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface CoachConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoundStats {
  participantId: string;
  displayName: string;
  holesPlayed: number;
  totalStrokes: number;
  toPar: number; // strokes - par over played holes
  frontNine: number | null;
  backNine: number | null;
  puttsTotal: number | null;
  girCount: number;
  girTracked: number;
  fairwaysHit: number;
  fairwaysTracked: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  completedAllHoles: boolean;
}
