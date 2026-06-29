import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HOOK_TYPES, type HookType } from "@/lib/constants";

export const dynamic = "force-dynamic";

type RangeKey = "7d" | "14d" | "30d" | "all";

function rangeToCutoff(range: RangeKey): Date | null {
  if (range === "all") return null;
  const days = parseInt(range.replace("d", ""), 10);
  return new Date(Date.now() - days * 86400000);
}

// GET /api/trends?range=7d|14d|30d|all
export async function GET(req: NextRequest) {
  try {
    const rangeParam = req.nextUrl.searchParams.get("range") as RangeKey | null;
    const range: RangeKey = ["7d", "14d", "30d", "all"].includes(rangeParam ?? "")
      ? (rangeParam as RangeKey)
      : "7d";
    const cutoff = rangeToCutoff(range);

    const videos = await db.video.findMany({
      where: {
        status: "posted",
        postedAt: cutoff ? { gte: cutoff } : { not: null },
      },
      select: {
        niche: true,
        hookType: true,
        postedAt: true,
        viralScore: true,
        ytViews: true,
      },
    });

    // 1) Top performing by niche (sum of ytViews)
    const nicheMap = new Map<string, { views: number; count: number }>();
    for (const v of videos) {
      const n = v.niche ?? "unknown";
      const cur = nicheMap.get(n) ?? { views: 0, count: 0 };
      cur.views += v.ytViews;
      cur.count += 1;
      nicheMap.set(n, cur);
    }
    const topByNiche = Array.from(nicheMap.entries())
      .map(([niche, val]) => ({ niche, views: val.views, count: val.count }))
      .sort((a, b) => b.views - a.views);

    // 2) Hook-type effectiveness (avg ytViews per posted video per hook type)
    const hookMap = new Map<string, { views: number; count: number }>();
    for (const v of videos) {
      const h = v.hookType ?? "unknown";
      const cur = hookMap.get(h) ?? { views: 0, count: 0 };
      cur.views += v.ytViews;
      cur.count += 1;
      hookMap.set(h, cur);
    }
    const hookEffectiveness = HOOK_TYPES.map((h) => {
      const e = hookMap.get(h.id);
      return {
        hookType: h.label,
        avgViews: e && e.count > 0 ? Math.round(e.views / e.count) : 0,
        count: e?.count ?? 0,
        color: h.color,
      };
    });
    // Also include "unknown" hookType if any
    for (const [k, v] of hookMap.entries()) {
      if (!HOOK_TYPES.some((h) => h.id === k)) {
        hookEffectiveness.push({
          hookType: k,
          avgViews: v.count > 0 ? Math.round(v.views / v.count) : 0,
          count: v.count,
          color: "#6b8a7a",
        });
      }
    }

    // 3) Posting-time pattern: count per hour of day (0-23)
    const hourBuckets = new Array(24).fill(0);
    for (const v of videos) {
      if (v.postedAt) hourBuckets[v.postedAt.getHours()] += 1;
    }
    const postingTimePattern = hourBuckets.map((count, hour) => ({
      hour,
      count,
      label: `${hour.toString().padStart(2, "0")}:00`,
    }));

    // 4) Viral-score distribution histogram (0-20, 20-40, 40-60, 60-80, 80-100)
    const buckets = [
      { bucket: "0-20", min: 0, max: 20 },
      { bucket: "20-40", min: 20, max: 40 },
      { bucket: "40-60", min: 40, max: 60 },
      { bucket: "60-80", min: 60, max: 80 },
      { bucket: "80-100", min: 80, max: 101 },
    ];
    const viralScoreDistribution = buckets.map((b) => ({
      bucket: b.bucket,
      count: videos.filter((v) => v.viralScore >= b.min && v.viralScore < b.max).length,
    }));

    // 5) Niche leaderboard
    const nicheLeaderboard = Array.from(nicheMap.entries())
      .map(([niche, val]) => {
        const nicheVideos = videos.filter((v) => (v.niche ?? "unknown") === niche);
        const avgViral =
          nicheVideos.length > 0
            ? Math.round(
                nicheVideos.reduce((s, v) => s + v.viralScore, 0) / nicheVideos.length
              )
            : 0;
        return {
          niche,
          postedCount: val.count,
          totalViews: val.views,
          avgViews: val.count > 0 ? Math.round(val.views / val.count) : 0,
          avgViralScore: avgViral,
        };
      })
      .sort((a, b) => b.totalViews - a.totalViews);

    return NextResponse.json({
      range,
      topByNiche,
      hookEffectiveness,
      postingTimePattern,
      viralScoreDistribution,
      nicheLeaderboard,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Re-export type for client usage
export type HookTypeColor = HookType;
