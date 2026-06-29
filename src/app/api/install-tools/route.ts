import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/install-tools
 * Makes the bundled ffmpeg and fonts available.
 * The binaries are already bundled at ./bin/ffmpeg and ./fonts/ — this endpoint
 * just makes them executable and symlinks them to /tmp for PATH access.
 */
export async function POST(req: NextRequest) {
  const log: string[] = [];
  const step = (msg: string) => {
    console.log(`[install-tools] ${msg}`);
    log.push(msg);
  };

  try {
    step("Starting tool setup...");

    const bundledFfmpeg = path.join(process.cwd(), "bin", "ffmpeg");
    const bundledFfprobe = path.join(process.cwd(), "bin", "ffprobe");
    const bundledFontBold = path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf");
    const bundledFontRegular = path.join(process.cwd(), "fonts", "DejaVuSans.ttf");

    step(`Checking bundled ffmpeg at ${bundledFfmpeg}...`);
    step(`  exists: ${existsSync(bundledFfmpeg)}`);
    step(`  cwd: ${process.cwd()}`);
    try {
      const contents = await fs.readdir(process.cwd());
      step(`  cwd contents: ${contents.join(", ")}`);
    } catch {}

    let ffmpegReady = false;
    let fontsReady = false;

    // Check if bundled ffmpeg exists
    if (existsSync(bundledFfmpeg)) {
      step("Bundled ffmpeg found — making executable...");
      try {
        await fs.chmod(bundledFfmpeg, 0o755);
        // Verify it works
        execSync(`${bundledFfmpeg} -version 2>&1`, { encoding: "utf8", timeout: 10000, stdio: "ignore" });
        step("Bundled ffmpeg is working!");
        ffmpegReady = true;

        // Also make ffprobe executable
        if (existsSync(bundledFfprobe)) {
          await fs.chmod(bundledFfprobe, 0o755);
          step("Bundled ffprobe made executable");
        }
      } catch (e) {
        step(`Bundled ffmpeg failed to run: ${e instanceof Error ? e.message : "unknown"}`);
        // Try apt as fallback
        ffmpegReady = await tryAptInstall(step);
      }
    } else {
      step("Bundled ffmpeg not found — trying apt install...");
      ffmpegReady = await tryAptInstall(step);
    }

    // Check if bundled fonts exist
    if (existsSync(bundledFontBold)) {
      step("Bundled fonts found!");
      fontsReady = true;
    } else {
      step("Bundled fonts not found — trying apt install...");
      try {
        execSync("apt-get install -y -qq fonts-dejavu-core 2>&1", {
          encoding: "utf8",
          timeout: 60000,
          stdio: "ignore",
        });
        step("fonts-dejavu installed via apt");
        fontsReady = true;
      } catch {
        step("apt install fonts failed");
      }
    }

    step(`Verification: ffmpeg=${ffmpegReady}, fonts=${fontsReady}`);

    return NextResponse.json({
      ok: ffmpegReady && fontsReady,
      log,
      ffmpegInstalled: ffmpegReady,
      fontsInstalled: fontsReady,
      canGenerateVideos: ffmpegReady && fontsReady,
      message: ffmpegReady && fontsReady
        ? "Tools ready! You can now generate videos."
        : ffmpegReady
        ? "ffmpeg is ready but fonts are missing."
        : "ffmpeg is not available. The bundled binary may be missing from this deployment.",
    });
  } catch (e) {
    step(`FATAL: ${e instanceof Error ? e.message : "unknown"}`);
    return NextResponse.json({
      ok: false,
      log,
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

async function tryAptInstall(step: (msg: string) => void): Promise<boolean> {
  try {
    step("Trying apt install ffmpeg fonts-dejavu-core...");
    execSync("apt-get update -qq && apt-get install -y -qq ffmpeg fonts-dejavu-core 2>&1", {
      encoding: "utf8",
      timeout: 180000,
      stdio: "ignore",
    });
    step("apt install succeeded");
    return true;
  } catch (e) {
    step(`apt install failed: ${e instanceof Error ? e.message : "unknown"}`);
    return false;
  }
}
