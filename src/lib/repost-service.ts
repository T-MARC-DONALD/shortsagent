// repost-service.ts — auto-repost viral Shorts pipeline (server-side)

import { db } from "@/lib/db";
import { PLATFORMS } from "@/lib/constants";

export interface ViralShortCandidate {
  sourceUrl: string;
  sourceShortId: string;
  title: string;
  creator: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  duration: number;
}

/**
 * Discover viral Shorts in a niche via web search + yt-dlp metadata.
 * In this sandbox we return a curated demo set.
 */
export async function discoverViralShorts(
  niche: string,
  minViews = 100000,
  limit = 12
): Promise<ViralShortCandidate[]> {
  const candidates: ViralShortCandidate[] = [
    { sourceUrl: "https://youtube.com/shorts/rst901", sourceShortId: "rst901", title: "AI just did something impossible", creator: "@aibreakthroughs", thumbnail: "https://i.ytimg.com/vi/rst901/hqdefault.jpg", viewCount: 3200000, likeCount: 245000, duration: 32 },
    { sourceUrl: "https://youtube.com/shorts/uvw234", sourceShortId: "uvw234", title: "The coding hack that broke the internet", creator: "@codehack", thumbnail: "https://i.ytimg.com/vi/uvw234/hqdefault.jpg", viewCount: 1800000, likeCount: 132000, duration: 41 },
    { sourceUrl: "https://youtube.com/shorts/yza567", sourceShortId: "yza567", title: "This startup raised $50M in 3 days", creator: "@venturechronicle", thumbnail: "https://i.ytimg.com/vi/yza567/hqdefault.jpg", viewCount: 980000, likeCount: 71000, duration: 28 },
    { sourceUrl: "https://youtube.com/shorts/bcd890", sourceShortId: "bcd890", title: "POV: when your AI ships a bug to production", creator: "@devmemes", thumbnail: "https://i.ytimg.com/vi/bcd890/hqdefault.jpg", viewCount: 1450000, likeCount: 98000, duration: 19 },
    { sourceUrl: "https://youtube.com/shorts/efg123", sourceShortId: "efg123", title: "How this 14-year-old built a $1M app", creator: "@youngfounders", thumbnail: "https://i.ytimg.com/vi/efg123/hqdefault.jpg", viewCount: 2600000, likeCount: 187000, duration: 45 },
    { sourceUrl: "https://youtube.com/shorts/hij456", sourceShortId: "hij456", title: "The truth about ChatGPT nobody tells you", creator: "@aitruth", thumbnail: "https://i.ytimg.com/vi/hij456/hqdefault.jpg", viewCount: 4100000, likeCount: 312000, duration: 38 },
    { sourceUrl: "https://youtube.com/shorts/klm789", sourceShortId: "klm789", title: "I asked AI to predict the stock market", creator: "@fintechpov", thumbnail: "https://i.ytimg.com/vi/klm789/hqdefault.jpg", viewCount: 720000, likeCount: 54000, duration: 35 },
    { sourceUrl: "https://youtube.com/shorts/nop012", sourceShortId: "nop012", title: "Why this AI tool is going viral", creator: "@toolhub", thumbnail: "https://i.ytimg.com/vi/nop012/hqdefault.jpg", viewCount: 1190000, likeCount: 86000, duration: 24 },
    { sourceUrl: "https://youtube.com/shorts/qrs345", sourceShortId: "qrs345", title: "Build a SaaS in 60 seconds", creator: "@indiehacker", thumbnail: "https://i.ytimg.com/vi/qrs345/hqdefault.jpg", viewCount: 890000, likeCount: 67000, duration: 60 },
    { sourceUrl: "https://youtube.com/shorts/tuv678", sourceShortId: "tuv678", title: "The future of work is here", creator: "@futurework", thumbnail: "https://i.ytimg.com/vi/tuv678/hqdefault.jpg", viewCount: 540000, likeCount: 41000, duration: 27 },
    { sourceUrl: "https://youtube.com/shorts/wxy901", sourceShortId: "wxy901", title: "3 AI tools that replace $5k/month software", creator: "@frugaltech", thumbnail: "https://i.ytimg.com/vi/wxy901/hqdefault.jpg", viewCount: 1950000, likeCount: 142000, duration: 48 },
    { sourceUrl: "https://youtube.com/shorts/zab234", sourceShortId: "zab234", title: "How I automated my entire job with AI", creator: "@automator", thumbnail: "https://i.ytimg.com/vi/zab234/hqdefault.jpg", viewCount: 1670000, likeCount: 121000, duration: 52 },
  ];

  return candidates
    .filter((c) => c.viewCount >= minViews)
    .slice(0, limit)
    .map((c) => ({ ...c, niche }));
}

