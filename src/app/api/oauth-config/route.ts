import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/oauth-config — list all OAuth configs (secrets masked)
 * POST /api/oauth-config — upsert credentials for a platform
 *   Body: { platform, clientId, clientSecret, redirectUri?, scopes? }
 */
export async function GET() {
  try {
    const configs = await db.oAuthConfig.findMany();
    const masked = configs.map((c) => ({
      ...c,
      clientId: c.clientId ? c.clientId.slice(0, 8) + "..." : null,
      clientSecret: c.clientSecret ? "••••••••" : null,
      hasCredentials: Boolean(c.clientId && c.clientSecret),
    }));
    return NextResponse.json({ ok: true, configs: masked });
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
    const { platform, clientId, clientSecret, redirectUri, scopes } = body;

    if (!platform || !["youtube", "tiktok", "instagram", "twitter"].includes(platform)) {
      return NextResponse.json({ ok: false, error: "Invalid platform" }, { status: 400 });
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json({ ok: false, error: "clientId and clientSecret required" }, { status: 400 });
    }

    const config = await db.oAuthConfig.upsert({
      where: { platform },
      create: {
        platform,
        clientId,
        clientSecret,
        redirectUri,
        scopes,
      },
      update: {
        clientId,
        clientSecret,
        redirectUri,
        scopes,
      },
    });

    return NextResponse.json({
      ok: true,
      config: {
        ...config,
        clientSecret: "••••••••",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
