import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const where = status ? { status } : {};
    const jobs = await db.repostJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sourceUrl,
      sourceShortId,
      title,
      creator,
      thumbnail,
      viewCount,
      likeCount,
      niche,
      creditFormat,
    } = body as {
      sourceUrl: string;
      sourceShortId?: string;
      title?: string;
      creator?: string;
      thumbnail?: string;
      viewCount?: number;
      likeCount?: number;
      niche?: string;
      creditFormat?: string;
    };

    if (!sourceUrl) {
      return NextResponse.json({ ok: false, error: "sourceUrl required" }, { status: 400 });
    }

    // Pull default credit format from settings if not provided.
    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    const job = await db.repostJob.create({
      data: {
        sourceUrl,
        sourceShortId: sourceShortId ?? null,
        title: title ?? null,
        creator: creator ?? null,
        thumbnail: thumbnail ?? null,
        viewCount: viewCount ?? 0,
        likeCount: likeCount ?? 0,
        niche: niche ?? settings.repostNiche,
        status: "pending",
        progress: 0,
        creditFormat: creditFormat ?? settings.repostCreditFmt,
      },
    });

    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
