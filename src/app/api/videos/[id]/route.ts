import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/videos/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const video = await db.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "Video not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ video });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/videos/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.video.delete({ where: { id } }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/videos/[id] — update a single video's fields
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
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
      if (key in body) allowed[key] = body[key];
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
