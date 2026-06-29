import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/autopilot — return autopilot status
export async function GET() {
  try {
    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    // Last activity (most recent ActivityLog entry)
    const lastActivity = await db.activityLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, action: true, detail: true },
    });

    // Next scheduled run (earliest nextRunAt among enabled schedules)
    const nextSched = await db.schedule.findFirst({
      where: { enabled: true, nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      select: { id: true, name: true, nextRunAt: true },
    });

    // Today stats: videos processed (post + generate actions today) and posts made today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayActivity = await db.activityLog.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { action: true },
    });
    const videosProcessed = todayActivity.filter((a) =>
      ["discover", "generate", "post"].includes(a.action)
    ).length;
    const postsMade = todayActivity.filter((a) => a.action === "post").length;

    return NextResponse.json({
      enabled: settings.autoPost,
      lastActivityAt: lastActivity?.createdAt.toISOString() ?? null,
      lastActivity: lastActivity
        ? { action: lastActivity.action, detail: lastActivity.detail }
        : null,
      nextScheduledRun: nextSched
        ? {
            id: nextSched.id,
            name: nextSched.name,
            nextRunAt: nextSched.nextRunAt!.toISOString(),
          }
        : null,
      todayStats: {
        videosProcessed,
        postsMade,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/autopilot — toggle autoPost in settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "enabled (boolean) required" },
        { status: 400 }
      );
    }
    const updated = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global", autoPost: body.enabled },
      update: { autoPost: body.enabled },
    });
    await db.activityLog.create({
      data: {
        action: "autopilot_toggle",
        detail: body.enabled
          ? "Auto-pilot enabled — schedules are now active."
          : "Auto-pilot disabled — schedules paused.",
        level: body.enabled ? "success" : "warning",
      },
    });
    return NextResponse.json({ ok: true, enabled: updated.autoPost });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
