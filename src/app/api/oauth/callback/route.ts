import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForTokens, fetchYouTubeChannel } from "@/lib/google-oauth";

/**
 * GET /api/oauth/callback?platform=youtube&code=...&state=...
 * Handles the OAuth redirect from Google. Exchanges the code, stores tokens,
 * then redirects to the home page with a success toast.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as "youtube";
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?oauth_error=${encodeURIComponent(error)}`, url.origin)
    );
  }

  if (!platform || !code) {
    return NextResponse.redirect(
      new URL("/?oauth_error=missing_code", url.origin)
    );
  }

  // Reconstruct the redirect URI (must match the one used in /connect)
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/oauth/callback?platform=${platform}`;

  const tokens = await exchangeCodeForTokens(platform, code, redirectUri);
  if (!tokens.ok || !tokens.accessToken) {
    return NextResponse.redirect(
      new URL(`/?oauth_error=${encodeURIComponent(tokens.error ?? "token_exchange_failed")}`, url.origin)
    );
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
    refreshToken: tokens.refreshToken ?? existing?.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    tokenStatus: "valid" as const,
    connected: true,
    autoUpload: true,
  };

  if (existing) {
    await db.socialAccount.update({ where: { id: existing.id }, data });
  } else {
    await db.socialAccount.create({ data });
  }

  await db.activityLog.create({
    data: {
      action: "oauth",
      detail: `Connected ${platform} account: ${data.displayName}`,
      level: "success",
    },
  });

  // Redirect back to the app — the Channels tab will show connected state
  return NextResponse.redirect(
    new URL("/?oauth_success=1&platform=youtube", url.origin)
  );
}
