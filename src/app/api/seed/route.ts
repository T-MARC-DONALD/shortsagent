import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/seed — initialize only the global settings singleton.
 * Does NOT create fake videos, accounts, or schedules.
 * The app starts empty — the user must discover real videos and connect real accounts.
 */
export async function POST(_req: NextRequest) {
  try {
    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    return NextResponse.json({
      ok: true,
      settings,
      message: "Database initialized. Visit Discover to find real videos, and Channels to connect your YouTube account.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/seed — wipe all data (videos, accounts, jobs, logs).
 * Useful for starting fresh. Does NOT delete the AgentSettings singleton.
 */
export async function DELETE() {
  try {
    await db.socialPost.deleteMany();
    await db.repostJob.deleteMany();
    await db.socialAccount.deleteMany();
    await db.oAuthConfig.deleteMany();
    await db.runHistory.deleteMany();
    await db.schedule.deleteMany();
    await db.notification.deleteMany();
    await db.activityLog.deleteMany();
    await db.video.deleteMany();

    return NextResponse.json({ ok: true, message: "All data wiped." });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
