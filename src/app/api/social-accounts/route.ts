import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type TokenStatus = "valid" | "warning" | "critical" | "expired";

function computeTokenStatus(expiresAt: Date | null): TokenStatus {
  if (!expiresAt) return "valid";
  const ms = expiresAt.getTime() - Date.now();
  const days = ms / 86400000;
  if (days < 0) return "expired";
  if (days < 2) return "critical";
  if (days < 7) return "warning";
  return "valid";
}

function daysUntil(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  return Math.floor(ms / 86400000);
}

async function ensureSettings() {
  return db.agentSettings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

export async function GET() {
  try {
    await ensureSettings();
    const accounts = await db.socialAccount.findMany({
      orderBy: { platform: "asc" },
    });

    const enriched = accounts.map((a) => {
      const status = (a.tokenStatus as TokenStatus) || computeTokenStatus(a.tokenExpiresAt);
      const recomputed = computeTokenStatus(a.tokenExpiresAt);
      // Use the recomputed status if it's worse (e.g. expired)
      const finalStatus = recomputed === "expired" ? "expired" : status;
      return {
        ...a,
        tokenStatus: finalStatus,
        daysUntilExpiry: daysUntil(a.tokenExpiresAt),
      };
    });

    return NextResponse.json({ accounts: enriched });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, handle, displayName } = body as {
      platform: string;
      handle?: string;
      displayName?: string;
    };
    if (!platform) {
      return NextResponse.json({ ok: false, error: "platform required" }, { status: 400 });
    }

    const existing = await db.socialAccount.findFirst({ where: { platform } });
    const data = {
      handle: handle ?? null,
      displayName: displayName ?? null,
      connected: true,
    };

    let account;
    if (existing) {
      account = await db.socialAccount.update({ where: { id: existing.id }, data });
    } else {
      account = await db.socialAccount.create({ data: { platform, ...data } });
    }

    return NextResponse.json({ ok: true, account });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, ...rest } = body as {
      platform: string;
      autoUpload?: boolean;
      connected?: boolean;
      handle?: string;
      displayName?: string;
      followerCount?: number;
      uploadCount?: number;
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: string;
      tokenStatus?: string;
    };

    if (!platform) {
      return NextResponse.json({ ok: false, error: "platform required" }, { status: 400 });
    }

    const existing = await db.socialAccount.findFirst({ where: { platform } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) update[k] = v;
    }
    if (update.tokenExpiresAt && typeof update.tokenExpiresAt === "string") {
      update.tokenExpiresAt = new Date(update.tokenExpiresAt);
    }

    const account = await db.socialAccount.update({
      where: { id: existing.id },
      data: update,
    });

    return NextResponse.json({ ok: true, account });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform } = body as { platform: string };
    if (!platform) {
      return NextResponse.json({ ok: false, error: "platform required" }, { status: 400 });
    }

    const existing = await db.socialAccount.findFirst({ where: { platform } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    }

    await db.socialAccount.update({
      where: { id: existing.id },
      data: {
        connected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        tokenStatus: "expired",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
