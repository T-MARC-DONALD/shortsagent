import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateTitles } from "@/lib/viral-score";

// POST /api/generate-variants
// body: { videoId, count }
// Generates `count` title variants and stores them on the video (as JSON in generatedTags).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { videoId, count } = body as { videoId?: string; count?: number };
    if (!videoId) {
      return NextResponse.json(
        { ok: false, error: "videoId is required" },
        { status: 400 }
      );
    }
    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "Video not found" },
        { status: 404 }
      );
    }
    const n = Math.max(1, Math.min(20, Number(count) || 5));
    const variants = await generateTitles(
      { title: video.title, niche: video.niche ?? undefined },
      (video.hookType as
        | "shock"
        | "curiosity"
        | "fomo"
        | "emotion"
        | "listicle"
        | undefined) ?? undefined,
      n
    );

    await db.video.update({
      where: { id: videoId },
      data: { generatedTags: JSON.stringify(variants) },
    });

    return NextResponse.json({ ok: true, variants });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
