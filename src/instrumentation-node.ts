// instrumentation-node.ts — Node.js-only initialization code.
// This module is dynamically imported by instrumentation.ts so that
// Edge Runtime never parses these Node.js imports.

import { execSync } from "child_process";
import { existsSync, promises as fs } from "fs";
import path from "path";

export async function initServer() {
  console.log("[instrumentation] Server starting, initializing...");

  // Step 1: Initialize the database FIRST
  await ensureDatabaseReady();

  // Step 2: Install ffmpeg + fonts (non-blocking)
  ensureToolsInstalled().catch((e) => {
    console.error("[instrumentation] Tool installation failed (non-fatal):", e);
  });
}

async function ensureDatabaseReady() {
  console.log("[instrumentation] Checking database...");

  try {
    // Set DATABASE_URL if not set
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "file:./db/custom.db";
    }
    console.log("[instrumentation] DATABASE_URL:", process.env.DATABASE_URL);

    // Ensure the db directory exists
    const dbDir = path.join(process.cwd(), "db");
    await fs.mkdir(dbDir, { recursive: true });

    // Check if the schema file exists
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    if (!existsSync(schemaPath)) {
      console.warn("[instrumentation] WARNING: prisma/schema.prisma not found at", schemaPath);
      console.warn("[instrumentation] CWD:", process.cwd());
      try {
        const contents = await fs.readdir(process.cwd());
        console.warn("[instrumentation] CWD contents:", contents);
      } catch {}
    }

    // Run prisma db push to create/migrate the database
    console.log("[instrumentation] Running prisma db push...");
    try {
      execSync("npx prisma db push --skip-generate", {
        stdio: "pipe",
        cwd: process.cwd(),
        env: process.env,
        timeout: 60000,
      });
      console.log("[instrumentation] Database schema pushed successfully");
    } catch {
      console.warn("[instrumentation] npx prisma db push failed, trying bunx...");
      try {
        execSync("bunx prisma db push --skip-generate", {
          stdio: "pipe",
          cwd: process.cwd(),
          env: process.env,
          timeout: 60000,
        });
        console.log("[instrumentation] Database schema pushed successfully (via bunx)");
      } catch (e2) {
        console.error("[instrumentation] prisma db push failed:", e2 instanceof Error ? e2.message : e2);
      }
    }

    // Verify the database file exists
    const dbPath = path.join(process.cwd(), "db", "custom.db");
    if (existsSync(dbPath)) {
      const stat = await fs.stat(dbPath);
      console.log(`[instrumentation] Database ready: ${dbPath} (${stat.size} bytes)`);
    } else {
      console.warn("[instrumentation] Database file not found — PrismaClient will create it on first query");
    }
  } catch (e) {
    console.error("[instrumentation] Database initialization failed:", e);
  }
}

async function ensureToolsInstalled() {
  console.log("[instrumentation] Ensuring ffmpeg + fonts are available...");

  try {
    const ffmpegOk = await checkCommand("ffmpeg -version");
    if (ffmpegOk) {
      console.log("[instrumentation] ffmpeg already available");
    } else {
      console.log("[instrumentation] ffmpeg not found, installing...");
      await installStaticFfmpeg();
    }

    const fontOk = existsSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
    const tmpFontOk = existsSync("/tmp/fonts/DejaVuSans-Bold.ttf");
    if (!fontOk && !tmpFontOk) {
      console.log("[instrumentation] Fonts not found, installing...");
      await installFonts();
    }

    console.log("[instrumentation] Tools ready");
  } catch (e) {
    console.error("[instrumentation] Tool installation failed:", e);
  }
}

