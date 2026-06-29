import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/activity — list activity logs, optional ?limit=N (default 50)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 500);

    const items = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
