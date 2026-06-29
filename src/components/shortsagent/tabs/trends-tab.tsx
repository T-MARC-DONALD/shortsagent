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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { TrendingUp, Activity, Clock, BarChart3 } from "lucide-react";
import { format } from "date-fns";
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

type RangeKey = "7d" | "14d" | "30d" | "all";

interface TopByNiche {
  niche: string;
  views: number;
  count: number;
}
interface HookEffectiveness {
  hookType: string;
  avgViews: number;
  count: number;
  color: string;
}
interface PostingTimePattern {
  hour: number;
  count: number;
  label: string;
}
interface ViralBucket {
  bucket: string;
  count: number;
}
interface NicheLeaderRow {
  niche: string;
  postedCount: number;
  totalViews: number;
  avgViews: number;
  avgViralScore: number;
}
interface TrendsData {
  range: RangeKey;
  topByNiche: TopByNiche[];
  hookEffectiveness: HookEffectiveness[];
  postingTimePattern: PostingTimePattern[];
  viralScoreDistribution: ViralBucket[];
  nicheLeaderboard: NicheLeaderRow[];
}

const RANGES: { id: RangeKey; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
];

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

const EMERALD = "#10b981";

export function TrendsTab() {
  const [range, setRange] = React.useState<RangeKey>("7d");
  const [data, setData] = React.useState<TrendsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async (r: RangeKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trends?range=${r}`);
      if (!res.ok) throw new Error("fetch failed");
      const j = (await res.json()) as TrendsData;
      setData(j);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const topByNiche = (data?.topByNiche ?? []).slice(0, 8);
  const hookEff = data?.hookEffectiveness ?? [];
  const postingTime = data?.postingTimePattern ?? [];
  const viralDist = data?.viralScoreDistribution ?? [];
  const leaderboard = data?.nicheLeaderboard ?? [];

  // Choose radar color: max value axis
  const radarColor =
    hookEff.length > 0
      ? hookEff.reduce((m, h) => (h.avgViews > m.avgViews ? h : m), hookEff[0]).color
      : EMERALD;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Trends
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spot what&apos;s working across your library.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-md border border-border bg-card/40">
          {RANGES.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={range === r.id ? "default" : "ghost"}
              className={cn(
                "h-7 px-3 text-xs font-mono",
                range === r.id && "bg-emerald-500 text-emerald-950 hover:bg-emerald-500"
              )}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top performing videos by niche */}
        <ChartCard
          title="Top performing videos by niche"
          subtitle="Sum of YouTube views per niche (posted videos)"
          icon={TrendingUp}
        >
          {loading ? (
            <ChartSkeleton />
          ) : topByNiche.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topByNiche}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={fmtNum} />
                <YAxis
                  type="category"
                  dataKey="niche"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  width={80}
                />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmtNum(value), "Views"]}
                />
                <Bar dataKey="views" fill={EMERALD} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Hook-type effectiveness (radar) */}
        <ChartCard
          title="Hook-type effectiveness"
          subtitle="Average YouTube views per posted video by hook type"
          icon={Activity}
        >
          {loading ? (
            <ChartSkeleton />
          ) : hookEff.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={hookEff} outerRadius={110}>
                <PolarGrid stroke="#1f3a2e" />
                <PolarAngleAxis dataKey="hookType" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: "#6b8a7a", fontSize: 10 }} tickFormatter={fmtNum} />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name, props) => [
                    fmtNum(value),
                    props?.payload?.hookType ?? "Avg views",
                  ]}
                />
                <Radar
                  name="Avg views"
                  dataKey="avgViews"
                  stroke={radarColor}
                  fill={radarColor}
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Posting-time patterns */}
        <ChartCard
          title="Posting-time patterns"
          subtitle="Posts by hour of day (0-23)"
          icon={Clock}
        >
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={postingTime}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(h: number) => `${h}h`}
                  interval={1}
                />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(h: number) => `${h.toString().padStart(2, "0")}:00`}
                  formatter={(value: number) => [value, "Posts"]}
                />
                <Bar dataKey="count" fill="url(#emeraldGrad)" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Viral-score distribution */}
        <ChartCard
          title="Viral-score distribution"
          subtitle="Posted videos bucketed by viral score"
          icon={BarChart3}
        >
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={viralDist}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <defs>
                  <linearGradient id="viralGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a2e" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "#0a1714",
                    border: "1px solid #1f3a2e",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value, "Videos"]}
                />
                <Bar dataKey="count" fill="url(#viralGrad)" radius={[3, 3, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Niche leaderboard */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Top niche leaderboard</CardTitle>
              <CardDescription className="text-xs">
                Ranked by total posted views
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead className="text-right">Posted</TableHead>
                  <TableHead className="text-right">Total views</TableHead>
                  <TableHead className="text-right">Avg views</TableHead>
                  <TableHead className="text-right">Avg viral score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, i) => (
                  <TableRow key={row.niche}>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize border-emerald-500/30 text-emerald-300">
                        {row.niche}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.postedCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.totalViews.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.avgViews.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono",
                          row.avgViralScore >= 80
                            ? "bg-emerald-500/20 text-emerald-300"
                            : row.avgViralScore >= 60
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {row.avgViralScore}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Data updated {format(new Date(), "MMM d, yyyy h:mm a")} · Range: {range}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
      <Activity className="w-6 h-6 opacity-40" />
      <span>No posted videos in this range yet.</span>
    </div>
  );
}
