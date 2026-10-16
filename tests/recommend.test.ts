import { describe, expect, it } from 'vitest';
import { recommendClub } from '@/lib/clubs/recommend';
import { makeClub } from './fixtures';

const bag = [
  makeClub({ name: 'Driver', clubType: 'driver', carryYards: 240, confidence: 'high' }),
  makeClub({ name: '7-iron', clubType: 'iron', carryYards: 145, confidence: 'medium' }),
  makeClub({ name: 'Pitching wedge', clubType: 'wedge', carryYards: 115, confidence: 'medium' }),
  makeClub({ name: 'Putter', clubType: 'putter', carryYards: 2, confidence: 'high' }),
];

describe('recommendClub', () => {
  it('picks the closest club to the target', () => {
    const rec = recommendClub(bag, 142)!;
    expect(rec.club.name).toBe('7-iron');
    expect(rec.explanation).toContain('145');
    expect(rec.explanation).toContain('142');
  });

  it('never suggests the putter off the green', () => {
    expect(recommendClub(bag, 2)!.club.name).not.toBe('Putter');
  });

  it('conservative mode prefers a club that covers the distance', () => {
    // target 125: wedge 115 (-10 short), iron 145 (+20 long)
    const rec = recommendClub(bag, 125, { preferConservative: true })!;
    expect(rec.club.name).toBe('7-iron'); // tightest cover beats coming up short
    const normal = recommendClub(bag, 125)!;
    expect(normal.club.name).toBe('Pitching wedge'); // nearest without preference
  });

  it('returns null when the bag has no usable distances', () => {
    expect(recommendClub([], 145)).toBeNull();
    expect(recommendClub([makeClub({ carryYards: null, totalYards: null })], 145)).toBeNull();
  });

  it('flags estimated when only total distance or low confidence is known', () => {
    const looseBag = [makeClub({ name: '5-wood', clubType: 'wood', carryYards: null, totalYards: 180, confidence: 'low' })];
    const rec = recommendClub(looseBag, 175)!;
    expect(rec.estimated).toBe(true);
    expect(rec.explanation).toContain('low');
  });
});
