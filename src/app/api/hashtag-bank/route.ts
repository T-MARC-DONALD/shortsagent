import { NextRequest, NextResponse } from "next/server";
import { HASHTAG_BANK } from "@/lib/constants";

// GET /api/hashtag-bank?niche=tech
// - With ?niche=tech → returns that niche's tags only.
// - Without niche → returns the entire bank.
export async function GET(req: NextRequest) {
  try {
    const niche = req.nextUrl.searchParams.get("niche");
    if (niche) {
      return NextResponse.json({ tags: HASHTAG_BANK[niche] ?? [] });
    }
    return NextResponse.json({ bank: HASHTAG_BANK });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
