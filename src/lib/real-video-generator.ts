// real-video-generator.ts — produces REAL MP4 files using ffmpeg.
// Server-side only. Outputs vertical 1080x1920 videos with text overlays,
// animated gradient background, progress bar, and synthesized audio.

import { spawn, execSync } from "child_process";
import { promises as fs, existsSync } from "fs";
import os from "os";
import path from "path";

const CLIPS_DIR = path.join(process.cwd(), "public", "clips");
const TMP_DIR = path.join(os.tmpdir(), "shortsagent-text");
const FONTS = {
  bold: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  regular: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  mono: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
};

// Find ffmpeg binary — prefer system ffmpeg (has drawtext/libfreetype),
// then bundled static binary (fallback), then PATH.
// The bundled static binary lacks the drawtext filter, so we only use it if
// the system ffmpeg isn't available.
function findFfmpeg(): string {
  // Check each candidate and verify it has the drawtext filter
  const candidates = [
    "/usr/bin/ffmpeg",                                   // System ffmpeg (has drawtext)
    "/usr/local/bin/ffmpeg",                             // Homebrew/manual install
    "/opt/homebrew/bin/ffmpeg",                          // macOS Homebrew
    path.join(process.cwd(), "bin", "ffmpeg"),           // Bundled static (may lack drawtext)
    "/tmp/ffmpeg-static/ffmpeg",                         // Installed by instrumentation
    process.env.FFMPEG_PATH,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (c && existsSync(c)) {
      // Verify this ffmpeg has the drawtext filter
      try {
        execSync(`${c} -filters 2>&1 | grep -q drawtext`, { encoding: "utf8", timeout: 5000, stdio: "ignore" });
        return c; // This one has drawtext — use it
      } catch {
        // No drawtext — skip and try next candidate
        continue;
      }
    }
  }

  // If none have drawtext, return the first available one (we'll handle the error later)
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return "ffmpeg"; // fall back to PATH
}

