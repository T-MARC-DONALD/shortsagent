import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/run-history — list run history (paginated)
export async function GET(req: NextRequest) {
  try {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "10", 10))
    );
    const [items, total] = await Promise.all([
      db.runHistory.findMany({
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.runHistory.count(),
    ]);
    const serialized = items.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));
    return NextResponse.json({
      items: serialized,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
