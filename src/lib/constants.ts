// Shared types & constants for ShortsAgent

export type TabId =
  | "dashboard"
  | "discover"
  | "generator"
  | "queue"
  | "trends"
  | "analytics"
  | "scheduler"
  | "channels"
  | "settings"
  | "repost";

export const TABS: {
  id: TabId;
  label: string;
  shortcut: string;
  description: string;
}[] = [
  { id: "dashboard", label: "Dashboard", shortcut: "1", description: "Command center with insight cards & viral leaderboard" },
  { id: "discover", label: "Discover", shortcut: "2", description: "Find viral long-form videos in your niche" },
  { id: "generator", label: "Generator", shortcut: "3", description: "Generate hook-driven Shorts from source videos" },
  { id: "queue", label: "Queue", shortcut: "4", description: "Production pipeline with drag-and-drop reordering" },
  { id: "trends", label: "Trends", shortcut: "5", description: "Analytics across your library" },
  { id: "analytics", label: "Analytics", shortcut: "6", description: "Deep performance metrics" },
  { id: "scheduler", label: "Scheduler", shortcut: "7", description: "Auto-pilot scheduling with cron/fixed/one-time triggers" },
  { id: "channels", label: "Channels", shortcut: "8", description: "OAuth 2.0 connection management for 4 platforms" },
  { id: "settings", label: "Settings", shortcut: "9", description: "Global agent configuration" },
  { id: "repost", label: "Repost", shortcut: "R", description: "Auto-repost viral Shorts with creator credit" },
];

export type VideoStatus =
  | "discovered"
  | "generating"
  | "ready"
  | "posting"
  | "posted"
  | "failed";

export type HookType = "shock" | "curiosity" | "fomo" | "emotion" | "listicle";

export const HOOK_TYPES: { id: HookType; label: string; color: string; desc: string }[] = [
  { id: "shock", label: "Shock", color: "#ef4444", desc: "Bold, contrarian opening that jolts the viewer" },
  { id: "curiosity", label: "Curiosity", color: "#10b981", desc: "Teases a payoff without revealing it" },
  { id: "fomo", label: "FOMO", color: "#f59e0b", desc: "Fear of missing out — urgency-driven" },
  { id: "emotion", label: "Emotion", color: "#ec4899", desc: "Story-led, emotional resonance" },
  { id: "listicle", label: "Listicle", color: "#8b5cf6", desc: "Numbered list hook (3 reasons…)" },
];

export type Platform = "youtube" | "tiktok" | "instagram" | "twitter";

export const PLATFORMS: {
  id: Platform;
  label: string;
  color: string;
  icon: string;
}[] = [
  { id: "youtube", label: "YouTube", color: "#ff0000", icon: "Youtube" },
  { id: "tiktok", label: "TikTok", color: "#00f2ea", icon: "Music2" },
  { id: "instagram", label: "Instagram", color: "#e1306c", icon: "Instagram" },
  { id: "twitter", label: "Twitter", color: "#1da1f2", icon: "Twitter" },
];

export type RepostStatus =
  | "pending"
  | "downloading"
  | "processing"
  | "ready"
  | "uploading"
  | "posted"
  | "failed";

export const REPOST_STATUSES: { id: RepostStatus; color: string; label: string }[] = [
  { id: "pending", color: "#6b8a7a", label: "Pending" },
  { id: "downloading", color: "#3b82f6", label: "Downloading" },
  { id: "processing", color: "#f59e0b", label: "Processing" },
  { id: "ready", color: "#10b981", label: "Ready" },
  { id: "uploading", color: "#8b5cf6", label: "Uploading" },
  { id: "posted", color: "#10b981", label: "Posted" },
  { id: "failed", color: "#ef4444", label: "Failed" },
];

export const NICHES = [
  "tech",
  "ai",
  "finance",
  "fitness",
  "gaming",
  "cooking",
  "travel",
  "education",
  "music",
  "comedy",
  "lifestyle",
  "business",
  "science",
  "sports",
  "news",
];

export const AUDIO_TRACKS = [
  { id: "hype", label: "Hype Beats", category: "energetic", duration: 30 },
  { id: "calm", label: "Calm Focus", category: "ambient", duration: 30 },
  { id: "trending", label: "Trending Now", category: "viral", duration: 30 },
  { id: "dramatic", label: "Dramatic Cinematic", category: "cinematic", duration: 30 },
  { id: "lofi", label: "Lo-Fi Chill", category: "lofi", duration: 30 },
  { id: "trap", label: "Trap Energy", category: "hiphop", duration: 30 },
  { id: "epic", label: "Epic Build", category: "orchestral", duration: 30 },
  { id: "playful", label: "Playful Pop", category: "pop", duration: 30 },
];

export const HASHTAG_BANK: Record<string, string[]> = {
  tech: ["#tech", "#ai", "#programming", "#coding", "#techtok", "#futuretech", "#innovation", "#startup"],
  ai: ["#ai", "#artificialintelligence", "#machinelearning", "#chatgpt", "#aitools", "#deeplearning", "#datascience", "#neuralnetwork"],
  finance: ["#finance", "#investing", "#stocks", "#money", "#wealth", "#financialfreedom", "#passiveincome", "#crypto"],
  fitness: ["#fitness", "#workout", "#gym", "#health", "#fitnesstips", "#training", "#muscle", "#weightloss"],
  gaming: ["#gaming", "#gamer", "#gameplay", "#twitch", "#esports", "#pcgaming", "#console", "#speedrun"],
  cooking: ["#cooking", "#recipe", "#food", "#foodie", "#chef", "#homecooking", "#easyrecipe", "#foodtok"],
  travel: ["#travel", "#wanderlust", "#travelgram", "#adventure", "#explore", "#vacation", "#travelvlog", "#destination"],
  education: ["#education", "#learning", "#study", "#knowledge", "#facts", "#didyouknow", "#educational", "#learnontiktok"],
  music: ["#music", "#newmusic", "#singer", "#songwriter", "#producer", "#beats", "#musician", "#cover"],
  comedy: ["#comedy", "#funny", "#meme", "#lol", "#viral", "#skit", "#humor", "#comic"],
  lifestyle: ["#lifestyle", "#dailyroutine", "#vlog", "#selfcare", "#mindfulness", "#aesthetic", "#minimalism", "#dayinmylife"],
  business: ["#business", "#entrepreneur", "#marketing", "#startup", "#hustle", "#smallbusiness", "#branding", "#leadership"],
  science: ["#science", "#space", "#physics", "#biology", "#chemistry", "#research", "#stem", "#discovery"],
  sports: ["#sports", "#nba", "#nfl", "#soccer", "#football", "#basketball", "#athlete", "#highlights"],
  news: ["#news", "#breakingnews", "#trending", "#currentevents", "#worldnews", "#politics", "#update", "#viralnews"],
};

// Client-side store for active tab
export const STORAGE_KEY = "shortsagent_tab";
