import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDbAvailable } from "@/lib/db-helpers";

// GET /api/insights — single mega-endpoint that powers the Dashboard tab.
// Returns aggregated insight blocks plus leaderboard, activity feed, and notifications.
export async function GET() {
  try {
    // If database isn't available, return empty defaults
    if (!(await isDbAvailable())) {
      return NextResponse.json({
        pending: { count: 0, examples: [] },
        ready: { count: 0, projectedViews: 0, examples: [] },
        posted: { count: 0, totalViews: 0, avgViewsPerVideo: 0, deltaVsAverage: 0 },
        schedules: { active: 0, nextRunAt: null, nextRunName: null },
        autopilot: { lastActivityAt: null, idleHours: 0, status: "idle" as const },
        niches: [],
        leaderboard: [],
        activity: [],
        notifications: [],
        dbAvailable: false,
      });
    }

    // --- Pending (discovered | generating) ---
    const pendingVideos = await db.video.findMany({
      where: { status: { in: ["discovered", "generating"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const pendingCount = await db.video.count({
      where: { status: { in: ["discovered", "generating"] } },
    });

    // --- Ready ---
    const readyVideos = await db.video.findMany({
      where: { status: "ready" },
      orderBy: { viralScore: "desc" },
      take: 6,
    });
    const readyCount = await db.video.count({ where: { status: "ready" } });
    const projectedViews = readyVideos.reduce(
      (sum, v) => sum + v.viralScore * 1000,
      0
    );

    // --- Posted performance ---
    const postedAgg = await db.video.aggregate({
      where: { status: "posted" },
      _sum: { ytViews: true },
      _count: { _all: true },
    });
    const postedCount = postedAgg._count._all;
    const totalViews = postedAgg._sum.ytViews ?? 0;
    const avgViewsPerVideo = postedCount > 0 ? Math.round(totalViews / postedCount) : 0;

    // deltaVsAverage: compare last posted video's views vs running average of prior posts.
    let deltaVsAverage = 0;
    if (postedCount > 1) {
      const recent = await db.video.findMany({
        where: { status: "posted" },
        orderBy: { postedAt: "desc" },
        take: postedCount,
      });
      const latest = recent[0];
      const prior = recent.slice(1);
      if (latest && prior.length > 0) {
        const priorAvg =
          prior.reduce((s, v) => s + v.ytViews, 0) / prior.length;
        deltaVsAverage =
          priorAvg > 0
            ? Math.round(((latest.ytViews - priorAvg) / priorAvg) * 100)
            : 0;
      }
    }

    // --- Schedules ---
    const activeSchedules = await db.schedule.findMany({
      where: { enabled: true },
      orderBy: { nextRunAt: "asc" },
    });
    const nextRun = activeSchedules.find((s) => s.nextRunAt) || null;

    // --- Autopilot status (based on most recent activity log) ---
    const lastActivity = await db.activityLog.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const lastActivityAt = lastActivity?.createdAt ?? null;
    const idleMs = lastActivityAt
      ? Date.now() - lastActivityAt.getTime()
      : Number.MAX_SAFE_INTEGER;
    const idleHours = lastActivityAt
      ? Math.floor(idleMs / (1000 * 60 * 60))
      : -1;
    const autopilotStatus = idleHours > 24 || idleHours < 0 ? "idle" : "active";

    // --- Niche diversity ---
    const allVideos = await db.video.findMany({
      select: { niche: true },
    });
    const nicheCounts = new Map<string, number>();
    for (const v of allVideos) {
      const n = v.niche || "unknown";
      nicheCounts.set(n, (nicheCounts.get(n) ?? 0) + 1);
    }
    const totalNicheVideos = allVideos.length || 1;
    const niches = Array.from(nicheCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / totalNicheVideos) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // --- Leaderboard (top 5 by viralScore) ---
    const leaderboard = await db.video.findMany({
      orderBy: { viralScore: "desc" },
      take: 5,
    });

    // --- Activity feed (last 8) ---
    const activity = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    // --- Notifications (last 5 unread) ---
    let notifications = await db.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    // Fallback: if no unread, return the 5 newest so the dashboard always has content.
    if (notifications.length === 0) {
      notifications = await db.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });
    }

    return NextResponse.json({
      pending: { count: pendingCount, examples: pendingVideos },
      ready: { count: readyCount, projectedViews, examples: readyVideos },
      posted: {
        count: postedCount,
        totalViews,
        avgViewsPerVideo,
        deltaVsAverage,
      },
      schedules: {
        active: activeSchedules.length,
        nextRunAt: nextRun?.nextRunAt?.toISOString() ?? null,
        nextRunName: nextRun?.name ?? null,
      },
      autopilot: {
        lastActivityAt: lastActivityAt?.toISOString() ?? null,
        idleHours,
        status: autopilotStatus,
      },
      niches,
      leaderboard,
      activity,
      notifications,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
