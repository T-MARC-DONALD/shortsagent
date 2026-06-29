import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDbAvailable } from "@/lib/db-helpers";

// Default settings returned when the database isn't available
const DEFAULT_SETTINGS = {
  id: "global",
  niche: "tech",
  channelName: "@ShortsAgent",
  postingSchedule: "0 9,12,18 * * *",
  autoPost: false,
  minViews: 50000,
  maxDuration: 1500,
  clipsPerDay: 3,
  titleStyle: "curiosity",
  language: "en",
  autoRepost: false,
  repostNiche: "tech",
  repostMinViews: 100000,
  repostCreditFmt: "Credit: @creator",
  repostMaxPerDay: 5,
  repostInterval: 60,
};

// Allowed fields for PATCH updates
const UPDATABLE_FIELDS = [
  "niche",
  "channelName",
  "postingSchedule",
  "autoPost",
  "minViews",
  "maxDuration",
  "clipsPerDay",
  "titleStyle",
  "language",
  "autoRepost",
  "repostNiche",
  "repostMinViews",
  "repostCreditFmt",
  "repostMaxPerDay",
  "repostInterval",
] as const;

// GET /api/settings — return global AgentSettings (upsert if missing)
export async function GET() {
  try {
    if (!(await isDbAvailable())) {
      // Return default settings instead of 500
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[settings] GET error:", e);
    // Return defaults instead of 500 so the UI doesn't break
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// PATCH /api/settings — update fields from body
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    for (const key of UPDATABLE_FIELDS) {
      if (key in body && body[key] !== undefined) {
        data[key] = body[key];
      }
    }

    // Ensure the singleton exists before update
    await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    if (Object.keys(data).length === 0) {
      const current = await db.agentSettings.findUnique({
        where: { id: "global" },
      });
      return NextResponse.json({ ok: true, settings: current });
    }

    const updated = await db.agentSettings.update({
      where: { id: "global" },
      data,
    });
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
