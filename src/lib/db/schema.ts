/**
 * Local-first schema. Every mutation is an entry in MIGRATIONS applied in
 * order and tracked via PRAGMA user_version — never edit a shipped migration,
 * add a new one.
 */

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: { version: number; statements: string[] }[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT 'Golfer',
        handedness TEXT NOT NULL DEFAULT 'right',
        skill_level TEXT NOT NULL DEFAULT 'intermediate',
        primary_goal TEXT NOT NULL DEFAULT '',
        units TEXT NOT NULL DEFAULT 'yards',
        typical_score INTEGER,
        avatar_url TEXT,
        onboarded_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS user_clubs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        club_type TEXT NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        carry_yards INTEGER,
        total_yards INTEGER,
        confidence TEXT,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        course_id TEXT,
        course_provider TEXT,
        course_provider_id TEXT,
        course_name TEXT NOT NULL,
        tee_set_id TEXT,
        tee_name TEXT,
        tee_color TEXT,
        holes_planned INTEGER NOT NULL,
        starting_hole INTEGER NOT NULL DEFAULT 1,
        format TEXT NOT NULL DEFAULT 'stroke',
        status TEXT NOT NULL DEFAULT 'active',
        is_multi_device INTEGER NOT NULL DEFAULT 0,
        share_code TEXT,
        hole_data TEXT NOT NULL DEFAULT '[]',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS round_participants (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        user_id TEXT,
        display_name TEXT NOT NULL,
        is_guest INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        tee_label TEXT
      );`,

      `CREATE TABLE IF NOT EXISTS hole_scores (
        round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL REFERENCES round_participants(id) ON DELETE CASCADE,
        hole_number INTEGER NOT NULL,
        strokes INTEGER,
        putts INTEGER,
        fairway TEXT,
        gir INTEGER,
        penalties INTEGER,
        notes TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (round_id, participant_id, hole_number)
      );`,

      `CREATE TABLE IF NOT EXISTS swing_videos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        duration_seconds REAL,
        camera_view TEXT NOT NULL DEFAULT 'unknown',
        club_type TEXT,
        size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'uploaded',
        created_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS swing_analyses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        video_id TEXT REFERENCES swing_videos(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        model TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        video_quality TEXT NOT NULL DEFAULT 'acceptable',
        perspective TEXT NOT NULL DEFAULT 'unknown',
        strengths TEXT NOT NULL DEFAULT '[]',
        improvements TEXT NOT NULL DEFAULT '[]',
        top_priority TEXT,
        drill TEXT,
        phases TEXT NOT NULL DEFAULT '[]',
        confidence TEXT NOT NULL DEFAULT 'medium',
        limitations TEXT NOT NULL DEFAULT '[]',
        recording_tip TEXT,
        created_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS practice_drills (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        skill TEXT NOT NULL,
        description TEXT NOT NULL,
        steps TEXT NOT NULL DEFAULT '[]',
        duration_minutes INTEGER NOT NULL DEFAULT 10,
        equipment TEXT NOT NULL DEFAULT '[]'
      );`,

      `CREATE TABLE IF NOT EXISTS practice_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        drill_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_minutes INTEGER,
        notes TEXT,
        reps_completed INTEGER
      );`,

      `CREATE TABLE IF NOT EXISTS one_thing_recommendations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        focus TEXT NOT NULL,
        explanation TEXT NOT NULL,
        drill_id TEXT,
        drill_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL DEFAULT 'analysis',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );`,

      `CREATE TABLE IF NOT EXISTS coach_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS coach_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS course_cache (
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (provider, provider_id)
      );`,

      `CREATE INDEX IF NOT EXISTS idx_participants_round ON round_participants(round_id);`,
      `CREATE INDEX IF NOT EXISTS idx_hole_scores_round ON hole_scores(round_id);`,
      `CREATE INDEX IF NOT EXISTS idx_rounds_owner ON rounds(owner_id, started_at);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conv ON coach_messages(conversation_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_analyses_user ON swing_analyses(user_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_sessions(user_id, completed_at);`,
    ],
  },
];