/**
 * Add a credit-pill overlay to a downloaded Short.
 * Production: sharp renders the pill as SVG→PNG, ffmpeg overlays it.
 * Sandbox: no-op — just returns the input path.
 */
export async function addCreditOverlay(
  inputPath: string,
  creator: string,
  creditFormat = "Credit: @creator"
): Promise<{ ok: boolean; outputPath: string }> {
  const creditText = creditFormat.replace("@creator", creator);
  const outputPath = inputPath.replace(/\.mp4$/, "_credited.mp4");
  // In production: sharp renders SVG credit pill → ffmpeg overlay filter
  // Here we just return the path; the upload-service consumes it.
  return { ok: true, outputPath };
}

/**
 * Full repost pipeline: download → overlay → mark ready.
 */
export async function processRepostJob(jobId: string): Promise<void> {
  const job = await db.repostJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    await db.repostJob.update({
      where: { id: jobId },
      data: { status: "downloading", progress: 10 },
    });
    // Simulate download
    await sleep(200);
    await db.repostJob.update({
      where: { id: jobId },
      data: { status: "processing", progress: 50 },
    });

    const inputPath = `/tmp/repost_${jobId}.mp4`;
    const { outputPath } = await addCreditOverlay(
      inputPath,
      job.creator ?? "unknown",
      job.creditFormat
    );

    await db.repostJob.update({
      where: { id: jobId },
      data: { status: "ready", progress: 100, filePath: outputPath },
    });
  } catch (e) {
    await db.repostJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: e instanceof Error ? e.message : "Unknown error",
      },
    });
  }
}

/**
 * Auto-repost entry — enforces daily cap.
 */
export async function runAutoRepost(): Promise<{ enqueued: number; capped: boolean }> {
  const settings = await db.agentSettings.findUnique({ where: { id: "global" } });
  if (!settings?.autoRepost) return { enqueued: 0, capped: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await db.repostJob.count({
    where: { createdAt: { gte: today } },
  });

  const remaining = Math.max(0, settings.repostMaxPerDay - todayCount);
  if (remaining === 0) return { enqueued: 0, capped: true };

  const candidates = await discoverViralShorts(
    settings.repostNiche,
    settings.repostMinViews,
    remaining
  );

  for (const c of candidates) {
    const exists = await db.repostJob.findFirst({
      where: { sourceShortId: c.sourceShortId },
    });
    if (exists) continue;
    await db.repostJob.create({
      data: {
        sourceUrl: c.sourceUrl,
        sourceShortId: c.sourceShortId,
        title: c.title,
        creator: c.creator,
        thumbnail: c.thumbnail,
        viewCount: c.viewCount,
        likeCount: c.likeCount,
        niche: settings.repostNiche,
        status: "pending",
        creditFormat: settings.repostCreditFmt,
      },
    });
  }
  return { enqueued: candidates.length, capped: candidates.length === remaining };
}

/**
 * Upload a ready repost to all enabled platforms.
 */
export async function uploadRepostToPlatforms(
  jobId: string
): Promise<Record<string, "posted" | "failed">> {
  const job = await db.repostJob.findUnique({ where: { id: jobId } });
  if (!job) return {};

  const accounts = await db.socialAccount.findMany({
    where: { connected: true, autoUpload: true },
  });

  const results: Record<string, "posted" | "failed"> = {};
  for (const acct of accounts) {
    // Simulate per-platform upload
    await sleep(80);
    results[acct.platform] = "posted";
  }

  const postedPlatforms = JSON.stringify(Object.keys(results));
  await db.repostJob.update({
    where: { id: jobId },
    data: { status: "posted", postedPlatforms, progress: 100 },
  });

  return results;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export { PLATFORMS };
