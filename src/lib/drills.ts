import type { PracticeDrill } from '@/types/domain';

/** Curated drill catalog — also seeded into the practice_drills table. */
export const DRILL_CATALOG: Omit<PracticeDrill, 'id'>[] = [
  {
    slug: 'gate-putting',
    name: 'Gate Putting',
    skill: 'putting',
    description: 'Start every putt on line by rolling the ball through a tee gate.',
    steps: [
      'Place two tees a ball-width apart, 2 feet ahead of the ball on your start line.',
      'Putt from 4–6 feet and roll the ball cleanly through the gate.',
      'Move to 8–10 feet once you hit 8 of 10.',
    ],
    durationMinutes: 10,
    equipment: ['Putter', '2 tees', '3 balls'],
  },
  {
    slug: 'clock-putting',
    name: 'Clock Ladder',
    skill: 'putting',
    description: 'Builds pace control around the hole from every angle.',
    steps: [
      'Set balls at 3, 6, 9, and 12 o’clock around the hole, 4 feet out.',
      'Hole all four. Move each out a foot and repeat to 8 feet.',
      'Stop after completing the 8-foot ring twice.',
    ],
    durationMinutes: 15,
    equipment: ['Putter', '4 balls'],
  },
  {
    slug: 'landing-spot-chipping',
    name: 'Landing-Spot Chipping',
    skill: 'chipping',
    description: 'Trains carry-distance control by hitting a towel target.',
    steps: [
      'Lay a towel 10–15 feet onto the green as your landing zone.',
      'Chip to land the ball on the towel and let it release.',
      'Alternate between two clubs and note how release changes.',
    ],
    durationMinutes: 15,
    equipment: ['Wedge', 'Iron or hybrid', 'Towel', '6 balls'],
  },
  {
    slug: 'alignment-sticks-station',
    name: 'Alignment Station',
    skill: 'alignment',
    description: 'Rebuilds a square setup with a two-stick reference frame.',
    steps: [
      'Lay one stick on your target line and one parallel at your feet.',
      'Hit 10 balls checking feet, hips, and shoulders against the sticks.',
      'Remove the sticks for 5 balls, then recheck — feel vs real.',
    ],
    durationMinutes: 12,
    equipment: ['2 alignment sticks', 'Mid-iron', '15 balls'],
  },
  {
    slug: 'metronome-tempo',
    name: 'Tempo Ladder',
    skill: 'tempo',
    description: 'Smooths the backswing-to-downswing ratio using a count.',
    steps: [
      'Swing counting “one” to the top, “two” through impact.',
      'Hit 10 wedges keeping the count identical each swing.',
      'Repeat with a mid-iron, then driver — same count.',
    ],
    durationMinutes: 10,
    equipment: ['Any three clubs', '15 balls'],
  },
  {
    slug: 'nine-shot-window',
    name: 'Nine-Shot Window',
    skill: 'distance control',
    description: 'Grooves low / stock / high flights with one iron.',
    steps: [
      'Pick a mid-iron and a green target.',
      'Hit 3 low, 3 stock, 3 high shots to the same target.',
      'Note the carry difference — that is your wind toolkit.',
    ],
    durationMinutes: 20,
    equipment: ['Mid-iron', '15 balls'],
  },
  {
    slug: 'step-change-sequencing',
    name: 'Step-Change Sequence',
    skill: 'swing sequencing',
    description: 'Trains lower-body-led downswing with a step drill.',
    steps: [
      'Set up with feet together, club hovering.',
      'Step toward the target as you start down, then swing through.',
      'Blend to a normal stance after 10 reps.',
    ],
    durationMinutes: 12,
    equipment: ['Mid-iron', '10 balls'],
  },
  {
    slug: 'impact-bag-strike',
    name: 'Impact Position Reps',
    skill: 'impact',
    description: 'Rehearses a forward-leaning, compressed impact.',
    steps: [
      'Make slow-motion swings stopping at an impact bag (or pillow).',
      'Hold impact 3 seconds: hands ahead, hips open, head steady.',
      'Hit 8 half-shots copying that feel.',
    ],
    durationMinutes: 10,
    equipment: ['Mid-iron', 'Impact bag or pillow', '8 balls'],
  },
];

export function drillsForSkill(skill: string): Omit<PracticeDrill, 'id'>[] {
  return DRILL_CATALOG.filter((d) => d.skill.toLowerCase() === skill.toLowerCase());
}

export function drillBySlug(slug: string): Omit<PracticeDrill, 'id'> | undefined {
  return DRILL_CATALOG.find((d) => d.slug === slug);
}
