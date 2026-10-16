import { describe, expect, it } from 'vitest';
import { distanceInUnits, formatDistance, haversineMeters, metersToYards } from '@/lib/geo';

// Two well-separated known points: 500m apart on the equator is ~0.0045° lng.
const TEE = { latitude: 35.0, longitude: -78.5 };
const GREEN_150Y_AWAY = { latitude: 35.0, longitude: -78.5 - 150 * 0.9144 / 111320 / Math.cos((35 * Math.PI) / 180) };

describe('haversineMeters', () => {
  it('computes ~137m for a 150-yard-equivalent offset', () => {
    const m = haversineMeters(TEE, GREEN_150Y_AWAY);
    expect(m).toBeGreaterThan(130);
    expect(m).toBeLessThan(145);
  });

  it('returns 0 for identical points', () => {
    expect(haversineMeters(TEE, TEE)).toBe(0);
  });
});

describe('unit conversion', () => {
  it('converts meters to yards', () => {
    expect(metersToYards(91.44)).toBeCloseTo(100, 1);
  });

  it('distanceInUnits honors the units argument', () => {
    const yards = distanceInUnits(TEE, GREEN_150Y_AWAY, 'yards');
    const meters = distanceInUnits(TEE, GREEN_150Y_AWAY, 'meters');
    expect(yards).toBeCloseTo(150, 0);
    expect(meters).toBeCloseTo(137.2, 0);
  });
});

describe('formatDistance', () => {
  it('formats rounded yardage', () => {
    expect(formatDistance(142.4, 'yards')).toBe('142 yd');
    expect(formatDistance(130, 'meters')).toBe('130 m');
  });
});
