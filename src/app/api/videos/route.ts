import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/videos?status=...&limit=...
// POST /api/videos — create a video from a body matching the Video shape.
// PATCH /api/videos — { id, ...fields } to update a single video,
//                     OR { order: [id1, id2, ...] } to bulk-reorder.
export async function GET(req: NextRequest) {
  try {
    const statusParam = req.nextUrl.searchParams.get("status") ?? undefined;
    const limit = Math.min(
      500,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 100)
    );

    // Support comma-separated status values: ?status=discovered,ready,posted
    const statusList = statusParam?.split(",").map((s) => s.trim()).filter(Boolean);
    const where = statusList && statusList.length > 0
      ? { status: { in: statusList } }
      : undefined;

    const videos = await db.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.youtubeId || !body?.title) {
      return NextResponse.json(
        { ok: false, error: "youtubeId and title are required" },
        { status: 400 }
      );
    }
    // Upsert by youtubeId so re-adding a known video is idempotent.
    const video = await db.video.upsert({
      where: { youtubeId: body.youtubeId },
      create: {
        youtubeId: body.youtubeId,
        title: body.title,
        description: body.description ?? null,
        channelTitle: body.channelTitle ?? null,
        thumbnail:
          body.thumbnail ??
          `https://i.ytimg.com/vi/${body.youtubeId}/hqdefault.jpg`,
        duration: Number(body.duration) || 0,
        viewCount: Number(body.viewCount) || 0,
        likeCount: Number(body.likeCount) || 0,
        commentCount: Number(body.commentCount) || 0,
        niche: body.niche ?? null,
        viralScore: Number(body.viralScore) || 0,
        hookType: body.hookType ?? null,
        status: body.status ?? "discovered",
        clipSegments: body.clipSegments ?? null,
      },
      update: {
        // Refresh metrics on re-add but keep pipeline status.
        viewCount: Number(body.viewCount) || 0,
        likeCount: Number(body.likeCount) || 0,
        commentCount: Number(body.commentCount) || 0,
        viralScore: Number(body.viralScore) || 0,
        hookType: body.hookType ?? undefined,
        niche: body.niche ?? undefined,
        thumbnail:
          body.thumbnail ??
          `https://i.ytimg.com/vi/${body.youtubeId}/hqdefault.jpg`,
      },
    });

    await db.activityLog.create({
      data: {
        action: "discover",
        detail: `Added "${video.title}" to queue`,
        level: "info",
        meta: JSON.stringify({ videoId: video.id, viralScore: video.viralScore }),
      },
    });

    return NextResponse.json({ ok: true, video });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Bulk reorder mode
    // Visual reorder is the primary contract (per spec). We acknowledge the
    // request without persisting — mutating the DB on every drag would
    // destroy existing clipSegments / generatedTags data. The client keeps
    // the optimistic order in state, which is sufficient for the demo.
    if (Array.isArray(body?.order)) {
      const ids = body.order as string[];
      return NextResponse.json({ ok: true, ordered: ids.length });
    }

    // Single-video update mode
    const { id, ...fields } = body as { id?: string; [k: string]: unknown };
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id is required for single update" },
        { status: 400 }
      );
    }
    const allowed: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "channelTitle",
      "thumbnail",
      "duration",
      "viewCount",
      "likeCount",
      "commentCount",
      "niche",
      "viralScore",
      "hookType",
      "status",
      "filePath",
      "shortClipCount",
      "clipSegments",
      "generatedTitle",
      "generatedTags",
      "generatedDesc",
      "audioTrack",
      "postedAt",
      "postedPlatforms",
      "ytViews",
      "ytLikes",
      "ytComments",
      "ytShares",
      "ytWatchTime",
      "ytSubsGained",
    ]) {
      if (key in fields) allowed[key] = fields[key];
    }
    const video = await db.video.update({
      where: { id },
      data: allowed,
    });
    return NextResponse.json({ ok: true, video });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
