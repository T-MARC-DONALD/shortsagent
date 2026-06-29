// video-generator.ts — three-tier fallback rendering engine (server-side)
// Real ffmpeg/sharp pipelines are stubbed here for the demo environment;
// the function signatures match what the spec calls out.

export interface ClipSegment {
  start: number; // seconds
  end: number;   // seconds
  reason: string;
  viralScore: number;
}

export interface GenerateOptions {
  youtubeId: string;
  title: string;
  hookType?: "shock" | "curiosity" | "fomo" | "emotion" | "listicle";
  audioTrack?: string;
  watermark?: string;
  segments?: ClipSegment[];
}

export interface GenerateResult {
  ok: boolean;
  filePath?: string;
  mode: "drawtext" | "png_overlay" | "drawbox_only" | "synthetic";
  segments: ClipSegment[];
  durationSec: number;
  error?: string;
}

/**
 * Identify the most clip-worthy segments of a source video.
 * Uses an LLM-driven heuristic in production; here we generate
 * deterministic segments based on duration.
 */
export function identifySegments(
  durationSec: number,
  count = 3
): ClipSegment[] {
  const segs: ClipSegment[] = [];
  const clipLen = 30; // 30s clips
  const step = Math.max(20, Math.floor((durationSec - clipLen) / Math.max(1, count - 1)));
  const reasons = [
    "Opening hook with peak retention",
    "Mid-video pay-off / reveal moment",
    "Emotional peak with high comment density",
    "Recap and CTA — high share-rate window",
    "Controversial claim drives engagement",
  ];
  for (let i = 0; i < count; i++) {
    const start = Math.min(durationSec - clipLen, step * i + 10);
    segs.push({
      start,
      end: start + clipLen,
      reason: reasons[i % reasons.length],
      viralScore: 70 + ((i * 7) % 25),
    });
  }
  return segs;
}

/**
 * Estimate how many viable Shorts can be extracted.
 */
export function estimateShorts(durationSec: number): number {
  if (durationSec < 60) return 0;
  if (durationSec < 300) return 1;
  if (durationSec < 600) return 2;
  if (durationSec < 1200) return 3;
  if (durationSec < 1800) return 4;
  return Math.min(8, Math.floor(durationSec / 360));
}

/**
 * Three-tier render pipeline.
 * In production this calls ffmpeg via child_process with auto-fallback:
 *   1. drawtext mode (libfreetype required)
 *   2. PNG overlay mode (sharp pre-renders text → ffmpeg overlay)
 *   3. drawbox-only mode (no text — never crashes)
 * Plus a synthetic gradient fallback when no source video is available.
 *
 * In this sandbox we don't have ffmpeg guaranteed, so we simulate success
 * and return a synthetic file path. The interface is stable.
 */
export async function generateShort(opts: GenerateOptions): Promise<GenerateResult> {
  const segments = opts.segments?.length
    ? opts.segments
    : identifySegments(600);
  const primary = segments[0];

  // Simulate render — pick the best mode that would succeed in prod.
  const mode: GenerateResult["mode"] = "drawtext";
  const filePath = `/clips/${opts.youtubeId}_${Date.now()}.mp4`;

  // In production, here we'd:
  // 1. yt-dlp download source
  // 2. ffmpeg cut segment → scale 1080x1920
  // 3. Burn hook badge + title + subtitle + watermark + progress bar
  // 4. Mix in selected audio track
  // 5. Move to /public${filePath}

  return {
    ok: true,
    filePath,
    mode,
    segments,
    durationSec: primary.end - primary.start,
  };
}

/**
 * Build the title/hook overlay metadata that the renderer consumes.
 */
export function buildOverlay(
  title: string,
  hookType?: "shock" | "curiosity" | "fomo" | "emotion" | "listicle"
) {
  const badgeLabels: Record<string, string> = {
    shock: "🚨 SHOCKING",
    curiosity: "🤔 WAIT FOR IT",
    fomo: "⏰ DON'T MISS",
    emotion: "❤️ EMOTIONAL",
    listicle: "📊 TOP PICKS",
  };
  return {
    badge: badgeLabels[hookType ?? "curiosity"] ?? "🔥 MUST WATCH",
    title: title.length > 60 ? title.slice(0, 57) + "…" : title,
    subtitle: "Follow @ShortsAgent for more",
    watermark: "@ShortsAgent",
  };
}
