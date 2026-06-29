import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const videoId = url.searchParams.get("videoId");

    const where = videoId ? { videoId } : {};
    const posts = await db.socialPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
