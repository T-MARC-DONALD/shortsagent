// viral-score.ts — LLM-powered viral potential scoring via z-ai-web-dev-sdk
// Server-side only.

import ZAI from "z-ai-web-dev-sdk";

export interface ViralScoreInput {
  title: string;
  channelTitle?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: number;
  niche?: string;
}

export interface ViralScoreResult {
  score: number; // 0-100
  reasoning: string;
  hookType: "shock" | "curiosity" | "fomo" | "emotion" | "listicle";
}

const BATCH_SIZE = 5;

/**
 * Batch-score videos for viral potential.
 * Falls back to a heuristic score on any LLM failure.
 */
export async function scoreVideosBatch(
  videos: ViralScoreInput[]
): Promise<ViralScoreResult[]> {
  const results: ViralScoreResult[] = [];
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    try {
      const batchResults = await scoreBatchLLM(batch);
      results.push(...batchResults);
    } catch (e) {
      for (const v of batch) results.push(heuristicScore(v));
    }
  }
  return results;
}

async function scoreBatchLLM(
  batch: ViralScoreInput[]
): Promise<ViralScoreResult[]> {
  const zai = await ZAI.create();
  const prompt = `You are a viral content analyst for YouTube Shorts.
Score each video 0-100 on viral potential for short-form clipping.
Return ONLY a JSON array (no prose) of objects with fields:
score (number 0-100), reasoning (string <= 30 words), hookType (one of: shock, curiosity, fomo, emotion, listicle)

Videos:
${batch
  .map(
    (v, i) =>
      `${i + 1}. Title: "${v.title}" | Channel: ${v.channelTitle ?? "unknown"} | Views: ${v.viewCount} | Likes: ${v.likeCount} | Comments: ${v.commentCount} | Duration: ${v.duration}s | Niche: ${v.niche ?? "general"}`
  )
  .join("\n")}

Return JSON array only.`;

  const completion = await zai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const content = completion.choices?.[0]?.message?.content ?? "[]";
  // Extract JSON array from response
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return batch.map(heuristicScore);
  try {
    const parsed = JSON.parse(match[0]) as ViralScoreResult[];
    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      return batch.map(heuristicScore);
    }
    return parsed.map((p) => ({
      score: Math.max(0, Math.min(100, Number(p.score) || 50)),
      reasoning: String(p.reasoning ?? "").slice(0, 200),
      hookType: (["shock", "curiosity", "fomo", "emotion", "listicle"].includes(
        p.hookType
      )
        ? p.hookType
        : "curiosity") as ViralScoreResult["hookType"],
    }));
  } catch {
    return batch.map(heuristicScore);
  }
}

/** Fallback heuristic scorer — used when LLM is unavailable. */
export function heuristicScore(v: ViralScoreInput): ViralScoreResult {
  const engagementRate =
    v.viewCount > 0 ? (v.likeCount + v.commentCount * 5) / v.viewCount : 0;
  // Higher engagement rate → higher score
  let score = 50;
  score += Math.min(30, engagementRate * 200);
  score += Math.min(15, Math.log10(Math.max(1, v.viewCount)) * 2);
  if (v.duration > 600 && v.duration < 1500) score += 5; // Sweet spot
  if (v.duration > 2400) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Hook type heuristic from title
  const title = v.title.toLowerCase();
  let hookType: ViralScoreResult["hookType"] = "curiosity";
  if (/\b(shocking|never|secret|exposed|truth|brutal)\b/.test(title)) hookType = "shock";
  else if (/\b(you won't|what happened|here's why|the real)\b/.test(title)) hookType = "curiosity";
  else if (/\b(before|limited|last chance|ending|urgent|now)\b/.test(title)) hookType = "fomo";
  else if (/\b(story|heart|cried|emotional|touched|love)\b/.test(title)) hookType = "emotion";
  else if (/\b(\d+|top \d|best \d|reasons|ways|tips)\b/.test(title)) hookType = "listicle";

  return {
    score,
    reasoning: `Heuristic: engagement ${(engagementRate * 100).toFixed(2)}% + view velocity. Hook classified as ${hookType} from title.`,
    hookType,
  };
}

/**
 * Generate hook-driven title variants for a video.
 */
export async function generateTitles(
  video: { title: string; niche?: string },
  style?: "shock" | "curiosity" | "fomo" | "emotion" | "listicle",
  count = 5
): Promise<string[]> {
  try {
    const zai = await ZAI.create();
    const prompt = `Generate ${count} short-form (<=60 chars) YouTube Shorts titles for the source video below.
Style: ${style ?? "mixed (rotate between shock, curiosity, fomo, emotion, listicle)"}.
Niche: ${video.niche ?? "general"}.
Source title: "${video.title}".

Return ONLY a JSON array of strings (no commentary). Each title must be punchy and click-driven.`;

    const completion = await zai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const content = completion.choices?.[0]?.message?.content ?? "[]";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return fallbackTitles(video.title, count);
    try {
      const parsed = JSON.parse(match[0]) as string[];
      if (Array.isArray(parsed)) return parsed.slice(0, count);
    } catch {
      // fallthrough
    }
    return fallbackTitles(video.title, count);
  } catch {
    return fallbackTitles(video.title, count);
  }
}

function fallbackTitles(source: string, count: number): string[] {
  const templates = [
    `You Won't Believe What Happened Next...`,
    `The ${source.slice(0, 30)} Secret Nobody Tells You`,
    `This Changed Everything in 30 Seconds`,
    `Wait For It... 🤯`,
    `Why Everyone Is Talking About This`,
    `3 Reasons This Went Viral`,
    `The Brutal Truth About ${source.slice(0, 25)}`,
    `I Tried It So You Don't Have To`,
  ];
  return templates.slice(0, count);
}
