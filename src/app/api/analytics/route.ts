import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HOOK_TYPES, PLATFORMS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// GET /api/analytics — return cross-platform performance metrics
export async function GET() {
  try {
    const posted = await db.video.findMany({
      where: { status: "posted" },
    });
    const allVideos = await db.video.findMany({
      select: {
        id: true,
        title: true,
        niche: true,
        hookType: true,
        viralScore: true,
        status: true,
        postedAt: true,
        postedPlatforms: true,
        ytViews: true,
        ytLikes: true,
        ytComments: true,
        ytShares: true,
        ytWatchTime: true,
        ytSubsGained: true,
      },
    });

    // --- Summary ---
    const totalViews = posted.reduce((s, v) => s + v.ytViews, 0);
    const totalWatchTimeMin = posted.reduce((s, v) => s + v.ytWatchTime, 0);
    const totalSubsGained = posted.reduce((s, v) => s + v.ytSubsGained, 0);
    const totalEng =
      posted.reduce((s, v) => s + v.ytLikes + v.ytComments + v.ytShares, 0);
    const avgEngagementRate =
      totalViews > 0 ? Number(((totalEng / totalViews) * 100).toFixed(2)) : 0;

    // --- Hook counts (pie) ---
    const hookCounts = HOOK_TYPES.map((h) => ({
      hookType: h.label,
      count: posted.filter((v) => v.hookType === h.id).length,
      color: h.color,
    }));
    // Add unknown bucket if any
    const unknownHook = posted.filter(
      (v) => v.hookType && !HOOK_TYPES.some((h) => h.id === v.hookType)
    ).length;
    if (unknownHook > 0) {
      hookCounts.push({ hookType: "Other", count: unknownHook, color: "#6b8a7a" });
    }
    const noHookCount = posted.filter((v) => !v.hookType).length;
    if (noHookCount > 0) {
      hookCounts.push({ hookType: "Unset", count: noHookCount, color: "#4b5563" });
    }

    // --- Platform performance (grouped bar) ---
    const platformPerformance = PLATFORMS.map((p) => {
      let postedCount = 0;
      let totalViewsPlatform = 0;
      for (const v of posted) {
        let plats: string[] = [];
        try {
          plats = v.postedPlatforms ? JSON.parse(v.postedPlatforms) : [];
        } catch {
          plats = [];
        }
        if (plats.includes(p.id)) {
          postedCount += 1;
          totalViewsPlatform += v.ytViews;
        }
      }
      return {
        platform: p.label,
        postedCount,
        totalViews: totalViewsPlatform,
        color: p.color,
      };
    });

    // --- Posting frequency (line, last 14 days) ---
    const days = 14;
    const postingFrequency: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayKey = d.toISOString().slice(0, 10);
      const count = posted.filter((v) => {
        if (!v.postedAt) return false;
        return v.postedAt.toISOString().slice(0, 10) === dayKey;
      }).length;
      postingFrequency.push({
        date: dayKey,
        count,
      });
    }

    // --- Viral-score trend (avg viral score per day, last 14 days, all generated videos) ---
    const viralScoreTrend: { date: string; avgScore: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayKey = d.toISOString().slice(0, 10);
      const dayVideos = allVideos.filter((v) => {
        return v.postedAt && v.postedAt.toISOString().slice(0, 10) === dayKey;
      });
      const avgScore =
        dayVideos.length > 0
          ? Math.round(
              dayVideos.reduce((s, v) => s + v.viralScore, 0) / dayVideos.length
            )
          : 0;
      viralScoreTrend.push({ date: dayKey, avgScore });
    }

    // --- Posted vs unposted (per niche, bar) ---
    const nicheSet = new Set<string>();
    for (const v of allVideos) {
      if (v.niche) nicheSet.add(v.niche);
    }
    const postedVsUnposted = Array.from(nicheSet)
      .sort()
      .map((niche) => ({
        niche,
        posted: allVideos.filter(
          (v) => v.niche === niche && v.status === "posted"
        ).length,
        unposted: allVideos.filter(
          (v) => v.niche === niche && v.status !== "posted"
        ).length,
      }));

    // --- YouTube table ---
    const youtubeTable = posted
      .filter((v) => v.ytViews > 0 || v.ytLikes > 0 || v.ytComments > 0)
      .map((v) => ({
        id: v.id,
        title: v.generatedTitle || v.title,
        niche: v.niche ?? null,
        hookType: v.hookType,
        viralScore: v.viralScore,
        postedAt: v.postedAt?.toISOString() ?? null,
        ytViews: v.ytViews,
        ytLikes: v.ytLikes,
        ytComments: v.ytComments,
        ytShares: v.ytShares,
        ytWatchTime: v.ytWatchTime,
        ytSubsGained: v.ytSubsGained,
        engagementRate:
          v.ytViews > 0
            ? Number(
                (((v.ytLikes + v.ytComments + v.ytShares) / v.ytViews) * 100).toFixed(2)
              )
            : 0,
      }))
      .sort((a, b) => b.ytViews - a.ytViews);

    return NextResponse.json({
      summary: {
        totalViews,
        totalWatchTimeHrs: Math.round(totalWatchTimeMin / 60),
        totalSubsGained,
        avgEngagementRate,
      },
      hookCounts,
      platformPerformance,
      postingFrequency,
      viralScoreTrend,
      postedVsUnposted,
      youtubeTable,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/analytics — placeholder for refreshing YouTube Analytics metrics
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "refresh") {
      return NextResponse.json(
        { ok: false, error: "Unknown action" },
        { status: 400 }
      );
    }
    // Placeholder: in production this would call YouTube Analytics API
    // and update ytViews/ytLikes/ytComments/ytShares/ytWatchTime/ytSubsGained
    return NextResponse.json({ ok: true, refreshed: 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
