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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// POST /api/schedule-shorts — trigger an immediate run for a schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const scheduleId: string = (body.scheduleId ?? "").toString();
    if (!scheduleId) {
      return NextResponse.json(
        { ok: false, error: "scheduleId required" },
        { status: 400 }
      );
    }
    const schedule = await db.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      return NextResponse.json({ ok: false, error: "schedule not found" }, { status: 404 });
    }
    const stages = safeParseStages(schedule.stages);

    // Create a RunHistory entry as "running"
    const startedAt = new Date();
    const runHistory = await db.runHistory.create({
      data: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        status: "running",
        startedAt,
        stage: stages.join(","),
        results: null,
      },
    });

    // Simulate each stage in order
    const stageResults: Record<string, unknown> = {};
    try {
      for (const stage of stages) {
        await sleep(200); // simulate work
        if (stage === "discover") {
          stageResults[stage] = { found: 6 + Math.floor(Math.random() * 8), added: 2 + Math.floor(Math.random() * 3) };
        } else if (stage === "generate") {
          stageResults[stage] = { clips: 2 + Math.floor(Math.random() * 3), renders: 2 + Math.floor(Math.random() * 3) };
        } else if (stage === "post") {
          stageResults[stage] = { posted: 1 + Math.floor(Math.random() * 3), platforms: 2 + Math.floor(Math.random() * 4) };
        }
      }
      const finishedAt = new Date();
      await db.runHistory.update({
        where: { id: runHistory.id },
        data: {
          status: "success",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          results: JSON.stringify(stageResults),
        },
      });
      // Update schedule.lastRunAt and recompute nextRunAt
      const nextRunAt = computeNextRun(schedule.kind as ScheduleKind, schedule.expr);
      await db.schedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: finishedAt, nextRunAt },
      });
      // Log activity
      await db.activityLog.create({
        data: {
          action: "schedule_run",
          detail: `Manual run of "${schedule.name}" completed (${stages.join(",")})`,
          level: "success",
          meta: JSON.stringify({ scheduleId: schedule.id, runHistoryId: runHistory.id }),
        },
      });
      return NextResponse.json({
        ok: true,
        runHistoryId: runHistory.id,
        results: stageResults,
      });
    } catch (err) {
      const finishedAt = new Date();
      await db.runHistory.update({
        where: { id: runHistory.id },
        data: {
          status: "failed",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: err instanceof Error ? err.message : "Unknown error",
        },
      });
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
