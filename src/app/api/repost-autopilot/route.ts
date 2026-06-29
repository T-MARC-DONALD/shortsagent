import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAutoRepost } from "@/lib/repost-service";

export async function GET() {
  try {
    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await db.repostJob.count({
      where: { createdAt: { gte: today } },
    });

    const remaining = Math.max(0, settings.repostMaxPerDay - todayCount);

    // Approximate last run from the most recent job today.
    const latest = await db.repostJob.findFirst({
      where: { createdAt: { gte: today } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return NextResponse.json({
      enabled: settings.autoRepost,
      todayCount,
      remaining,
      lastRunAt: latest?.createdAt ?? null,
      maxPerDay: settings.repostMaxPerDay,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;

    // Toggle enabled
    if (typeof body.enabled === "boolean") {
      const settings = await db.agentSettings.upsert({
        where: { id: "global" },
        create: { id: "global", autoRepost: body.enabled },
        update: { autoRepost: body.enabled },
      });
      return NextResponse.json({ ok: true, enabled: settings.autoRepost });
    }

    // Trigger a manual run
    if (body.action === "run") {
      const { enqueued, capped } = await runAutoRepost();
      return NextResponse.json({ ok: true, enqueued, capped });
    }

    return NextResponse.json(
      { ok: false, error: "Provide { enabled: boolean } or { action: 'run' }" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
