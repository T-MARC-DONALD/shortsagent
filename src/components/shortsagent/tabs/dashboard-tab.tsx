"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Rocket,
  TrendingUp,
  Calendar,
  Zap,
  Layers,
  RefreshCw,
  Search,
  Wand2,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Trophy,
  Activity as ActivityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { TabId } from "@/lib/constants";

// --- Types (mirror the shape returned by /api/insights) -------------------
type VideoLike = {
  id: string;
  title: string;
  channelTitle?: string | null;
  thumbnail?: string | null;
  niche?: string | null;
  hookType?: string | null;
  viralScore: number;
  ytViews: number;
  viewCount: number;
  status: string;
};

type ActivityLogLike = {
  id: string;
  action: string;
  detail?: string | null;
  level: string;
  createdAt: string;
};

type NotificationLike = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  read: boolean;
  createdAt: string;
};

type InsightsResponse = {
  pending: { count: number; examples: VideoLike[] };
  ready: { count: number; projectedViews: number; examples: VideoLike[] };
  posted: {
    count: number;
    totalViews: number;
    avgViewsPerVideo: number;
    deltaVsAverage: number;
  };
  schedules: {
    active: number;
    nextRunAt: string | null;
    nextRunName: string | null;
  };
  autopilot: {
    lastActivityAt: string | null;
    idleHours: number;
    status: "active" | "idle";
  };
  niches: { name: string; count: number; pct: number }[];
  leaderboard: VideoLike[];
  activity: ActivityLogLike[];
  notifications: NotificationLike[];
};

