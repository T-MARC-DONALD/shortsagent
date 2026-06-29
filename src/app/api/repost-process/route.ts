import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateRealShort } from "@/lib/real-video-generator";
import { uploadToYouTube } from "@/lib/youtube-upload";
import path from "path";

/**
 * POST /api/repost-process
 * Body: { jobId, action: "process" | "upload" }
 *
 * process: generates a REAL MP4 with the creator credit overlay burned in.
 * upload:  uploads the processed MP4 to YouTube (and other connected platforms).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, action } = body as { jobId: string; action: "process" | "upload" };

    if (!jobId || !action) {
      return NextResponse.json(
        { ok: false, error: "jobId and action required" },
        { status: 400 }
      );
    }

    const job = await db.repostJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    if (action === "process") {
      // Mark as processing
      await db.repostJob.update({
        where: { id: jobId },
        data: { status: "processing", progress: 10 },
      });

      // Generate a real MP4 with creator credit overlay
      const result = await generateRealShort({
        youtubeId: `repost_${job.sourceShortId}`,
        title: job.title ?? "Viral Short",
        hookType: "curiosity",
        audioTrack: "hype",
        durationSec: 20,
        creator: job.creator ?? undefined,
      });

      if (!result.ok || !result.filePath) {
        await db.repostJob.update({
          where: { id: jobId },
          data: {
            status: "failed",
            errorMessage: result.error ?? "Generation failed",
          },
        });
        return NextResponse.json({ ok: false, error: result.error });
      }

      await db.repostJob.update({
        where: { id: jobId },
        data: {
          status: "ready",
          progress: 100,
          filePath: result.filePath,
        },
      });

      await db.activityLog.create({
        data: {
          action: "repost",
          detail: `Generated repost Short with credit to ${job.creator}`,
          level: "success",
        },
      });

      return NextResponse.json({
        ok: true,
        filePath: result.filePath,
        durationSec: result.durationSec,
      });
    }

    if (action === "upload") {
      if (!job.filePath) {
        return NextResponse.json(
          { ok: false, error: "Job has no processed file. Run 'process' first." },
          { status: 400 }
        );
      }

      await db.repostJob.update({
        where: { id: jobId },
        data: { status: "uploading", progress: 50 },
      });

      // Upload to YouTube if connected
      const ytAccount = await db.socialAccount.findFirst({
        where: { platform: "youtube", connected: true, autoUpload: true },
      });

      const results: { platform: string; ok: boolean; permalink?: string; error?: string }[] = [];

      if (ytAccount) {
        const absolutePath = path.join(process.cwd(), "public", job.filePath);
        const r = await uploadToYouTube({
          videoId: job.id,
          title: `${job.title} (Repost)`,
          description: `Reposted with credit to ${job.creator}. Original: ${job.sourceUrl}\n\n#shorts #repost`,
          tags: ["shorts", "repost", "viral", job.niche ?? "tech"],
          category: "22", // People & Blogs
          privacyStatus: "public",
          filePath: absolutePath,
        });

        results.push({
          platform: "youtube",
          ok: r.ok,
          permalink: r.permalink,
          error: r.error,
        });
      } else {
        results.push({
          platform: "youtube",
          ok: false,
          error: "YouTube not connected. Visit Channels tab to connect.",
        });
      }

      const anyOk = results.some((r) => r.ok);
      const postedPlatforms = JSON.stringify(results.filter((r) => r.ok).map((r) => r.platform));

      await db.repostJob.update({
        where: { id: jobId },
        data: {
          status: anyOk ? "posted" : "failed",
          progress: 100,
          postedPlatforms,
          errorMessage: anyOk ? null : results[0]?.error,
        },
      });

      await db.activityLog.create({
        data: {
          action: "repost",
          detail: anyOk
            ? `Reposted viral Short to ${results.filter((r) => r.ok).map((r) => r.platform).join(", ")}`
            : `Repost upload failed: ${results[0]?.error}`,
          level: anyOk ? "success" : "error",
        },
      });

      return NextResponse.json({ ok: anyOk, results });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      // Return 200 with ok:false so the frontend can display the error
    );
  }
}
