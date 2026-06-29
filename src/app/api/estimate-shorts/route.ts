import { NextRequest, NextResponse } from "next/server";
import { estimateShorts, identifySegments } from "@/lib/video-generator";

// POST /api/estimate-shorts
// body: { duration: number (seconds) }
// returns: { count: number, segments: ClipSegment[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const duration = Number(body?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return NextResponse.json(
        { ok: false, error: "duration (seconds) is required" },
        { status: 400 }
      );
    }
    const count = estimateShorts(duration);
    const segments = identifySegments(duration, 3);
    return NextResponse.json({ ok: true, count, segments });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
