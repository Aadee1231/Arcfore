-- Arcfore initial schema
-- Auth model: Clerk is the identity provider; Supabase "third-party auth" issues
-- RLS identity via auth.jwt()->>'sub' (the Clerk user id, e.g. 'user_2abc...').
-- Service-role connections (our API server) bypass RLS — keep the service key server-side only.

create extension if not exists "pgcrypto";

-- ============ profiles ============
create table if not exists public.profiles (
  id text primary key,                    -- clerk user id
  display_name text not null default '',
  handedness text not null default 'right' check (handedness in ('right','left')),
  skill_level text not null default 'intermediate'
    check (skill_level in ('beginner','intermediate','advanced','scratch')),
  primary_goal text not null default '',
  units text not null default 'yards' check (units in ('yards','meters')),
  typical_score int,
  avatar_url text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ courses ============
create table if not exists public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- 'gca' | 'manual'
  provider_id text not null,
  name text not null,
  club_name text,
  address text,
  city text,
  state text,
  country_iso2 text,
  latitude double precision,
  longitude double precision,
  hole_count int not null default 18 check (hole_count in (9,18,27,36)),
  payload jsonb,                          -- raw provider payload for future fields
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists public.course_tee_sets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses(id) on delete cascade,
  name text not null,
  rating numeric(4,1),
  slope int,
  rating_women numeric(4,1),
  slope_women int,
  total_yards int,
  sort_order int not null default 0
);
create index if not exists tee_sets_course_idx on public.course_tee_sets(course_id);

create table if not exists public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int check (par between 3 and 6),
  handicap_men int,
  handicap_women int,
  green_lat double precision,
  green_lng double precision,
  unique (course_id, hole_number)
);
create index if not exists course_holes_course_idx on public.course_holes(course_id);

-- yardages vary per tee set
create table if not exists public.tee_set_holes (
  tee_set_id uuid not null references public.course_tee_sets(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  yards int,
  par int,
  handicap int,
  primary key (tee_set_id, hole_number)
);

-- ============ user clubs ============
create table if not exists public.user_clubs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  club_type text not null
    check (club_type in ('driver','wood','hybrid','iron','wedge','putter','other')),
  name text not null,
  brand text,
  model text,
  carry_yards int check (carry_yards between 0 and 400),
  total_yards int check (total_yards between 0 and 400),
  confidence text check (confidence in ('low','medium','high')),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_clubs_user_idx on public.user_clubs(user_id);

-- ============ rounds ============
create table if not exists public.rounds (
  id uuid primary key,
  owner_id text not null references public.profiles(id) on delete cascade,
  course_id uuid references public.golf_courses(id) on delete set null,
  course_name text not null,
  course_provider text,
  course_provider_id text,
  tee_set_id uuid,
  tee_name text,
  tee_color text,
  holes_planned int not null check (holes_planned in (9,18)),
  starting_hole int not null default 1 check (starting_hole between 1 and 18),
  format text not null default 'stroke' check (format in ('stroke','scramble','match')),
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  is_multi_device boolean not null default false,
  share_code text unique,
  hole_data jsonb not null default '[]'::jsonb,  -- scorecard snapshot (par/yards/hcp per hole)
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rounds_owner_idx on public.rounds(owner_id);
create index if not exists rounds_share_idx on public.rounds(share_code) where share_code is not null;

create table if not exists public.round_participants (
  id uuid primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id text references public.profiles(id) on delete set null,
  display_name text not null,
  is_guest boolean not null default false,
  sort_order int not null default 0,
  tee_label text,
  created_at timestamptz not null default now(),
  unique (round_id, id)
);
create index if not exists participants_round_idx on public.round_participants(round_id);
create index if not exists participants_user_idx on public.round_participants(user_id) where user_id is not null;

create table if not exists public.hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  participant_id uuid not null references public.round_participants(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  strokes int check (strokes between 0 and 30),
  putts int check (putts between 0 and 15),
  fairway text check (fairway in ('hit','left','right','na')),
  gir boolean,
  penalties int check (penalties between 0 and 10),
  notes text,
  updated_by text,                        -- clerk id of last writer
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (round_id, participant_id, hole_number)
);
create index if not exists hole_scores_round_idx on public.hole_scores(round_id);

-- ============ swing videos + analyses ============
create table if not exists public.swing_videos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  duration_seconds numeric(6,2),
  camera_view text not null default 'unknown'
    check (camera_view in ('face_on','down_the_line','unknown')),
  club_type text,
  size_bytes bigint,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','analyzed','failed','deleted')),
  created_at timestamptz not null default now()
);
create index if not exists swing_videos_user_idx on public.swing_videos(user_id);

create table if not exists public.swing_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  video_id uuid references public.swing_videos(id) on delete set null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  model text,
  summary text,
  video_quality text check (video_quality in ('good','acceptable','poor','unusable')),
  perspective text check (perspective in ('face_on','down_the_line','unknown')),
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  top_priority jsonb,
  drill jsonb,
  phases jsonb not null default '[]'::jsonb,
  confidence text check (confidence in ('low','medium','high')),
  limitations jsonb not null default '[]'::jsonb,
  recording_tip text,
  raw jsonb,                              -- full provider response for re-processing
  error text,
  created_at timestamptz not null default now()
);
create index if not exists swing_analyses_user_idx on public.swing_analyses(user_id);

