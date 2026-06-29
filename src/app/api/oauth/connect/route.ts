import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAuthUrl, exchangeCodeForTokens, fetchYouTubeChannel } from "@/lib/google-oauth";
import { PLATFORMS } from "@/lib/constants";

/**
 * GET /api/oauth/connect?platform=youtube
 * Returns the Google OAuth consent URL for the user to visit.
 *
 * POST /api/oauth/connect
 * Body: { platform, code, redirectUri }
 * Exchanges the OAuth code for tokens and stores them.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as "youtube" | null;
  if (!platform || !["youtube"].includes(platform)) {
    return NextResponse.json(
      { ok: false, error: "Invalid platform. Only 'youtube' is supported for real OAuth in this build." },
      { status: 400 }
    );
  }

  // Build the redirect URI — use the host from the request headers
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/oauth/callback?platform=${platform}`;

  const { url: authUrl, error } = await buildAuthUrl(platform, redirectUri);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, authUrl, redirectUri });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, code, redirectUri } = body;

    if (!platform || !code) {
      return NextResponse.json({ ok: false, error: "platform and code required" }, { status: 400 });
    }

    if (!["youtube"].includes(platform)) {
      return NextResponse.json(
        { ok: false, error: "Only 'youtube' supports real OAuth in this build." },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(platform, code, redirectUri);
    if (!tokens.ok || !tokens.accessToken) {
      return NextResponse.json({ ok: false, error: tokens.error }, { status: 400 });
    }

    // Fetch channel info
    const channel = await fetchYouTubeChannel(tokens.accessToken);

    // Upsert the social account
    const existing = await db.socialAccount.findFirst({ where: { platform } });
    const data = {
      platform,
      handle: channel.handle ?? `@${platform}user`,
      displayName: channel.displayName ?? "YouTube Creator",
      avatar: channel.avatar,
      followerCount: channel.subscriberCount ?? 0,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      tokenStatus: "valid" as const,
      connected: true,
      autoUpload: true,
    };

    const account = existing
      ? await db.socialAccount.update({ where: { id: existing.id }, data })
      : await db.socialAccount.create({ data });

    await db.activityLog.create({
      data: {
        action: "oauth",
        detail: `Connected ${platform} account: ${account.displayName}`,
        level: "success",
      },
    });

    return NextResponse.json({ ok: true, account });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
