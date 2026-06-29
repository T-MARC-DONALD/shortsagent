import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkFfmpegAvailable } from "@/lib/real-video-generator";
import { existsSync } from "fs";
import path from "path";

// GET /api/system-check — system health check
export async function GET() {
  try {
    // Real ffmpeg check (re-resolves path at call time, checks bundled binary first)
    const ffmpegCheck = await checkFfmpegAvailable();

    // Check ffprobe at known locations (including bundled)
    const ffprobePaths = [
      path.join(process.cwd(), "bin", "ffprobe"),
      "/usr/bin/ffprobe",
      "/usr/local/bin/ffprobe",
      "/tmp/ffmpeg-static/ffprobe",
    ];
    let ffprobeOk = false;
    for (const p of ffprobePaths) {
      if (existsSync(p)) {
        try {
          const { execSync } = await import("child_process");
          execSync(`${p} -version 2>&1`, { encoding: "utf8", timeout: 5000, stdio: "ignore" });
          ffprobeOk = true;
          break;
        } catch {}
      }
    }

    // Check yt-dlp
    let ytdlpOk = false;
    let ytdlpVersion = "";
    try {
      const { execSync } = await import("child_process");
      const out = execSync("yt-dlp --version 2>&1", { encoding: "utf8", timeout: 5000 });
      ytdlpOk = true;
      ytdlpVersion = out.trim();
    } catch {
      ytdlpOk = false;
    }

    // Check clips directory is writable
    const clipsDir = path.join(process.cwd(), "public", "clips");
    let clipsDirOk = false;
    try {
      const { mkdir, writeFile, unlink } = await import("fs/promises");
      await mkdir(clipsDir, { recursive: true });
      const testFile = path.join(clipsDir, ".write-test");
      await writeFile(testFile, "test");
      await unlink(testFile);
      clipsDirOk = true;
    } catch {
      clipsDirOk = false;
    }

    // Check fonts at multiple locations (including bundled)
    const fontPaths = [
      path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"),
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/tmp/fonts/DejaVuSans-Bold.ttf",
    ];
    const fontRegularPaths = [
      path.join(process.cwd(), "fonts", "DejaVuSans.ttf"),
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/tmp/fonts/DejaVuSans.ttf",
    ];
    const fonts = {
      bold: fontPaths.some(existsSync),
      regular: fontRegularPaths.some(existsSync),
    };

    // DB health
    let dbStatus: "ok" | "error" = "ok";
    try {
      await db.video.count();
    } catch {
      dbStatus = "error";
    }

    let settings = false;
    try {
      const s = await db.agentSettings.findUnique({ where: { id: "global" } });
      settings = !!s;
    } catch {
      settings = false;
    }

    const accountsConnected = await db.socialAccount
      .count({ where: { connected: true } })
      .catch(() => 0);

    const queueDepth = await db.video
      .count({
        where: {
          status: { in: ["discovered", "generating", "ready", "posting"] },
        },
      })
      .catch(() => 0);

    const uptimeMs = process.uptime() * 1000;

    return NextResponse.json({
      ffmpeg: {
        available: ffmpegCheck.ok,
        version: ffmpegCheck.version,
        error: ffmpegCheck.error,
      },
      ffprobe: { available: ffprobeOk },
      ytDlp: { available: ytdlpOk, version: ytdlpVersion },
      clipsDir: { path: clipsDir, writable: clipsDirOk },
      fonts,
      db: dbStatus,
      settings,
      accountsConnected,
      queueDepth,
      uptime: formatUptime(uptimeMs),
      // Overall: can the app generate videos?
      canGenerateVideos: ffmpegCheck.ok && clipsDirOk && (fonts.bold || fonts.regular),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
