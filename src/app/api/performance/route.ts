import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Platform = "youtube" | "tiktok" | "instagram" | "twitter";

// GET /api/performance — posted-video performance breakdown by platform, hook type, niche, plus 14-day timeseries.
export async function GET() {
  try {
    const postedVideos = await db.video.findMany({
      where: { status: "posted" },
      select: {
        id: true,
        niche: true,
        hookType: true,
        postedAt: true,
        postedPlatforms: true,
        ytViews: true,
        ytLikes: true,
      },
    });

    // --- By platform ---
    const byPlatform: Record<string, { count: number; views: number; likes: number }> = {
      youtube: { count: 0, views: 0, likes: 0 },
      tiktok: { count: 0, views: 0, likes: 0 },
      instagram: { count: 0, views: 0, likes: 0 },
      twitter: { count: 0, views: 0, likes: 0 },
    };
    for (const v of postedVideos) {
      let plats: string[] = [];
      try {
        plats = v.postedPlatforms ? (JSON.parse(v.postedPlatforms) as string[]) : [];
      } catch {
        plats = [];
      }
      for (const p of plats) {
        if (p in byPlatform) {
          byPlatform[p].count += 1;
          byPlatform[p].views += v.ytViews;
          byPlatform[p].likes += v.ytLikes;
        }
      }
    }

    // --- By hook type ---
    const byHookTypeMap = new Map<
      string,
      { count: number; views: number }
    >();
    for (const v of postedVideos) {
      const k = v.hookType || "unknown";
      const entry = byHookTypeMap.get(k) ?? { count: 0, views: 0 };
      entry.count += 1;
      entry.views += v.ytViews;
      byHookTypeMap.set(k, entry);
    }
    const byHookType: Record<string, { count: number; avgViews: number }> = {};
    for (const [k, v] of byHookTypeMap.entries()) {
      byHookType[k] = {
        count: v.count,
        avgViews: v.count > 0 ? Math.round(v.views / v.count) : 0,
      };
    }

    // --- By niche ---
    const byNicheMap = new Map<string, { count: number; views: number }>();
    for (const v of postedVideos) {
      const k = v.niche || "unknown";
      const entry = byNicheMap.get(k) ?? { count: 0, views: 0 };
      entry.count += 1;
      entry.views += v.ytViews;
      byNicheMap.set(k, entry);
    }
    const byNiche: Record<string, { count: number; avgViews: number }> = {};
    for (const [k, v] of byNicheMap.entries()) {
      byNiche[k] = {
        count: v.count,
        avgViews: v.count > 0 ? Math.round(v.views / v.count) : 0,
      };
    }

    // --- Timeseries: group posted videos by day for the last 14 days ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const buckets: { date: string; posted: number; views: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      buckets.push({
        date: d.toISOString().slice(0, 10),
        posted: 0,
        views: 0,
      });
    }
    const bucketIndex = new Map(buckets.map((b, i) => [b.date, i]));
    for (const v of postedVideos) {
      if (!v.postedAt) continue;
      const ds = v.postedAt.toISOString().slice(0, 10);
      const idx = bucketIndex.get(ds);
      if (idx !== undefined) {
        buckets[idx].posted += 1;
        buckets[idx].views += v.ytViews;
      }
    }

    return NextResponse.json({
      byPlatform: byPlatform as Record<Platform, { count: number; views: number; likes: number }>,
      byHookType,
      byNiche,
      timeseries: buckets,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
