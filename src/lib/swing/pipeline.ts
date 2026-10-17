import { newId } from '@/lib/id';
import { MAX_FRAMES, planFrameTimestamps } from '@/lib/swing/frames';
import type { SwingCameraView } from '@/types/domain';
import * as FileSystem from 'expo-file-system/legacy';
import { createVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * On-device video pipeline:
 *  1. Copy the recorded/picked video into the app's document directory so it
 *     persists across restarts (camera-roll copies can be deleted by the user).
 *  2. Read the real duration via expo-video.
 *  3. Extract strategically-spaced JPEG frames with timestamps — only these
 *     frames ever leave the device for AI analysis.
 */

const VIDEOS_DIR = `${FileSystem.documentDirectory}videos/`;
export { MAX_FRAMES };

export interface ExtractedFrame {
  uri: string;
  timestampSec: number;
}

export interface PreparedSwing {
  videoId: string;
  /** persistent file:// uri inside the app's document directory */
  localUri: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  frames: ExtractedFrame[];
}

async function ensureVideosDir() {
  await FileSystem.makeDirectoryAsync(VIDEOS_DIR, { intermediates: true }).catch(() => {});
}

/** Copy a video into app storage under a stable id. Returns the new uri. */
export async function persistSwingVideo(sourceUri: string): Promise<{
  videoId: string;
  localUri: string;
  sizeBytes: number | null;
}> {
  await ensureVideosDir();
  const ext = (sourceUri.split('.').pop() ?? 'mp4').split('?')[0].toLowerCase();
  const videoId = newId();
  const localUri = `${VIDEOS_DIR}${videoId}.${ext === 'mov' ? 'mov' : 'mp4'}`;
  await FileSystem.copyAsync({ from: sourceUri, to: localUri });
  const info = await FileSystem.getInfoAsync(localUri);
  return { videoId, localUri, sizeBytes: info.exists ? info.size ?? null : null };
}

/** Read the real duration (seconds) of a local video via expo-video. */
export async function getVideoDuration(videoUri: string): Promise<number | null> {
  let player: ReturnType<typeof createVideoPlayer> | null = null;
  try {
    player = createVideoPlayer(videoUri);
    const duration = await new Promise<number | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      if (player!.duration > 0) {
        clearTimeout(timeout);
        resolve(player!.duration);
        return;
      }
      const sub = player!.addListener('sourceLoad', (payload) => {
        clearTimeout(timeout);
        sub.remove();
        resolve(payload.duration > 0 ? payload.duration : null);
      });
    });
    return duration;
  } catch {
    return null;
  } finally {
    try {
      player?.release();
    } catch {
      // best-effort cleanup
    }
  }
}

/** Extract JPEG frames at the planned timestamps. Skips unreadable offsets. */
export async function extractFrames(
  videoUri: string,
  durationSeconds: number | null,
): Promise<ExtractedFrame[]> {
  const times = planFrameTimestamps(durationSeconds);
  const frames: ExtractedFrame[] = [];
  for (const t of times) {
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: Math.round(t * 1000),
        quality: 0.7,
      });
      frames.push({ uri: thumb.uri, timestampSec: Math.round(t * 100) / 100 });
    } catch {
      // timestamp past the end of a short video — skip
    }
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

/** Full prepare step: persist video + read duration + extract frames. */
export async function prepareSwing(
  sourceUri: string,
  opts: { cameraView: SwingCameraView; clubType?: string },
): Promise<PreparedSwing> {
  const { videoId, localUri, sizeBytes } = await persistSwingVideo(sourceUri);
  const durationSeconds = await getVideoDuration(localUri);
  const frames = await extractFrames(localUri, durationSeconds);
  return { videoId, localUri, durationSeconds, sizeBytes, frames };
}
