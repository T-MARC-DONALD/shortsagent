import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

export const dynamic = "force-dynamic";

type ScheduleKind = "cron" | "fixed_rate" | "one_time";

function safeParseStages(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function computeNextRun(kind: ScheduleKind, expr: string): Date | null {
  try {
    if (kind === "cron") {
      const it = CronExpressionParser.parse(expr, { tz: undefined });
      return it.next().toDate();
    }
    if (kind === "fixed_rate") {
      const minutes = parseInt(expr, 10);
      if (!Number.isFinite(minutes) || minutes <= 0) return null;
      return new Date(Date.now() + minutes * 60000);
    }
    if (kind === "one_time") {
      const asNum = Number(expr);
      if (Number.isFinite(asNum) && asNum > 0) return new Date(asNum);
      const d = new Date(expr);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function serialize(s: {
  id: string;
  name: string;
  kind: string;
  expr: string;
  stages: string;
  niche: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...s,
    stages: safeParseStages(s.stages),
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// GET /api/schedule/[id]
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const s = await db.schedule.findUnique({ where: { id } });
    if (!s) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ schedule: serialize(s) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/schedule/[id]
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    await db.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/schedule/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.kind === "string" && ["cron", "fixed_rate", "one_time"].includes(body.kind))
      data.kind = body.kind;
    if (typeof body.expr === "string") data.expr = body.expr;
    if (typeof body.timezone === "string") data.timezone = body.timezone;
    if (typeof body.niche === "string") data.niche = body.niche.trim() || null;
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (Array.isArray(body.stages)) {
      data.stages = JSON.stringify(
        body.stages.filter((s: unknown) =>
          ["discover", "generate", "post"].includes(String(s))
        )
      );
    }

    const newKind = (data.kind as ScheduleKind) ?? (existing.kind as ScheduleKind);
    const newExpr = (data.expr as string) ?? existing.expr;
    if (data.kind !== undefined || data.expr !== undefined) {
      data.nextRunAt = computeNextRun(newKind, newExpr);
    }

    const updated = await db.schedule.update({ where: { id }, data });
    return NextResponse.json({ ok: true, schedule: serialize(updated) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
