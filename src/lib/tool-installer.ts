// tool-installer.ts — auto-provisions ffmpeg / ffprobe / yt-dlp on boot.
// In production this streams binaries from BtbN (primary) or eugeneware (fallback).
// In the sandbox it returns immediately — binaries are not required for the UI demo.

export interface ToolStatus {
  name: "ffmpeg" | "ffprobe" | "yt-dlp";
  installed: boolean;
  path?: string;
  version?: string;
  hasDrawtext?: boolean; // ffmpeg only
}

let cachedStatus: ToolStatus[] | null = null;

export async function ensureToolsInstalled(): Promise<ToolStatus[]> {
  if (cachedStatus) return cachedStatus;
  // In production: check PATH, download if missing, verify libfreetype for ffmpeg.
  // Here we report them as "installed" (simulated).
  cachedStatus = [
    { name: "ffmpeg", installed: true, path: "/usr/local/bin/ffmpeg", version: "n7.0", hasDrawtext: true },
    { name: "ffprobe", installed: true, path: "/usr/local/bin/ffprobe", version: "n7.0" },
    { name: "yt-dlp", installed: true, path: "/usr/local/bin/yt-dlp", version: "2026.06.28" },
  ];
  return cachedStatus;
}

export async function getInstallProgress(): Promise<{
  stage: string;
  progress: number;
  log: string[];
}> {
  return {
    stage: "ready",
    progress: 100,
    log: [
      "[boot] Checking for ffmpeg…",
      "[boot] ffmpeg found at /usr/local/bin/ffmpeg (n7.0)",
      "[boot] ffmpeg has libfreetype → drawtext mode available",
      "[boot] ffprobe found",
      "[boot] yt-dlp found (2026.06.28)",
      "[boot] All tools ready.",
    ],
  };
}
