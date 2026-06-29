import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HASHTAG_BANK } from "@/lib/constants";
import { generateTitles } from "@/lib/viral-score";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/generate
// body: { videoId, action: "titles" | "tags" | "description", style?, count? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { videoId, action, style, count } = body as {
      videoId?: string;
      action?: "titles" | "tags" | "description";
      style?: string;
      count?: number;
    };

    // Resolve video: by DB id, by youtubeId, or via an inline `video` payload
    // (lets the Discover tab call /api/generate before persisting a result).
    let video: {
      title: string;
      niche: string | null;
    } | null = null;

    if (videoId) {
      video = await db.video.findUnique({ where: { id: videoId } });
      if (!video) {
        video = await db.video.findUnique({ where: { youtubeId: videoId } });
      }
    }
    if (!video && body?.video && typeof body.video === "object") {
      const v = body.video as { title?: string; niche?: string };
      video = {
        title: String(v.title ?? "Untitled video"),
        niche: v.niche ?? null,
      };
    }
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "Video not found (provide videoId, youtubeId, or an inline video object)" },
        { status: 404 }
      );
    }

    const safeCount = Math.max(1, Math.min(20, Number(count) || 5));
    const safeStyle = (
      ["shock", "curiosity", "fomo", "emotion", "listicle"].includes(
        style ?? ""
      )
        ? (style as
            | "shock"
            | "curiosity"
            | "fomo"
            | "emotion"
            | "listicle")
        : undefined
    );

    if (action === "titles") {
      const titles = await generateTitles(
        { title: video.title, niche: video.niche ?? undefined },
        safeStyle,
        safeCount
      );
      return NextResponse.json({ ok: true, titles });
    }

    if (action === "tags") {
      const tags = HASHTAG_BANK[video.niche ?? "tech"] ?? [];
      return NextResponse.json({ ok: true, tags });
    }

    if (action === "description") {
      const description = await generateDescription(video.title, video.niche ?? "general");
      return NextResponse.json({ ok: true, description });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action. Use titles | tags | description." },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function generateDescription(title: string, niche: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const prompt = `Write a punchy 80-120 character YouTube Shorts description for a clip sourced from "${title}".
Niche: ${niche}.
Include 1 call-to-action and match the short-form viral tone. Return only the description text.`;
    const completion = await zai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return (completion.choices?.[0]?.message?.content ?? "").trim().slice(0, 280);
  } catch {
    return `From "${title}". Follow @ShortsAgent for more viral ${niche} Shorts.`;
  }
}