-- ============ coach ============
create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_conversations_user_idx on public.coach_conversations(user_id);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_conv_idx on public.coach_messages(conversation_id);

-- ============ practice ============
create table if not exists public.practice_drills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  skill text not null,
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  duration_minutes int not null default 10,
  equipment jsonb not null default '[]'::jsonb
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  drill_id uuid not null references public.practice_drills(id) on delete cascade,
  completed_at timestamptz not null default now(),
  duration_minutes int,
  notes text,
  reps_completed int
);
create index if not exists practice_sessions_user_idx on public.practice_sessions(user_id);

create table if not exists public.one_thing_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  focus text not null,
  explanation text not null default '',
  drill_id uuid references public.practice_drills(id) on delete set null,
  drill_name text,
  status text not null default 'active' check (status in ('active','improved','dismissed')),
  source text not null default 'fallback' check (source in ('analysis','stats','fallback')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists one_thing_user_idx on public.one_thing_recommendations(user_id);

-- ============ friends ============
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  friend_id text not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ============ server-side API cache (course provider) ============
create table if not exists public.api_cache (
  key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists api_cache_expiry_idx on public.api_cache(expires_at);

-- ============ helper: current clerk user id ============
create or replace function public.current_clerk_id() returns text
language sql stable as $$
  select auth.jwt() ->> 'sub'
$$;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.golf_courses enable row level security;
alter table public.course_tee_sets enable row level security;
alter table public.course_holes enable row level security;
alter table public.tee_set_holes enable row level security;
alter table public.user_clubs enable row level security;
alter table public.rounds enable row level security;
alter table public.round_participants enable row level security;
alter table public.hole_scores enable row level security;
alter table public.swing_videos enable row level security;
alter table public.swing_analyses enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.practice_drills enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.one_thing_recommendations enable row level security;
alter table public.friendships enable row level security;
alter table public.api_cache enable row level security;

-- profiles: readable by the owner + people they share a round with; writable only by owner
create policy profiles_select_self on public.profiles
  for select using (id = public.current_clerk_id());
create policy profiles_select_roundmates on public.profiles
  for select using (
    exists (
      select 1
      from public.round_participants mine
      join public.round_participants theirs on theirs.round_id = mine.round_id
      where mine.user_id = public.current_clerk_id()
        and theirs.user_id = profiles.id
    )
  );
create policy profiles_insert_self on public.profiles
  for insert with check (id = public.current_clerk_id());
create policy profiles_update_self on public.profiles
  for update using (id = public.current_clerk_id()) with check (id = public.current_clerk_id());
create policy profiles_delete_self on public.profiles
  for delete using (id = public.current_clerk_id());

-- course catalog: world-readable reference data; writes only via service role (API server)
create policy courses_read_all on public.golf_courses for select using (true);
create policy tee_sets_read_all on public.course_tee_sets for select using (true);
create policy course_holes_read_all on public.course_holes for select using (true);
create policy tee_set_holes_read_all on public.tee_set_holes for select using (true);

-- clubs: owner only
create policy clubs_all_own on public.user_clubs
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());

-- rounds: owner full access; participants (non-guest) can read + update
create policy rounds_owner_all on public.rounds
  for all using (owner_id = public.current_clerk_id())
  with check (owner_id = public.current_clerk_id());
create policy rounds_participant_read on public.rounds
  for select using (
    exists (
      select 1 from public.round_participants rp
      where rp.round_id = rounds.id and rp.user_id = public.current_clerk_id()
    )
  );
create policy rounds_participant_update on public.rounds
  for update using (
    exists (
      select 1 from public.round_participants rp
      where rp.round_id = rounds.id and rp.user_id = public.current_clerk_id()
    )
  );
-- joining via share code handled by a security-definer RPC (see below)

-- participants: visible to anyone in the round; owner manages all rows; a signed-in
-- user can claim a participant slot for themselves
create policy participants_select on public.round_participants
  for select using (
    exists (
      select 1 from public.round_participants me
      where me.round_id = round_participants.round_id and me.user_id = public.current_clerk_id()
    )
    or exists (select 1 from public.rounds r where r.id = round_participants.round_id and r.owner_id = public.current_clerk_id())
  );
create policy participants_owner_write on public.round_participants
  for all using (
    exists (select 1 from public.rounds r where r.id = round_participants.round_id and r.owner_id = public.current_clerk_id())
  ) with check (
    exists (select 1 from public.rounds r where r.id = round_participants.round_id and r.owner_id = public.current_clerk_id())
  );
create policy participants_self_join on public.round_participants
  for insert with check (user_id = public.current_clerk_id());
create policy participants_self_update on public.round_participants
  for update using (user_id = public.current_clerk_id()) with check (user_id = public.current_clerk_id());

-- scores: readable by round participants; writable by round owner or the owning participant
create policy scores_select on public.hole_scores
  for select using (
    exists (
      select 1 from public.round_participants rp
      where rp.round_id = hole_scores.round_id and rp.user_id = public.current_clerk_id()
    )
    or exists (select 1 from public.rounds r where r.id = hole_scores.round_id and r.owner_id = public.current_clerk_id())
  );
create policy scores_insert on public.hole_scores
  for insert with check (
    exists (select 1 from public.rounds r where r.id = hole_scores.round_id and r.owner_id = public.current_clerk_id())
    or exists (
      select 1 from public.round_participants rp
      where rp.id = hole_scores.participant_id and rp.round_id = hole_scores.round_id
        and rp.user_id = public.current_clerk_id()
    )
  );
create policy scores_update on public.hole_scores
  for update using (
    exists (select 1 from public.rounds r where r.id = hole_scores.round_id and r.owner_id = public.current_clerk_id())
    or exists (
      select 1 from public.round_participants rp
      where rp.id = hole_scores.participant_id and rp.round_id = hole_scores.round_id
        and rp.user_id = public.current_clerk_id()
    )
  );

-- swing videos/analyses/coach/practice/one-thing: owner only
create policy swing_videos_all_own on public.swing_videos
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());
create policy swing_analyses_all_own on public.swing_analyses
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());
create policy conversations_all_own on public.coach_conversations
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());
create policy messages_all_own on public.coach_messages
  for all using (
    exists (select 1 from public.coach_conversations c
            where c.id = coach_messages.conversation_id and c.user_id = public.current_clerk_id())
  ) with check (
    exists (select 1 from public.coach_conversations c
            where c.id = coach_messages.conversation_id and c.user_id = public.current_clerk_id())
  );
