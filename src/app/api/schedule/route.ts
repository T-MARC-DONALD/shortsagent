import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

export const dynamic = "force-dynamic";

type ScheduleKind = "cron" | "fixed_rate" | "one_time";

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
      // expr can be epoch millis OR ISO string
      const asNum = Number(expr);
      if (Number.isFinite(asNum) && asNum > 0) {
        return new Date(asNum);
      }
      const d = new Date(expr);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/schedule — list all schedules, sorted by nextRunAt asc (nulls last)
export async function GET() {
  try {
    const schedules = await db.schedule.findMany({
      orderBy: [{ nextRunAt: { sort: "asc", nulls: "last" } }],
    });
    // Re-sort client-side to ensure nulls last (Prisma SQLite may not support nulls)
    schedules.sort((a, b) => {
      if (!a.nextRunAt && !b.nextRunAt) return 0;
      if (!a.nextRunAt) return 1;
      if (!b.nextRunAt) return -1;
      return a.nextRunAt.getTime() - b.nextRunAt.getTime();
    });
    const parsed = schedules.map((s) => ({
      ...s,
      stages: safeParseStages(s.stages),
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
    return NextResponse.json({ schedules: parsed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function safeParseStages(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// POST /api/schedule — create a new schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name: string = (body.name ?? "").toString().trim();
    const kind: ScheduleKind = ["cron", "fixed_rate", "one_time"].includes(body.kind)
      ? (body.kind as ScheduleKind)
      : "cron";

    let expr: string;
    if (kind === "cron") {
      expr = (body.expr ?? "0 9 * * *").toString();
    } else if (kind === "fixed_rate") {
      const mins = Number(body.expr ?? 60);
      expr = Number.isFinite(mins) && mins > 0 ? String(mins) : "60";
    } else {
      // one_time — expr may come in as epoch millis OR ISO string
      expr = (body.expr ?? "").toString();
    }

    const stagesRaw: unknown = body.stages;
    const stages: string[] = Array.isArray(stagesRaw)
      ? stagesRaw.filter((s) => ["discover", "generate", "post"].includes(String(s))).map(String)
      : ["discover", "generate", "post"];
    if (stages.length === 0) stages.push("discover");

    const niche: string | null =
      typeof body.niche === "string" && body.niche.trim() ? body.niche.trim() : null;
    const timezone: string =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "America/Los_Angeles";
    const enabled: boolean = body.enabled !== false;

    const nextRunAt = computeNextRun(kind, expr);

    const created = await db.schedule.create({
      data: {
        name: name || "Untitled Schedule",
        kind,
        expr,
        stages: JSON.stringify(stages),
        niche,
        timezone,
        enabled,
        nextRunAt,
      },
    });

    return NextResponse.json({
      ok: true,
      schedule: {
        ...created,
        stages: safeParseStages(created.stages),
        nextRunAt: created.nextRunAt?.toISOString() ?? null,
        lastRunAt: created.lastRunAt?.toISOString() ?? null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/schedule — update a single schedule by id
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id: string = (body.id ?? "").toString();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
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

    // Recompute nextRunAt if kind/expr changed
    const newKind = (data.kind as ScheduleKind) ?? (existing.kind as ScheduleKind);
    const newExpr = (data.expr as string) ?? existing.expr;
    if (data.kind !== undefined || data.expr !== undefined) {
      data.nextRunAt = computeNextRun(newKind, newExpr);
    }

    const updated = await db.schedule.update({ where: { id }, data });
    return NextResponse.json({
      ok: true,
      schedule: {
        ...updated,
        stages: safeParseStages(updated.stages),
        nextRunAt: updated.nextRunAt?.toISOString() ?? null,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
