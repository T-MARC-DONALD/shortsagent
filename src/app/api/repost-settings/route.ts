import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const REPOST_FIELDS = [
  "autoRepost",
  "repostNiche",
  "repostMinViews",
  "repostCreditFmt",
  "repostMaxPerDay",
  "repostInterval",
] as const;

export async function GET() {
  try {
    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });

    return NextResponse.json({
      autoRepost: settings.autoRepost,
      repostNiche: settings.repostNiche,
      repostMinViews: settings.repostMinViews,
      repostCreditFmt: settings.repostCreditFmt,
      repostMaxPerDay: settings.repostMaxPerDay,
      repostInterval: settings.repostInterval,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;

    const update: Record<string, unknown> = {};
    if (typeof body.autoRepost === "boolean") update.autoRepost = body.autoRepost;
    if (typeof body.repostNiche === "string") update.repostNiche = body.repostNiche;
    if (typeof body.repostMinViews === "number") update.repostMinViews = body.repostMinViews;
    if (typeof body.repostCreditFmt === "string") update.repostCreditFmt = body.repostCreditFmt;
    if (typeof body.repostMaxPerDay === "number") update.repostMaxPerDay = body.repostMaxPerDay;
    if (typeof body.repostInterval === "number") update.repostInterval = body.repostInterval;

    const settings = await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...update },
      update,
    });

    const resp: Record<string, unknown> = {};
    for (const f of REPOST_FIELDS) {
      resp[f] = settings[f];
    }
    return NextResponse.json({ ok: true, ...resp });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