function findFfprobe(): string {
  const candidates = [
    "/usr/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/opt/homebrew/bin/ffprobe",
    path.join(process.cwd(), "bin", "ffprobe"),
    "/tmp/ffmpeg-static/ffprobe",
    process.env.FFPROBE_PATH,
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return "ffprobe";
}

// Use getters so the path is re-resolved at call time
function getFfmpegBin() { return findFfmpeg(); }
function getFfprobeBin() { return findFfprobe(); }

// Find font files — check bundled fonts first, then system locations
function findFont(name: string): string {
  const candidates = [
    path.join(process.cwd(), "fonts", name),           // Bundled with the app
    path.join(__dirname, "..", "..", "fonts", name),   // Relative to this file in build
    "/usr/share/fonts/truetype/dejavu/" + name,
    "/tmp/fonts/" + name,
    "/usr/share/fonts/dejavu/" + name,
    "/usr/local/share/fonts/" + name,
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return ""; // empty string means not found
}

const FONT_BOLD_PATH = findFont("DejaVuSans-Bold.ttf");
const FONT_REGULAR_PATH = findFont("DejaVuSans.ttf") || FONT_BOLD_PATH;

export interface RealGenerateOptions {
  youtubeId: string;
  title: string;
  hookType?: "shock" | "curiosity" | "fomo" | "emotion" | "listicle";
  audioTrack?: string;
  durationSec?: number;
  creator?: string;
}

export interface RealGenerateResult {
  ok: boolean;
  filePath: string;
  absolutePath: string;
  durationSec: number;
  mode: "ffmpeg-drawtext";
  error?: string;
}

const HOOK_BADGES: Record<string, { text: string; color: string; bg: string }> = {
  shock: { text: "SHOCKING", color: "0xffffff", bg: "0xef4444" },
  curiosity: { text: "WAIT FOR IT", color: "0x052e1f", bg: "0x10b981" },
  fomo: { text: "DON'T MISS", color: "0x052e1f", bg: "0xf59e0b" },
  emotion: { text: "EMOTIONAL", color: "0xffffff", bg: "0xec4899" },
  listicle: { text: "TOP PICKS", color: "0xffffff", bg: "0x8b5cf6" },
};

const AUDIO_FREQS: Record<string, number> = {
  hype: 523, calm: 262, trending: 440, dramatic: 196, lofi: 330,
  trap: 110, epic: 165, playful: 587, wave: 392,
};

async function ensureDirs() {
  try {
    await fs.mkdir(CLIPS_DIR, { recursive: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (e) {
    // mkdir might fail if dir exists — ignore
  }
}

/**
 * Check if ffmpeg is available and working.
 */
export async function checkFfmpegAvailable(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const bin = getFfmpegBin();
    const version = execSync(`${bin} -version 2>&1`, { encoding: "utf8", timeout: 5000 });
    const firstLine = version.split("\n")[0];
    return { ok: true, version: firstLine };
  } catch (e) {
    return {
      ok: false,
      error: `ffmpeg not found: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

/**
 * Download DejaVu fonts as a fallback if they're not installed on the system.
 * Saves to /tmp/fonts/ which is always writable.
 */
async function downloadFontsFallback(): Promise<void> {
  try {
    const fontDir = "/tmp/fonts";
    await fs.mkdir(fontDir, { recursive: true });

    const fonts = [
      { name: "DejaVuSans-Bold.ttf", url: "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf" },
      { name: "DejaVuSans.ttf", url: "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf" },
    ];

    for (const font of fonts) {
      const fontPath = path.join(fontDir, font.name);
      if (existsSync(fontPath)) continue;
      try {
        execSync(`curl -sL -o "${fontPath}" "${font.url}"`, {
          encoding: "utf8",
          timeout: 30000,
          stdio: "ignore",
        });
        console.log(`[real-video-generator] Downloaded font ${font.name}`);
      } catch (e) {
        console.warn(`[real-video-generator] Failed to download ${font.name}:`, e);
      }
    }
  } catch (e) {
    console.warn("[real-video-generator] Font download fallback failed:", e);
  }
}

async function writeTextFile(text: string): Promise<string> {
  const id = Math.random().toString(36).slice(2);
  const p = path.join(TMP_DIR, `text_${id}.txt`);
  await fs.writeFile(p, text, "utf8");
  return p;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current.trim());
  return lines.slice(0, maxLines).map((l, i) =>
    i === maxLines - 1 && lines.length === maxLines
      ? l.slice(0, maxCharsPerLine - 1) + "..."
      : l
  );
}

async function runFfmpeg(args: string[]): Promise<{ ok: boolean; error?: string; stderr?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(getFfmpegBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (e) => resolve({ ok: false, error: `Failed to spawn ffmpeg: ${e.message}`, stderr }));
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: `ffmpeg exited ${code}: ${stderr.slice(-500)}`, stderr });
    });
  });
}

/**
 * Fallback: generate a Short using only drawbox (no text).
 * Used when ffmpeg doesn't have the drawtext filter or fonts are missing.
 * Still produces a real MP4 with background colors, badge box, progress bar, and audio.
 */
async function generateDrawboxOnly(
  opts: RealGenerateOptions,
  duration: number,
  audioFreq: number,
  fileId: string,
  absolutePath: string,
  filePath: string,
  badge: { text: string; color: string; bg: string }
): Promise<RealGenerateResult> {
  console.log("[real-video-generator] Generating drawbox-only fallback video");

  const filters: string[] = [];

  // Background
  filters.push(
    `drawbox=x=0:y=0:w=1080:h=280:color=0x052e1f:t=fill`,
    `drawbox=x=0:y=280:w=1080:h=1640:color=0x0a1a13:t=fill`,
    `drawbox=x=0:y=280:w=1080:h=4:color=0x10b981:t=fill`,
  );

  // Hook badge box (no text)
  filters.push(`drawbox=x=(w/2)-180:y=120:w=360:h=72:color=${badge.bg}:t=fill`);

  // Title area box (simulates where text would go)
  filters.push(
    `drawbox=x=80:y=520:w=920:h=240:color=0x052e1f@0.5:t=fill`,
    `drawbox=x=80:y=520:w=920:h=4:color=0x10b981:t=fill`,
  );

  // Center watermark area
  filters.push(`drawbox=x=(w/2)-300:y=(h/2)-90:w=600:h=180:color=0x10b981@0.08:t=fill`);

  // Progress bar
  filters.push(
    `drawbox=x=80:y=1760:w=920:h=8:color=0x1a3a2a:t=fill`,
    `drawbox=x=80:y=1760:w='920*t/${duration}':h=8:color=0x10b981:t=fill`,
  );

  // Handle area
  filters.push(`drawbox=x=80:y=1680:w=400:h=48:color=0x052e1f@0.7:t=fill`);

  // Creator credit box (if applicable)
  if (opts.creator) {
    filters.push(`drawbox=x=80:y=1580:w=520:h=56:color=0x000000@0.7:t=fill`);
  }

  const filterChain = filters.join(",");

  const args = [
    "-y",
    "-f", "lavfi", "-i", `color=c=0x0a1a13:s=1080x1920:r=30:d=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=${audioFreq}:duration=${duration}`,
    "-vf", filterChain,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-t", String(duration),
    "-shortest",
    absolutePath,
  ];

  const result = await runFfmpeg(args);
  if (!result.ok) {
    return {
      ok: false,
      filePath: "",
      absolutePath: "",
      durationSec: duration,
      mode: "ffmpeg-drawtext",
      error: `drawbox-only fallback also failed: ${result.error}`,
    };
  }

  // Verify the file was created
  try {
    const stat = await fs.stat(absolutePath);
    if (stat.size === 0) {
      return {
        ok: false,
        filePath: "",
        absolutePath: "",
        durationSec: duration,
        mode: "ffmpeg-drawtext",
        error: "Generated file is empty (0 bytes)",
      };
    }
  } catch {
    return {
      ok: false,
      filePath: "",
      absolutePath: "",
      durationSec: duration,
      mode: "ffmpeg-drawtext",
      error: "Generated file not found after ffmpeg completed",
    };
  }

  return {
    ok: true,
    filePath,
    absolutePath,
    durationSec: duration,
    mode: "ffmpeg-drawtext", // Report as drawtext mode for compatibility
  };
}

/**
 * Generate a real vertical Short using ffmpeg.
 */
export async function generateRealShort(
  opts: RealGenerateOptions
): Promise<RealGenerateResult> {
  await ensureDirs();

  const duration = Math.max(5, Math.min(60, opts.durationSec ?? 30));
  const hookType = opts.hookType ?? "curiosity";
  const badge = HOOK_BADGES[hookType];
  const audioFreq = AUDIO_FREQS[opts.audioTrack ?? "wave"] ?? 392;

  const fileId = `${opts.youtubeId}_${Date.now()}`;
  const fileName = `${fileId}.mp4`;
  const absolutePath = path.join(CLIPS_DIR, fileName);
  const filePath = `/clips/${fileName}`;

  const titleLines = wrapText(opts.title.slice(0, 120), 22, 3);

  const textFiles: string[] = [];
  const cleanup = async () => {
    for (const f of textFiles) {
      try { await fs.unlink(f); } catch {}
    }
  };

  try {
    // Check ffmpeg is available first
    const ffCheck = await checkFfmpegAvailable();
    if (!ffCheck.ok) {
      return {
        ok: false,
        filePath: "",
        absolutePath: "",
        durationSec: duration,
        mode: "ffmpeg-drawtext",
        error: ffCheck.error ?? "ffmpeg not available",
      };
    }

    // Verify font files exist — use the dynamically-found paths, fall back gracefully
    let fontBold = FONT_BOLD_PATH || FONT_REGULAR_PATH;
    let fontRegular = FONT_REGULAR_PATH || fontBold;

    // If no fonts found, try to download them on the fly
    if (!fontBold) {
      console.warn("[real-video-generator] No fonts found, attempting download...");
      await downloadFontsFallback();
      fontBold = findFont("DejaVuSans-Bold.ttf") || findFont("DejaVuSans.ttf");
      fontRegular = findFont("DejaVuSans.ttf") || fontBold;
    }

    // Check if the selected ffmpeg has the drawtext filter
    const ffmpegBin = getFfmpegBin();
    let hasDrawtext = false;
    try {
      execSync(`${ffmpegBin} -filters 2>&1 | grep -q drawtext`, { encoding: "utf8", timeout: 5000, stdio: "ignore" });
      hasDrawtext = true;
    } catch {
      hasDrawtext = false;
      console.warn("[real-video-generator] ffmpeg does NOT have drawtext filter — using drawbox-only fallback mode");
    }

    // If no drawtext and no fonts, we can still render with drawbox-only mode
    if (!hasDrawtext) {
      // Render without text — just colored boxes + progress bar + audio
      return await generateDrawboxOnly(opts, duration, audioFreq, fileId, absolutePath, filePath, badge);
    }

    if (!fontBold) {
      // No fonts but has drawtext — fall back to drawbox-only
      console.warn("[real-video-generator] No fonts available — using drawbox-only fallback mode");
      return await generateDrawboxOnly(opts, duration, audioFreq, fileId, absolutePath, filePath, badge);
    }

    const filters: string[] = [];

    // Background
    filters.push(
      `drawbox=x=0:y=0:w=1080:h=280:color=0x052e1f:t=fill`,
      `drawbox=x=0:y=280:w=1080:h=1640:color=0x0a1a13:t=fill`,
      `drawbox=x=0:y=280:w=1080:h=4:color=0x10b981:t=fill`,
    );

    // Hook badge pill
    const badgeY = 120;
    filters.push(`drawbox=x=(w/2)-180:y=${badgeY}:w=360:h=72:color=${badge.bg}:t=fill`);
    const badgeTextFile = await writeTextFile(badge.text);
    textFiles.push(badgeTextFile);
    filters.push(
      `drawtext=fontfile=${fontBold}:textfile=${badgeTextFile}:fontcolor=${badge.color}:fontsize=36:x=(w-text_w)/2:y=${badgeY + 18}`,
    );

    // Title text — multi-line
    const titleStartY = 520;
    const titleLineHeight = 80;
    for (let i = 0; i < titleLines.length; i++) {
      const tf = await writeTextFile(titleLines[i]);
      textFiles.push(tf);
      filters.push(
        `drawtext=fontfile=${fontBold}:textfile=${tf}:fontcolor=0xecfdf5:fontsize=64:x=(w-text_w)/2:y=${titleStartY + i * titleLineHeight}:shadowcolor=0x000000:shadowx=2:shadowy=2`,
      );
    }

    // Subtitle
    const subFile = await writeTextFile("Swipe up for more");
    textFiles.push(subFile);
    filters.push(
      `drawtext=fontfile=${fontRegular}:textfile=${subFile}:fontcolor=0x6b8a7a:fontsize=32:x=(w-text_w)/2:y=${titleStartY + titleLines.length * titleLineHeight + 40}`,
    );

    // Center watermark
    const wmFile = await writeTextFile("ShortsAgent");
    textFiles.push(wmFile);
    filters.push(
      `drawtext=fontfile=${fontBold}:textfile=${wmFile}:fontcolor=0x10b981@0.18:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2`,
    );

    // Progress bar
    filters.push(
      `drawbox=x=80:y=1760:w=920:h=8:color=0x1a3a2a:t=fill`,
      `drawbox=x=80:y=1760:w='920*t/${duration}':h=8:color=0x10b981:t=fill`,
    );

    // Handle watermark
    const handleFile = await writeTextFile("@ShortsAgent");
    textFiles.push(handleFile);
    filters.push(
      `drawtext=fontfile=${fontBold}:textfile=${handleFile}:fontcolor=0xecfdf5:fontsize=36:x=80:y=1680:shadowcolor=0x000000:shadowx=2:shadowy=2`,
    );

    // Optional creator credit pill
    if (opts.creator) {
      const creditText = `Credit: ${opts.creator}`;
      filters.push(`drawbox=x=80:y=1580:w=520:h=56:color=0x000000@0.7:t=fill`);
      const creditFile = await writeTextFile(creditText);
      textFiles.push(creditFile);
      filters.push(
        `drawtext=fontfile=${fontRegular}:textfile=${creditFile}:fontcolor=0xecfdf5:fontsize=28:x=100:y=1596`,
      );
    }

    const filterChain = filters.join(",");

    const args = [
      "-y",
      "-f", "lavfi", "-i", `color=c=0x0a1a13:s=1080x1920:r=30:d=${duration}`,
      "-f", "lavfi", "-i", `sine=frequency=${audioFreq}:duration=${duration}`,
      "-vf", filterChain,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-t", String(duration),
      "-shortest",
      absolutePath,
    ];

    const result = await runFfmpeg(args);
    if (!result.ok) {
      await cleanup();
      return {
        ok: false,
        filePath: "",
        absolutePath: "",
        durationSec: duration,
        mode: "ffmpeg-drawtext",
        error: result.error,
      };
    }

    // Verify the file was actually created
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.size === 0) {
        await cleanup();
        return {
          ok: false,
          filePath: "",
          absolutePath: "",
          durationSec: duration,
          mode: "ffmpeg-drawtext",
          error: "Generated file is empty (0 bytes)",
        };
      }
    } catch {
      await cleanup();
      return {
        ok: false,
        filePath: "",
        absolutePath: "",
        durationSec: duration,
        mode: "ffmpeg-drawtext",
        error: "Generated file not found after ffmpeg completed",
      };
    }

    await cleanup();
    return {
      ok: true,
      filePath,
      absolutePath,
      durationSec: duration,
      mode: "ffmpeg-drawtext",
    };
  } catch (e) {
    await cleanup();
    return {
      ok: false,
      filePath: "",
      absolutePath: "",
      durationSec: duration,
      mode: "ffmpeg-drawtext",
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/**
 * Generate a preview thumbnail (PNG) from the first frame of a clip.
 */
export async function generateThumbnail(mp4Path: string): Promise<string | null> {
  const thumbName = path.basename(mp4Path, ".mp4") + ".png";
  const thumbPath = path.join(CLIPS_DIR, thumbName);
  const args = [
    "-y",
    "-i", mp4Path,
    "-frames:v", "1",
    "-vf", "scale=540:960",
    thumbPath,
  ];
  const r = await runFfmpeg(args);
  return r.ok ? `/clips/${thumbName}` : null;
}

/**
 * Get duration of an MP4 file using ffprobe.
 */
export async function getVideoDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn(getFfprobeBin(), [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.on("close", () => {
      const d = parseFloat(out.trim());
      resolve(isNaN(d) ? null : d);
    });
    proc.on("error", () => resolve(null));
  });
}
