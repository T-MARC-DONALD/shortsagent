import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await db.repostJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      progress,
      filePath,
      postedPlatforms,
      errorMessage,
      creditFormat,
      title,
      creator,
      niche,
      viewCount,
      likeCount,
    } = body as Record<string, unknown>;

    const existing = await db.repostJob.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (status !== undefined) update.status = String(status);
    if (progress !== undefined) update.progress = Number(progress);
    if (filePath !== undefined) update.filePath = filePath ? String(filePath) : null;
    if (postedPlatforms !== undefined) {
      update.postedPlatforms = Array.isArray(postedPlatforms)
        ? JSON.stringify(postedPlatforms)
        : postedPlatforms === null
          ? null
          : String(postedPlatforms);
    }
    if (errorMessage !== undefined) {
      update.errorMessage = errorMessage === null ? null : String(errorMessage);
    }
    if (creditFormat !== undefined) update.creditFormat = String(creditFormat);
    if (title !== undefined) update.title = title === null ? null : String(title);
    if (creator !== undefined) update.creator = creator === null ? null : String(creator);
    if (niche !== undefined) update.niche = niche === null ? null : String(niche);
    if (viewCount !== undefined) update.viewCount = Number(viewCount);
    if (likeCount !== undefined) update.likeCount = Number(likeCount);

    const job = await db.repostJob.update({ where: { id }, data: update });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.repostJob.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    await db.repostJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