// --- Helpers ---------------------------------------------------------------
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return "never";
  const diffMs = Date.now() - d;
  if (diffMs < 0) return "in the future";
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 2_592_000_000) return `${Math.floor(diffMs / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// --- Color tokens per insight card ----------------------------------------
type AccentKey = "amber" | "emerald" | "blue" | "violet" | "red" | "pink";
const ACCENTS: Record<
  AccentKey,
  { ring: string; text: string; bg: string; glow: string }
> = {
  amber: {
    ring: "border-amber-500/30 hover:border-amber-500/60",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    glow: "group-hover:shadow-amber-500/10",
  },
  emerald: {
    ring: "border-emerald-500/30 hover:border-emerald-500/60",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    glow: "group-hover:shadow-emerald-500/10",
  },
  blue: {
    ring: "border-blue-500/30 hover:border-blue-500/60",
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    glow: "group-hover:shadow-blue-500/10",
  },
  violet: {
    ring: "border-violet-500/30 hover:border-violet-500/60",
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    glow: "group-hover:shadow-violet-500/10",
  },
  red: {
    ring: "border-red-500/30 hover:border-red-500/60",
    text: "text-red-400",
    bg: "bg-red-500/10",
    glow: "group-hover:shadow-red-500/10",
  },
  pink: {
    ring: "border-pink-500/30 hover:border-pink-500/60",
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    glow: "group-hover:shadow-pink-500/10",
  },
};

// Medal colors for the leaderboard ranks 1..5
const MEDAL_COLORS = [
  "text-amber-400",
  "text-slate-300",
  "text-orange-400",
  "text-muted-foreground",
  "text-muted-foreground",
];

// Level → badge styling for activity feed
function levelBadge(level: string): { label: string; className: string } {
  switch (level) {
    case "success":
      return {
        label: level,
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      };
    case "warning":
      return {
        label: level,
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    case "error":
      return {
        label: level,
        className: "bg-red-500/15 text-red-300 border-red-500/30",
      };
    default:
      return {
        label: level,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

// --- Insight card sub-component -------------------------------------------
function InsightCard({
  icon: Icon,
  accent,
  title,
  value,
  subtitle,
  children,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: AccentKey;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const a = ACCENTS[accent];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group text-left bg-card rounded-xl border p-5 transition-all duration-200",
        a.ring,
        a.glow,
        "hover:shadow-lg",
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
            {title}
          </p>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
            a.bg,
            a.text
          )}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </Comp>
  );
}

// --- Skeleton block --------------------------------------------------------
function CardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

// --- Main component --------------------------------------------------------
export function DashboardTab({
  onNavigate,
}: {
  onNavigate?: (tab: TabId) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = React.useState<InsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchData = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const r = await fetch("/api/insights", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: InsightsResponse = await r.json();
        setData(j);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast({
          title: "Failed to load dashboard",
          description: msg,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  React.useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const overConcentrated = (data?.niches ?? []).find((n) => n.pct > 50);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous Shorts pipeline at a glance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-mono text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
          onClick={() => fetchData()}
          disabled={refreshing}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Insight cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Videos waiting to be processed */}
          <InsightCard
            icon={Clock}
            accent="amber"
            title="Waiting to be processed"
            value={data?.pending.count ?? 0}
            subtitle={`${data?.pending.examples.length ?? 0} new in queue · click to open pipeline`}
            onClick={() => onNavigate?.("queue")}
          />

          {/* 2. Videos ready to publish */}
          <InsightCard
            icon={Rocket}
            accent="emerald"
            title="Ready to publish"
            value={data?.ready.count ?? 0}
            subtitle={`Projected ${formatCompact(
              data?.ready.projectedViews ?? 0
            )} views based on viral scores`}
            onClick={() => onNavigate?.("queue")}
          />

          {/* 3. Posted performance */}
          <InsightCard
            icon={TrendingUp}
            accent="blue"
            title="Posted performance"
            value={formatCompact(data?.posted.totalViews ?? 0)}
            subtitle={
              <span>
                {formatNum(data?.posted.avgViewsPerVideo ?? 0)} avg / video ·{" "}
                <span
                  className={
                    (data?.posted.deltaVsAverage ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  {(data?.posted.deltaVsAverage ?? 0) >= 0 ? "+" : ""}
                  {data?.posted.deltaVsAverage ?? 0}% vs avg
                </span>
              </span>
            }
          />

          {/* 4. Active schedules */}
          <InsightCard
            icon={Calendar}
            accent="violet"
            title="Active schedules"
            value={data?.schedules.active ?? 0}
            subtitle={
              data?.schedules.nextRunAt
                ? `Next: ${data.schedules.nextRunName ?? "Unnamed"} · ${timeAgo(
                    data.schedules.nextRunAt
                  )} (scheduled)`
                : "No upcoming runs scheduled"
            }
            onClick={() => onNavigate?.("scheduler")}
          />

          {/* 5. Auto-pilot activity status */}
          <InsightCard
            icon={Zap}
            accent={data?.autopilot.status === "active" ? "emerald" : "red"}
            title="Auto-pilot status"
            value={data?.autopilot.status === "active" ? "Active" : "Idle"}
            subtitle={
              data?.autopilot.status === "active"
                ? `Last activity ${timeAgo(data?.autopilot.lastActivityAt ?? null)}`
                : `Idle for ${data?.autopilot.idleHours >= 0 ? data?.autopilot.idleHours : "24+"}h — auto-pilot needs attention`
            }
          >
            {data?.autopilot.status === "idle" && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Idle longer than 24 hours</span>
              </div>
            )}
          </InsightCard>

          {/* 6. Niche diversity */}
          <InsightCard
            icon={Layers}
            accent="pink"
            title="Niche diversity"
            value={`${data?.niches.length ?? 0} niches`}
            subtitle={
              overConcentrated
                ? `Over-concentrated on "${overConcentrated.name}" (${overConcentrated.pct}%)`
                : "Distribution looks healthy"
            }
          >
            {data && data.niches.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.niches.slice(0, 6).map((n) => (
                  <Badge
                    key={n.name}
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      n.pct > 50
                        ? "border-red-500/40 text-red-300 bg-red-500/10"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {n.name} · {n.pct}%
                  </Badge>
                ))}
              </div>
            )}
          </InsightCard>
        </div>
      )}

      {/* Quick-action buttons */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mr-1">
            Quick actions
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => onNavigate?.("discover")}
          >
            <Search className="w-3.5 h-3.5" />
            Discover
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => onNavigate?.("generator")}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate Title
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => onNavigate?.("analytics")}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Analytics
          </Button>
        </div>
      )}

      {/* Leaderboard + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leaderboard — spans 2 cols on desktop */}
        <Card className="lg:col-span-2 bg-card border-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold tracking-tight">
                Top-5 Viral Leaderboard
              </h2>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono text-muted-foreground"
            >
              by viral score
            </Badge>
          </div>

          {loading ? (
            <div className="px-5 pb-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-6" />
                  <Skeleton className="h-12 w-20 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                  <Skeleton className="h-6 w-14" />
                </div>
              ))}
            </div>
          ) : (data?.leaderboard?.length ?? 0) === 0 ? (
            <div className="px-5 pb-8 pt-2 text-sm text-muted-foreground">
              No videos yet — discover some to populate the leaderboard.
            </div>
          ) : (
            <div className="px-2 pb-3">
              {(data?.leaderboard ?? []).map((v, i) => (
                <LeaderboardRow key={v.id} rank={i + 1} video={v} />
              ))}
            </div>
          )}
        </Card>

        {/* Activity feed */}
        <Card className="bg-card border-border flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold tracking-tight">
                Activity Feed
              </h2>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono text-muted-foreground"
            >
              last {data?.activity.length ?? 0}
            </Badge>
          </div>

          {loading ? (
            <div className="px-5 pb-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-2 w-2 mt-2 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (data?.activity?.length ?? 0) === 0 ? (
            <div className="px-5 pb-8 pt-2 text-sm text-muted-foreground">
              No activity logged yet.
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[420px] px-2">
              <div className="space-y-1 pb-4">
                {(data?.activity ?? []).map((log) => {
                  const badge = levelBadge(log.level);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            log.level === "success" && "bg-emerald-400",
                            log.level === "warning" && "bg-amber-400",
                            log.level === "error" && "bg-red-400",
                            log.level === "info" && "bg-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] font-mono", badge.className)}
                          >
                            {log.action}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {timeAgo(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-foreground/80 line-clamp-2">
                          {log.detail || "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Leaderboard row -------------------------------------------------------
function LeaderboardRow({ rank, video }: { rank: number; video: VideoLike }) {
  const medalClass = MEDAL_COLORS[rank - 1] ?? "text-muted-foreground";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: rank * 0.04 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors group"
    >
      {/* Rank */}
      <div
        className={cn(
          "w-7 text-center font-mono text-sm font-bold shrink-0",
          medalClass
        )}
      >
        #{rank}
      </div>

      {/* Thumbnail */}
      <div className="relative w-16 h-10 rounded overflow-hidden bg-muted shrink-0">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground font-mono">
              no img
            </span>
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight line-clamp-1">
          {video.title}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-mono">
            {video.channelTitle || "unknown"}
          </span>
          {video.niche && (
            <Badge
              variant="outline"
              className="text-[9px] font-mono border-emerald-500/30 text-emerald-300 bg-emerald-500/5"
            >
              {video.niche}
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress
            value={video.viralScore}
            className="h-1.5 max-w-[140px] bg-muted"
          />
          <span className="text-[10px] font-mono text-muted-foreground">
            {video.viralScore}/100
          </span>
        </div>
      </div>

      {/* View count */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {formatCompact(video.ytViews || video.viewCount)}
        </p>
        <p className="text-[9px] text-muted-foreground font-mono uppercase">
          views
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors shrink-0" />
    </motion.div>
  );
}
