import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/stats — aggregate counts across the pipeline
export async function GET() {
  try {
    const [
      totalVideos,
      posted,
      ready,
      generating,
      discovered,
      failed,
      repostJobs,
      schedulesActive,
      aggPosted,
      aggViral,
    ] = await Promise.all([
      db.video.count(),
      db.video.count({ where: { status: "posted" } }),
      db.video.count({ where: { status: "ready" } }),
      db.video.count({ where: { status: "generating" } }),
      db.video.count({ where: { status: "discovered" } }),
      db.video.count({ where: { status: "failed" } }),
      db.repostJob.count(),
      db.schedule.count({ where: { enabled: true } }),
      db.video.aggregate({ where: { status: "posted" }, _sum: { ytViews: true } }),
      db.video.aggregate({ _avg: { viralScore: true } }),
    ]);

    return NextResponse.json({
      totalVideos,
      posted,
      ready,
      generating,
      discovered,
      failed,
      repostJobs,
      schedulesActive,
      totalViews: aggPosted._sum.ytViews ?? 0,
      avgViralScore: Math.round(aggViral._avg.viralScore ?? 0),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
