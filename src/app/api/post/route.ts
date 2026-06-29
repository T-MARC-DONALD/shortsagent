import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadToYouTube } from "@/lib/youtube-upload";
import path from "path";

/**
 * POST /api/post
 * Body: { videoId, platforms?: ["youtube", ...] }
 * Uploads the generated Short to YouTube (real upload via Data API v3).
 * Other platforms (TikTok/Instagram/Twitter) return a "not yet supported" status
 * — the OAuth flow must be configured per-platform, which is a future task.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, platforms } = body;

    if (!videoId) {
      return NextResponse.json({ ok: false, error: "videoId required" }, { status: 400 });
    }

    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
    }
    if (!video.filePath) {
      return NextResponse.json({ ok: false, error: "Video has no generated file. Generate it first." }, { status: 400 });
    }

    await db.video.update({
      where: { id: videoId },
      data: { status: "posting" },
    });

    const targetPlatforms = platforms ?? ["youtube"];
    const results: { platform: string; ok: boolean; permalink?: string; error?: string }[] = [];

    for (const platform of targetPlatforms) {
      if (platform === "youtube") {
        // Real YouTube upload
        const absolutePath = path.join(process.cwd(), "public", video.filePath);
        const r = await uploadToYouTube({
          videoId: video.id,
          title: video.generatedTitle ?? video.title,
          description: video.generatedDesc ?? `ShortsAgent auto-generated from ${video.title}`,
          tags: video.generatedTags ? JSON.parse(video.generatedTags) : [],
          category: "28", // Science & Tech
          privacyStatus: "public",
          filePath: absolutePath,
        });

        results.push({
          platform: "youtube",
          ok: r.ok,
          permalink: r.permalink,
          error: r.error,
        });

        if (r.ok) {
          await db.socialPost.create({
            data: {
              videoId: video.id,
              platform: "youtube",
              externalId: r.youtubeVideoId,
              permalink: r.permalink,
              status: "posted",
              postedAt: new Date(),
            },
          });
        } else {
          await db.socialPost.create({
            data: {
              videoId: video.id,
              platform: "youtube",
              status: "failed",
              errorMessage: r.error,
            },
          });
        }
      } else {
        // TikTok / Instagram / Twitter — not yet supported for real upload
        results.push({
          platform,
          ok: false,
          error: `${platform} upload not yet supported in this build. Configure OAuth credentials and platform-specific upload API.`,
        });
      }
    }

    // Update video status
    const anyOk = results.some((r) => r.ok);
    const postedPlatforms = JSON.stringify(results.filter((r) => r.ok).map((r) => r.platform));
    await db.video.update({
      where: { id: videoId },
      data: {
        status: anyOk ? "posted" : "failed",
        postedAt: new Date(),
        postedPlatforms,
      },
    });

    await db.activityLog.create({
      data: {
        action: "post",
        detail: anyOk
          ? `Posted "${video.generatedTitle ?? video.title}" to ${results.filter((r) => r.ok).map((r) => r.platform).join(", ")}`
          : `Failed to post "${video.title}": ${results[0]?.error}`,
        level: anyOk ? "success" : "error",
      },
    });

    return NextResponse.json({ ok: anyOk, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
