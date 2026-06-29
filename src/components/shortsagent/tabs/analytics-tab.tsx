"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  Eye,
  Clock,
  UserPlus,
  Percent,
  PieChart as PieIcon,
  Activity,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Youtube,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HOOK_TYPES, PLATFORMS } from "@/lib/constants";

interface Summary {
  totalViews: number;
  totalWatchTimeHrs: number;
  totalSubsGained: number;
  avgEngagementRate: number;
}
interface HookCount {
  hookType: string;
  count: number;
  color: string;
}
interface PlatformPerf {
  platform: string;
  postedCount: number;
  totalViews: number;
  color: string;
}
interface FrequencyPoint {
  date: string;
  count: number;
}
interface TrendPoint {
  date: string;
  avgScore: number;
}
interface PostedVsUnpostedRow {
  niche: string;
  posted: number;
  unposted: number;
}
interface YtTableRow {
  id: string;
  title: string;
  niche: string | null;
  hookType: string | null;
  viralScore: number;
  postedAt: string | null;
  ytViews: number;
  ytLikes: number;
  ytComments: number;
  ytShares: number;
  ytWatchTime: number;
  ytSubsGained: number;
  engagementRate: number;
}
interface AnalyticsData {
  summary: Summary;
  hookCounts: HookCount[];
  platformPerformance: PlatformPerf[];
  postingFrequency: FrequencyPoint[];
  viralScoreTrend: TrendPoint[];
  postedVsUnposted: PostedVsUnpostedRow[];
  youtubeTable: YtTableRow[];
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {subtitle && (
              <CardDescription className="text-xs">{subtitle}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[280px] w-full flex flex-col gap-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="flex-1 w-full" />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
              {label}
            </p>
            <p className="text-2xl font-semibold mt-1 truncate">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const EMERALD = "#10b981";

type SortKey = "ytViews" | "ytLikes" | "ytComments" | "ytShares" | "ytWatchTime" | "ytSubsGained" | "engagementRate" | "title";

export function AnalyticsTab() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("ytViews");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("fetch failed");
      const j = (await res.json()) as AnalyticsData;
      setData(j);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const summary = data?.summary;
  const hookCounts = data?.hookCounts ?? [];
  const platformPerf = data?.platformPerformance ?? [];
  const postingFreq = data?.postingFrequency ?? [];
  const viralTrend = data?.viralScoreTrend ?? [];
  const postedVsUnposted = data?.postedVsUnposted ?? [];
  const ytTable = data?.youtubeTable ?? [];

  const sortedYtTable = React.useMemo(() => {
    const rows = [...ytTable];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return rows;
  }, [ytTable, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const sortIcon = (k: SortKey) => {
    if (k !== sortKey) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-0.5 text-emerald-400" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-0.5 text-emerald-400" />
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deep performance metrics across platforms.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 gap-1.5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          Refresh from YouTube
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total views"
              value={fmtNum(summary.totalViews)}
              sub="Across all posted videos"
              icon={Eye}
            />
            <StatCard
              label="Watch time"
              value={`${fmtNum(summary.totalWatchTimeHrs)} hrs`}
              sub="Cumulative minutes / 60"
              icon={Clock}
            />
            <StatCard
              label="Subs gained"
              value={`+${fmtNum(summary.totalSubsGained)}`}
              sub="From Shorts posts"
              icon={UserPlus}
            />
            <StatCard
              label="Avg engagement"
              value={`${summary.avgEngagementRate.toFixed(2)}%`}
              sub="Likes + comments + shares / views"
              icon={Percent}
            />
          </>
        )}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hook-type counts pie */}
        <ChartCard
          title="Hook-type counts"
          subtitle="Posted videos per hook type"
          icon={PieIcon}
        >
          {loading ? (
            <ChartSkeleton />
          ) : hookCounts.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={hookCounts}
                  dataKey="count"
                  nameKey="hookType"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {hookCounts.map((h, i) => (
                    <Cell key={i} fill={h.color} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Platform performance grouped bar */}
        <ChartCard
          title="Platform performance"
          subtitle="Posted count + total views per platform"
          icon={Activity}
        >
          {loading ? (
            <ChartSkeleton />
          ) : platformPerf.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={platformPerf} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis dataKey="platform" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickFormatter={fmtNum}
                />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="left"
                  name="Posted count"
                  dataKey="postedCount"
                  fill="#34d399"
                  radius={[3, 3, 0, 0]}
                  barSize={18}
                />
                <Bar
                  yAxisId="right"
                  name="Total views"
                  dataKey="totalViews"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Posting frequency line */}
        <ChartCard
          title="Posting frequency"
          subtitle="Posts per day, last 14 days"
          icon={Activity}
        >
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={postingFreq} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                  minTickGap={20}
                />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(d: string) => format(parseISO(d), "MMM d, yyyy")}
                  formatter={(value: number) => [value, "Posts"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={EMERALD}
                  strokeWidth={2}
                  dot={{ fill: EMERALD, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Viral score trend line */}
        <ChartCard
          title="Average viral score trend"
          subtitle="Avg viral score per day, last 14 days"
          icon={Activity}
        >
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={viralTrend} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(d: string) => format(parseISO(d), "MMM d, yyyy")}
                  formatter={(value: number) => [value, "Avg score"]}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Posted vs unposted */}
        <ChartCard
          title="Posted vs unposted"
          subtitle="Per niche pipeline status"
          icon={BarChart3}
        >
          {loading ? (
            <ChartSkeleton />
          ) : postedVsUnposted.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={postedVsUnposted} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis dataKey="niche" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Posted" dataKey="posted" stackId="a" fill={EMERALD} radius={[0, 0, 0, 0]} barSize={20} />
                <Bar name="Unposted" dataKey="unposted" stackId="a" fill="#475569" radius={[3, 3, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* YouTube analytics table */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center">
                <Youtube className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">YouTube analytics</CardTitle>
                <CardDescription className="text-xs">
                  Real YouTube metrics for posted videos · click headers to sort
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : sortedYtTable.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-h-[480px] overflow-y-auto rounded-md border border-border/60">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("title")}
                      >
                        Title {sortIcon("title")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytViews")}
                      >
                        Views {sortIcon("ytViews")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytLikes")}
                      >
                        Likes {sortIcon("ytLikes")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytComments")}
                      >
                        Comments {sortIcon("ytComments")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytShares")}
                      >
                        Shares {sortIcon("ytShares")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytWatchTime")}
                      >
                        Watch (min) {sortIcon("ytWatchTime")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("ytSubsGained")}
                      >
                        Subs {sortIcon("ytSubsGained")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="font-medium hover:text-emerald-300 transition-colors"
                        onClick={() => toggleSort("engagementRate")}
                      >
                        Eng. rate {sortIcon("engagementRate")}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedYtTable.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[260px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate font-medium text-sm" title={r.title}>
                            {r.title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {r.niche && (
                              <Badge variant="outline" className="text-[10px] capitalize py-0 h-4">
                                {r.niche}
                              </Badge>
                            )}
                            {r.hookType && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 h-4"
                                style={{
                                  color: HOOK_TYPES.find((h) => h.id === r.hookType)?.color,
                                  borderColor: `${HOOK_TYPES.find((h) => h.id === r.hookType)?.color}55`,
                                }}
                              >
                                {HOOK_TYPES.find((h) => h.id === r.hookType)?.label ?? r.hookType}
                              </Badge>
                            )}
                            {r.postedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(r.postedAt), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.ytViews.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.ytLikes.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.ytComments.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.ytShares.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.ytWatchTime.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-400">
                        +{r.ytSubsGained.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono text-xs",
                            r.engagementRate >= 5
                              ? "bg-emerald-500/20 text-emerald-300"
                              : r.engagementRate >= 2
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.engagementRate.toFixed(2)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform legend footer */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-mono">Platforms:</span>
        {PLATFORMS.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
      <Activity className="w-6 h-6 opacity-40" />
      <span>No data yet — post some videos to see analytics.</span>
    </div>
  );
}
