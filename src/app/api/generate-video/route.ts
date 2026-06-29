import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateRealShort, generateThumbnail, checkFfmpegAvailable } from "@/lib/real-video-generator";
import { generateTitles } from "@/lib/viral-score";
import { identifySegments, estimateShorts, buildOverlay } from "@/lib/video-generator";
import { HASHTAG_BANK } from "@/lib/constants";

/**
 * POST /api/generate-video
 * Body: { videoId, hookType, audioTrack, titleStyle, durationSec? }
 * Generates a REAL MP4 file using ffmpeg and updates the video record.
 *
 * Always returns 200 with { ok: boolean, error?: string } so the frontend
 * can display the actual error message instead of a generic 500.
 */
export async function POST(req: NextRequest) {
  const logStep = (step: string, extra?: unknown) => {
    console.log(`[generate-video] ${step}`, extra ?? "");
  };

  try {
    logStep("start");
    const body = await req.json();
    const { videoId, hookType, audioTrack, titleStyle, durationSec } = body;

    if (!videoId) {
      logStep("error: no videoId");
      return NextResponse.json({ ok: false, error: "videoId required" });
    }

    logStep("fetching video", videoId);
    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) {
      logStep("error: video not found");
      return NextResponse.json({ ok: false, error: "Video not found" });
    }

    // Check ffmpeg availability BEFORE marking as generating
    logStep("checking ffmpeg");
    const ffCheck = await checkFfmpegAvailable();
    if (!ffCheck.ok) {
      logStep("error: ffmpeg not available", ffCheck.error);
      return NextResponse.json({
        ok: false,
        error: `ffmpeg is not available on this server. Video generation requires ffmpeg. Install it with: apt install ffmpeg (Debian/Ubuntu) or yum install ffmpeg (CentOS). Error: ${ffCheck.error}`,
      });
    }
    logStep("ffmpeg ok", ffCheck.version);

    // Mark as generating
    logStep("marking as generating");
    await db.video.update({
      where: { id: videoId },
      data: {
        status: "generating",
        hookType: hookType ?? video.hookType,
        audioTrack: audioTrack ?? video.audioTrack,
      },
    });

    await db.activityLog.create({
      data: {
        action: "generate",
        detail: `Started generating Short for "${video.title}"`,
        level: "info",
      },
    });

    // Generate segments
    const segments = identifySegments(video.duration, 3);
    const estCount = estimateShorts(video.duration);

    // Generate the REAL MP4 file
    logStep("calling generateRealShort");
    const result = await generateRealShort({
      youtubeId: video.youtubeId,
      title: video.title,
      hookType: hookType ?? (video.hookType as "shock" | "curiosity" | "fomo" | "emotion" | "listicle") ?? "curiosity",
      audioTrack: audioTrack ?? "wave",
      durationSec: durationSec ?? 30,
    });

    if (!result.ok || !result.filePath) {
      logStep("error: generateRealShort failed", result.error);
      await db.video.update({
        where: { id: videoId },
        data: { status: "failed" },
      }).catch(() => {});
      await db.activityLog.create({
        data: {
          action: "generate",
          detail: `Generation failed for "${video.title}": ${result.error}`,
          level: "error",
        },
      }).catch(() => {});
      return NextResponse.json({
        ok: false,
        error: result.error ?? "Generation failed (unknown reason)",
      });
    }
    logStep("generateRealShort ok", result.filePath);

    // Generate thumbnail (non-fatal if this fails)
    let thumbnail: string | null = null;
    try {
      thumbnail = await generateThumbnail(result.absolutePath);
    } catch (thumbErr) {
      logStep("thumbnail failed (non-fatal)", thumbErr);
    }

    // Generate title variants via LLM (non-fatal if this fails)
    let titles: string[] = [];
    try {
      titles = await generateTitles(
        { title: video.title, niche: video.niche ?? undefined },
        (titleStyle ?? hookType) as "shock" | "curiosity" | "fomo" | "emotion" | "listicle" | undefined,
        5
      );
    } catch (titleErr) {
      logStep("title generation failed (non-fatal)", titleErr);
      titles = [video.title];
    }

    // Build overlay info for the response
    const overlay = buildOverlay(video.title, hookType);

    // Generate tags from hashtag bank
    const tags = HASHTAG_BANK[video.niche ?? "tech"] ?? HASHTAG_BANK.tech;

    // Update video record
    logStep("updating video record");
    await db.video.update({
      where: { id: videoId },
      data: {
        status: "ready",
        filePath: result.filePath,
        shortClipCount: estCount,
        clipSegments: JSON.stringify(segments),
        generatedTitle: titles[0] ?? video.title,
        generatedTags: JSON.stringify(tags),
        generatedDesc: `Auto-generated Short from "${video.title}". ${overlay.badge} ${overlay.subtitle}`,
        audioTrack: audioTrack ?? "wave",
        hookType: hookType ?? video.hookType,
      },
    });

    await db.activityLog.create({
      data: {
        action: "generate",
        detail: `Generated Short "${titles[0] ?? video.title}" (${result.durationSec}s)`,
        level: "success",
      },
    });

    logStep("done");
    return NextResponse.json({
      ok: true,
      filePath: result.filePath,
      thumbnail,
      segments,
      titles,
      tags,
      overlay,
      mode: result.mode,
      durationSec: result.durationSec,
    });
  } catch (e) {
    console.error("[generate-video] Unhandled error:", e);
    // Return 200 with ok:false so the frontend can display the error message
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
}
