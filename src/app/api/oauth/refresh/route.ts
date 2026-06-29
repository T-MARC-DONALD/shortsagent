import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/google-oauth";

/**
 * POST /api/oauth/refresh
 * Body: { platform }
 * Refreshes the OAuth access token for the given platform.
 * Currently only supports YouTube (Google OAuth).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform } = body as { platform: string };
    if (!platform) {
      return NextResponse.json({ ok: false, error: "platform required" }, { status: 400 });
    }

    if (!["youtube"].includes(platform)) {
      return NextResponse.json(
        { ok: false, error: `${platform} OAuth refresh not yet supported` },
        { status: 400 }
      );
    }

    const result = await refreshAccessToken(platform as "youtube");
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      tokenExpiresAt: result.expiresAt,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
