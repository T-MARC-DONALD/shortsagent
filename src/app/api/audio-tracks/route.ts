import { NextResponse } from "next/server";
import { AUDIO_TRACKS } from "@/lib/constants";

// GET /api/audio-tracks — return the full audio track library.
export async function GET() {
  try {
    return NextResponse.json({ tracks: AUDIO_TRACKS });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
