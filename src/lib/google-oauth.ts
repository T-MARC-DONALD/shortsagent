// google-oauth.ts — real Google OAuth 2.0 flow for YouTube.
// Server-side only.

import { db } from "@/lib/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Scopes needed for YouTube upload + analytics
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

/**
 * Build the Google OAuth consent URL.
 * The user must have already saved their Client ID/Secret via the Channels tab.
 */
export async function buildAuthUrl(
  platform: "youtube",
  redirectUri: string,
  state?: string
): Promise<{ url: string; error?: string }> {
  const config = await db.oAuthConfig.findUnique({ where: { platform } });
  if (!config?.clientId) {
    return {
      url: "",
      error: `No OAuth credentials saved for ${platform}. Please add your Google Client ID and Secret in the Channels tab first.`,
    };
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force refresh_token
    state: state ?? crypto.randomUUID(),
  });

  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
}

/**
 * Exchange the authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  platform: "youtube",
  code: string,
  redirectUri: string
): Promise<{
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}> {
  const config = await db.oAuthConfig.findUnique({ where: { platform } });
  if (!config?.clientId || !config?.clientSecret) {
    return { ok: false, error: "Missing OAuth credentials" };
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const r = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const errText = await r.text();
      return { ok: false, error: `Token exchange failed (${r.status}): ${errText}` };
    }

    const j = await r.json();
    const expiresAt = new Date(Date.now() + (j.expires_in ?? 3600) * 1000);

    return {
      ok: true,
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error during token exchange",
    };
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  platform: "youtube"
): Promise<{ ok: boolean; accessToken?: string; expiresAt?: Date; error?: string }> {
  const config = await db.oAuthConfig.findUnique({ where: { platform } });
  if (!config?.clientId || !config?.clientSecret) {
    return { ok: false, error: "Missing OAuth credentials" };
  }

  const account = await db.socialAccount.findFirst({ where: { platform } });
  if (!account?.refreshToken) {
    return { ok: false, error: "No refresh token stored" };
  }

  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    });

    const r = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      const errText = await r.text();
      return { ok: false, error: `Refresh failed (${r.status}): ${errText}` };
    }

    const j = await r.json();
    const expiresAt = new Date(Date.now() + (j.expires_in ?? 3600) * 1000);

    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: j.access_token,
        tokenExpiresAt: expiresAt,
        tokenStatus: "valid",
      },
    });

    return { ok: true, accessToken: j.access_token, expiresAt };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error during refresh",
    };
  }
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidAccessToken(platform: "youtube"): Promise<{
  ok: boolean;
  accessToken?: string;
  error?: string;
}> {
  const account = await db.socialAccount.findFirst({ where: { platform } });
  if (!account?.connected || !account?.accessToken) {
    return { ok: false, error: `${platform} not connected` };
  }

  // If token expires within 5 minutes, refresh
  const msUntilExpiry = account.tokenExpiresAt
    ? account.tokenExpiresAt.getTime() - Date.now()
    : 0;

  if (msUntilExpiry < 300000) {
    const r = await refreshAccessToken(platform);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, accessToken: r.accessToken };
  }

  return { ok: true, accessToken: account.accessToken };
}

/**
 * Fetch the connected user's YouTube channel info (handle, follower count).
 */
export async function fetchYouTubeChannel(accessToken: string): Promise<{
  ok: boolean;
  handle?: string;
  displayName?: string;
  avatar?: string;
  subscriberCount?: number;
  error?: string;
}> {
  try {
    const r = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!r.ok) {
      return { ok: false, error: `YouTube API error (${r.status})` };
    }
    const j = await r.json();
    const ch = j.items?.[0];
    if (!ch) return { ok: false, error: "No channel found" };
    return {
      ok: true,
      handle: ch.snippet?.customUrl ?? `@${ch.snippet?.title ?? "user"}`,
      displayName: ch.snippet?.title ?? "YouTube Creator",
      avatar: ch.snippet?.thumbnails?.default?.url,
      subscriberCount: parseInt(ch.statistics?.subscriberCount ?? "0", 10),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
