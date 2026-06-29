import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDbAvailable } from "@/lib/db-helpers";
import { discoverRealVideos } from "@/lib/real-discovery";
import { scoreVideosBatch } from "@/lib/viral-score";

/**
 * POST /api/discover
 * Body modes:
 * 1. { action: "search", niche, minViews, maxDuration } → real discovery via web search + oEmbed + LLM scoring
 * 2. { action: "add", video: {...} } → persist a single video to the queue
 *
 * The search mode works even if the database isn't available — it just can't persist.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "add" && body.video) {
      // Add mode requires the database
      if (!(await isDbAvailable())) {
        return NextResponse.json({
          ok: false,
          error: "Database not ready. Please wait a moment and try again, or check /api/system-check.",
        });
      }

      const v = body.video;
      const existing = await db.video.findUnique({ where: { youtubeId: v.youtubeId } });
      if (existing) {
        return NextResponse.json({ ok: true, video: existing, alreadyExists: true });
      }
      const created = await db.video.create({
        data: {
          youtubeId: v.youtubeId,
          title: v.title,
          channelTitle: v.channelTitle,
          thumbnail: v.thumbnail,
          duration: v.duration ?? 600,
          viewCount: v.viewCount ?? 0,
          likeCount: v.likeCount ?? 0,
          commentCount: v.commentCount ?? 0,
          niche: v.niche ?? "tech",
          viralScore: v.viralScore ?? 50,
          hookType: v.hookType ?? "curiosity",
          status: "discovered",
        },
      });
      await db.activityLog.create({
        data: {
          action: "discover",
          detail: `Added "${v.title}" to queue`,
          level: "info",
        },
      }).catch(() => {}); // non-fatal
      return NextResponse.json({ ok: true, video: created });
    }

    // Default: search mode (doesn't require database)
    const niche = body.niche ?? "tech";
    const query = body.query ?? "";
    const minViews = body.minViews ?? 0;
    const maxDuration = body.maxDuration ?? 1500;
    const limit = body.limit ?? 12;

    console.log("[discover] Search mode:", { query, niche, minViews, maxDuration });

    // 1. Real discovery — use the user's query to find relevant YouTube videos
    const discovered = await discoverRealVideos(niche, minViews, limit, query);

    console.log(`[discover] Found ${discovered.length} videos from discovery`);

    if (discovered.length === 0) {
      return NextResponse.json({
        ok: true,
        videos: [],
        note: "No videos found. Try a different search query or check your network connection.",
      });
    }

    // 2. LLM viral scoring (non-fatal if it fails)
    let scored: { score: number; reasoning: string; hookType: "shock" | "curiosity" | "fomo" | "emotion" | "listicle" }[] = [];
    try {
      scored = await scoreVideosBatch(
        discovered.map((v) => ({
          title: v.title,
          channelTitle: v.channelTitle,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          duration: v.duration,
          niche: v.niche,
        }))
      );
    } catch (e) {
      console.warn("[discover] Viral scoring failed (non-fatal):", e);
      // Use default scores
      scored = discovered.map(() => ({ score: 50, reasoning: "Scoring unavailable", hookType: "curiosity" as const }));
    }

    // 3. Merge
    const videos = discovered
      .map((v, i) => ({
        ...v,
        viralScore: scored[i]?.score ?? 50,
        hookType: scored[i]?.hookType ?? "curiosity",
        reasoning: scored[i]?.reasoning ?? "",
      }))
      .filter((v) => v.duration <= maxDuration)
      .sort((a, b) => b.viralScore - a.viralScore);

    console.log(`[discover] Returning ${videos.length} videos after filtering`);

    return NextResponse.json({ ok: true, videos });
  } catch (e) {
    console.error("[discover] Unhandled error:", e);
    // Return 200 with ok:false so the frontend can display the error
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      videos: [],
    });
  }
}
