import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDbAvailable } from "@/lib/db-helpers";

// GET /api/notifications — list notifications (newest first, optional ?unread=true)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get("unread") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

    // If database isn't available, return empty array instead of 500
    if (!(await isDbAvailable())) {
      return NextResponse.json([]);
    }

    const items = await db.notification.findMany({
      where: onlyUnread ? { read: false } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("[notifications] GET error:", e);
    // Return empty array instead of 500 so the UI doesn't break
    return NextResponse.json([]);
  }
}

// POST /api/notifications — create a notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = typeof body.type === "string" ? body.type : "info";
    const title = typeof body.title === "string" ? body.title : "Untitled";
    const message = typeof body.message === "string" ? body.message : null;

    const item = await db.notification.create({
      data: { type, title, message },
    });
    return NextResponse.json(item);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — mark all as read, or mark one as read
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.all) {
      await db.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      await db.notification.update({
        where: { id: body.id },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Provide { all: true } or { id }" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
