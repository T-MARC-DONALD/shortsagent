import { NextRequest, NextResponse } from "next/server";
import { discoverRealShorts } from "@/lib/real-discovery";

/**
 * POST /api/repost-discover
 * Body: { niche, minViews }
 * Discovers real viral YouTube Shorts in the user's niche via web search + oEmbed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { niche, minViews } = body as { niche?: string; minViews?: number };
    const n = niche || "tech";
    const mv = typeof minViews === "number" ? minViews : 100000;

    const candidates = await discoverRealShorts(n, mv, 12);

    if (candidates.length === 0) {
      return NextResponse.json({
        candidates: [],
        note: "No viral Shorts found. Try a broader niche or lower the min view threshold.",
      });
    }

    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
