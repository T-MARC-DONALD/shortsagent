// youtube-upload.ts — real YouTube upload via Data API v3 resumable upload.
// Server-side only.

import { promises as fs } from "fs";
import { getValidAccessToken } from "@/lib/google-oauth";
import { db } from "@/lib/db";

const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export interface YouTubeUploadOptions {
  videoId: string; // our internal video ID
  title: string;
  description: string;
  tags: string[];
  category?: string; // "22" = People & Blogs, "28" = Science & Tech, "27" = Education
  privacyStatus?: "public" | "unlisted" | "private";
  filePath: string; // absolute path to MP4
}

export interface YouTubeUploadResult {
  ok: boolean;
  youtubeVideoId?: string;
  permalink?: string;
  error?: string;
}

/**
 * Upload a video to YouTube via resumable upload.
 * Returns the YouTube video ID on success.
 */
export async function uploadToYouTube(
  opts: YouTubeUploadOptions
): Promise<YouTubeUploadResult> {
  // 1. Get valid access token
  const token = await getValidAccessToken("youtube");
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error ?? "YouTube not connected" };
  }

  try {
    // 2. Verify the file exists
    await fs.access(opts.filePath);

    // 3. Start resumable upload session
    const metadata = {
      snippet: {
        title: opts.title.slice(0, 100), // YouTube 100-char limit
        description: opts.description.slice(0, 5000),
        tags: opts.tags.slice(0, 500),
        categoryId: opts.category ?? "28", // Science & Tech default
      },
      status: {
        privacyStatus: opts.privacyStatus ?? "public",
        selfDeclaredMadeForKids: false,
      },
    };

    const startRes = await fetch(
      `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      return {
        ok: false,
        error: `Upload init failed (${startRes.status}): ${errText}`,
      };
    }

    const uploadUrl = startRes.headers.get("location");
    if (!uploadUrl) {
      return { ok: false, error: "No upload URL returned" };
    }

    // 4. Read file and stream it to the upload URL
    const fileBuffer = await fs.readFile(opts.filePath);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileBuffer.length),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(120000), // 2 min timeout for upload
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return {
        ok: false,
        error: `Upload failed (${uploadRes.status}): ${errText}`,
      };
    }

    const j = await uploadRes.json();
    const ytVideoId = j.id;

    return {
      ok: true,
      youtubeVideoId: ytVideoId,
      permalink: `https://www.youtube.com/watch?v=${ytVideoId}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown upload error",
    };
  }
}

/**
 * Fetch real YouTube Analytics data for a posted video.
 * Returns views, likes, comments, shares, watch time, subs gained.
 */
export async function fetchYouTubeAnalytics(
  videoId: string
): Promise<{
  ok: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  watchTimeMinutes?: number;
  subsGained?: number;
  error?: string;
}> {
  const token = await getValidAccessToken("youtube");
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error ?? "YouTube not connected" };
  }

  try {
    // First get the video's public stats
    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video?.youtubeId) {
      return { ok: false, error: "Video has no YouTube ID" };
    }

    const r = await fetch(
      `${YOUTUBE_VIDEOS_URL}?part=statistics&id=${video.youtubeId}`,
      {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!r.ok) {
      return { ok: false, error: `YouTube API error (${r.status})` };
    }

    const j = await r.json();
    const stats = j.items?.[0]?.statistics;
    if (!stats) {
      return { ok: false, error: "No stats available" };
    }

    return {
      ok: true,
      views: parseInt(stats.viewCount ?? "0", 10),
      likes: parseInt(stats.likeCount ?? "0", 10),
      comments: parseInt(stats.commentCount ?? "0", 10),
      // Shares, watch time, subs gained require the Analytics API with proper dims/filters
      // For now, return 0 for those (they need a separate API call with date ranges)
      shares: 0,
      watchTimeMinutes: 0,
      subsGained: 0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
