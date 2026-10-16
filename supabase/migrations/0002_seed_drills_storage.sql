-- Seed the drill catalog and create the private swing-videos storage bucket.

insert into public.practice_drills (slug, name, skill, description, steps, duration_minutes, equipment)
values
  ('gate-putting', 'Gate Putting', 'putting',
   'Start every putt on line by rolling the ball through a tee gate.',
   '["Place two tees a ball-width apart, 2 feet ahead of the ball on your start line.","Putt from 4–6 feet and roll the ball cleanly through the gate.","Move to 8–10 feet once you hit 8 of 10."]'::jsonb,
   10, '["Putter","2 tees","3 balls"]'::jsonb),
  ('clock-putting', 'Clock Ladder', 'putting',
   'Builds pace control around the hole from every angle.',
   '["Set balls at 3, 6, 9, and 12 o''clock around the hole, 4 feet out.","Hole all four. Move each out a foot and repeat to 8 feet.","Stop after completing the 8-foot ring twice."]'::jsonb,
   15, '["Putter","4 balls"]'::jsonb),
  ('landing-spot-chipping', 'Landing-Spot Chipping', 'chipping',
   'Trains carry-distance control by hitting a towel target.',
   '["Lay a towel 10–15 feet onto the green as your landing zone.","Chip to land the ball on the towel and let it release.","Alternate between two clubs and note how release changes."]'::jsonb,
   15, '["Wedge","Iron or hybrid","Towel","6 balls"]'::jsonb),
  ('alignment-sticks-station', 'Alignment Station', 'alignment',
   'Rebuilds a square setup with a two-stick reference frame.',
   '["Lay one stick on your target line and one parallel at your feet.","Hit 10 balls checking feet, hips, and shoulders against the sticks.","Remove the sticks for 5 balls, then recheck — feel vs real."]'::jsonb,
   12, '["2 alignment sticks","Mid-iron","15 balls"]'::jsonb),
  ('metronome-tempo', 'Tempo Ladder', 'tempo',
   'Smooths the backswing-to-downswing ratio using a count.',
   '["Swing counting ""one"" to the top, ""two"" through impact.","Hit 10 wedges keeping the count identical each swing.","Repeat with a mid-iron, then driver — same count."]'::jsonb,
   10, '["Any three clubs","15 balls"]'::jsonb),
  ('nine-shot-window', 'Nine-Shot Window', 'distance control',
   'Grooves low / stock / high flights with one iron.',
   '["Pick a mid-iron and a green target.","Hit 3 low, 3 stock, 3 high shots to the same target.","Note the carry difference — that is your wind toolkit."]'::jsonb,
   20, '["Mid-iron","15 balls"]'::jsonb),
  ('step-change-sequencing', 'Step-Change Sequence', 'swing sequencing',
   'Trains lower-body-led downswing with a step drill.',
   '["Set up with feet together, club hovering.","Step toward the target as you start down, then swing through.","Blend to a normal stance after 10 reps."]'::jsonb,
   12, '["Mid-iron","10 balls"]'::jsonb),
  ('impact-bag-strike', 'Impact Position Reps', 'impact',
   'Rehearses a forward-leaning, compressed impact.',
   '["Make slow-motion swings stopping at an impact bag (or pillow).","Hold impact 3 seconds: hands ahead, hips open, head steady.","Hit 8 half-shots copying that feel."]'::jsonb,
   10, '["Mid-iron","Impact bag or pillow","8 balls"]'::jsonb)
on conflict (slug) do nothing;

-- Private bucket for swing videos — users access only their own folder ({user_id}/…)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'swing-videos', 'swing-videos', false, 524288000,
  array['video/mp4','video/quicktime','video/webm','video/x-m4v']
)
on conflict (id) do nothing;

-- Storage RLS: object owner path convention is {clerk_user_id}/{video}.mp4
create policy swing_videos_storage_read on storage.objects
  for select using (
    bucket_id = 'swing-videos'
    and (storage.foldername(name))[1] = public.current_clerk_id()
  );
create policy swing_videos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'swing-videos'
    and (storage.foldername(name))[1] = public.current_clerk_id()
  );
create policy swing_videos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'swing-videos'
    and (storage.foldername(name))[1] = public.current_clerk_id()
  );
