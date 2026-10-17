/**
 * Pure frame-sampling schedule for swing analysis — kept dependency-free so it
 * can be unit-tested. The pipeline calls this with the real video duration.
 */

export const MAX_FRAMES = 12;

/**
 * Sample timestamps across the video: evenly spaced from ~0.1s through
 * (duration - 0.15s) so we cover setup → impact and keep tail frames for the
 * follow-through. When duration is unknown, falls back to a schedule tuned
 * for typical 3–15s swing clips; out-of-range frames are skipped at
 * extraction time.
 */
export function planFrameTimestamps(
  durationSeconds: number | null,
  maxFrames = MAX_FRAMES,
): number[] {
  if (durationSeconds != null && durationSeconds > 0.5) {
    const end = Math.max(0.2, durationSeconds - 0.15);
    const times: number[] = [];
    for (let i = 0; i < maxFrames; i++) {
      times.push(Math.min(end, 0.1 + (i * (end - 0.1)) / (maxFrames - 1)));
    }
    return times;
  }
  return [0.2, 0.5, 0.8, 1.2, 1.7, 2.3, 3.0, 4.0, 5.2, 6.8, 9.0, 12.0].slice(0, maxFrames);
}