create policy drills_read_all on public.practice_drills for select using (true);
create policy practice_sessions_all_own on public.practice_sessions
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());
create policy one_thing_all_own on public.one_thing_recommendations
  for all using (user_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());
create policy friendships_all_own on public.friendships
  for all using (user_id = public.current_clerk_id() or friend_id = public.current_clerk_id())
  with check (user_id = public.current_clerk_id());

-- api_cache: no direct client access (service role only — RLS blocks everything else)
create policy api_cache_deny on public.api_cache for all using (false);

-- ============ RPC: join a round by share code ============
-- Security definer so a signed-in user can (a) find an active round by code and
-- (b) claim a free participant slot or create one — without opening table-wide writes.
create or replace function public.join_round_by_code(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_round public.rounds%rowtype;
  v_participant uuid;
  v_uid text := public.current_clerk_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_round from public.rounds
    where share_code = upper(trim(p_code)) and status = 'active'
    limit 1;
  if not found then
    raise exception 'no active round for that code';
  end if;
  -- already a participant?
  select id into v_participant from public.round_participants
    where round_id = v_round.id and user_id = v_uid limit 1;
  if found then
    return v_round.id;
  end if;
  -- claim an unclaimed guest slot named like us, else add a new participant
  select id into v_participant from public.round_participants
    where round_id = v_round.id and user_id is null
    order by sort_order limit 1;
  if found then
    update public.round_participants
      set user_id = v_uid,
          display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
          is_guest = false
      where id = v_participant;
  else
    insert into public.round_participants (id, round_id, user_id, display_name, is_guest, sort_order)
      values (gen_random_uuid(), v_round.id, v_uid,
              coalesce(nullif(trim(p_display_name), ''), 'Player'),
              false,
              (select coalesce(max(sort_order), -1) + 1 from public.round_participants where round_id = v_round.id));
  end if;
  return v_round.id;
end;
$$;

-- ============ Realtime ============
-- Publish score/participant/round changes for live multiplayer.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.hole_scores;
alter publication supabase_realtime add table public.round_participants;
alter publication supabase_realtime add table public.rounds;

-- ============ updated_at trigger ============
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger rounds_touch before update on public.rounds for each row execute function public.touch_updated_at();
create trigger user_clubs_touch before update on public.user_clubs for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.coach_conversations for each row execute function public.touch_updated_at();