async function checkCommand(cmd: string): Promise<boolean> {
  try {
    execSync(cmd, { encoding: "utf8", timeout: 5000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function installStaticFfmpeg() {
  const installDir = "/tmp/ffmpeg-static";
  await fs.mkdir(installDir, { recursive: true });

  const ffmpegPath = path.join(installDir, "ffmpeg");
  const ffprobePath = path.join(installDir, "ffprobe");

  if (existsSync(ffmpegPath) && existsSync(ffprobePath)) {
    console.log("[instrumentation] Static ffmpeg already downloaded at", installDir);
    await fs.chmod(ffmpegPath, 0o755);
    await fs.chmod(ffprobePath, 0o755);
    return;
  }

  // Try apt first
  try {
    console.log("[instrumentation] Trying apt install ffmpeg fonts-dejavu-core...");
    execSync("apt-get update -qq && apt-get install -y -qq ffmpeg fonts-dejavu-core 2>&1", {
      encoding: "utf8",
      timeout: 120000,
      stdio: "ignore",
    });
    console.log("[instrumentation] apt install succeeded");
    return;
  } catch {
    console.log("[instrumentation] apt install failed, falling back to static binary");
  }

  // Fall back to static binary download
  console.log("[instrumentation] Downloading static ffmpeg binary...");
  const tarPath = "/tmp/ffmpeg-static.tar.xz";

  try {
    execSync(
      `curl -sL -o "${tarPath}" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"`,
      { encoding: "utf8", timeout: 180000, stdio: "ignore" }
    );

    const extractDir = "/tmp/ffmpeg-extract";
    await fs.mkdir(extractDir, { recursive: true });
    execSync(`tar -xf "${tarPath}" -C "${extractDir}"`, {
      encoding: "utf8",
      timeout: 60000,
      stdio: "ignore",
    });

    const findInDir = async (dir: string, name: string): Promise<string | null> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = await findInDir(fullPath, name);
          if (found) return found;
        } else if (entry.name === name) {
          return fullPath;
        }
      }
      return null;
    };

    const extractedFfmpeg = await findInDir(extractDir, "ffmpeg");
    const extractedFfprobe = await findInDir(extractDir, "ffprobe");

    if (!extractedFfmpeg || !extractedFfprobe) {
      throw new Error("ffmpeg/ffprobe not found in extracted archive");
    }

    await fs.copyFile(extractedFfmpeg, ffmpegPath);
    await fs.copyFile(extractedFfprobe, ffprobePath);
    await fs.chmod(ffmpegPath, 0o755);
    await fs.chmod(ffprobePath, 0o755);

    await fs.unlink(tarPath).catch(() => {});
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    console.log("[instrumentation] Static ffmpeg installed at", ffmpegPath);
  } catch (e) {
    console.error("[instrumentation] Static binary download failed:", e);
    throw e;
  }
}

async function installFonts() {
  try {
    execSync("apt-get install -y -qq fonts-dejavu-core 2>&1", {
      encoding: "utf8",
      timeout: 60000,
      stdio: "ignore",
    });
    console.log("[instrumentation] fonts-dejavu installed via apt");
    return;
  } catch {
    // Fall through
  }

  const fontDir = "/tmp/fonts";
  await fs.mkdir(fontDir, { recursive: true }).catch(() => {});

  const fonts = [
    { name: "DejaVuSans-Bold.ttf", url: "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf" },
    { name: "DejaVuSans.ttf", url: "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf" },
    { name: "DejaVuSansMono.ttf", url: "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSansMono.ttf" },
  ];

  for (const font of fonts) {
    const fontPath = path.join(fontDir, font.name);
    if (existsSync(fontPath)) continue;
    try {
      console.log(`[instrumentation] Downloading font ${font.name}...`);
      execSync(`curl -sL -o "${fontPath}" "${font.url}"`, {
        encoding: "utf8",
        timeout: 30000,
        stdio: "ignore",
      });
    } catch {
      console.warn(`[instrumentation] Failed to download ${font.name}`);
    }
  }

  try {
    execSync("fc-cache -f 2>&1", { encoding: "utf8", timeout: 10000, stdio: "ignore" });
  } catch {}

  console.log("[instrumentation] Fonts installed to /tmp/fonts");
}
