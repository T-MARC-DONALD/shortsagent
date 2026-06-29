"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  Plus,
  Check,
  Eye,
  Clock,
  Loader2,
  Wand2,
  ChevronDown,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NICHES, HOOK_TYPES, type HookType } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredVideo {
  youtubeId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  niche?: string;
  viralScore: number;
  hookType: HookType;
  reasoning: string;
}

interface SettingsShape {
  niche?: string;
  minViews?: number;
  maxDuration?: number;
  titleStyle?: string;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(score: number): string {
  if (score < 40) return "#ef4444";
  if (score < 70) return "#f59e0b";
  return "#10b981";
}

function CircularScore({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}

function hookMeta(id: HookType) {
  return HOOK_TYPES.find((h) => h.id === id) ?? HOOK_TYPES[1];
}

export function DiscoverTab() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<SettingsShape | null>(null);
  const [query, setQuery] = React.useState("");
  const [niche, setNiche] = React.useState("tech");
  const [minViews, setMinViews] = React.useState(50000);
  const [maxDuration, setMaxDuration] = React.useState(1500);
  const [autoMeta, setAutoMeta] = React.useState(true);

  const [videos, setVideos] = React.useState<DiscoveredVideo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [titlesFor, setTitlesFor] = React.useState<string | null>(null);
  const [titles, setTitles] = React.useState<string[] | null>(null);
  const [loadingTitles, setLoadingTitles] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(12);

  // Pull settings on mount (gracefully handle 404 if settings agent hasn't wired it)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        if (!r.ok) return;
        const j = await r.json();
        const s = (j?.settings ?? j) as SettingsShape;
        if (cancelled) return;
        setSettings(s);
        if (s.niche) setNiche(s.niche);
        if (s.minViews) setMinViews(s.minViews);
        if (s.maxDuration) setMaxDuration(s.maxDuration);
      } catch {
        // ignore — defaults are fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = React.useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setVisibleCount(12);
    setVideos([]);
    try {
      const r = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          niche,
          minViews,
          maxDuration,
          autoGenerateMetadata: autoMeta,
        }),
      });
      if (!r.ok) throw new Error(`Search failed (${r.status})`);
      const j = await r.json();
      const list: DiscoveredVideo[] = j.videos ?? [];
      setVideos(list);
      if (list.length === 0) {
        toast({
          title: "No videos found",
          description: "Try lowering the min views or raising max duration.",
        });
      } else {
        toast({
          title: `Found ${list.length} viral candidate${list.length === 1 ? "" : "s"}`,
          description: "Scored & ranked by viral potential.",
        });
      }
    } catch (e) {
      toast({
        title: "Search failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [query, niche, minViews, maxDuration, autoMeta, toast]);

  const addToQueue = React.useCallback(
    async (v: DiscoveredVideo) => {
      setAddingId(v.youtubeId);
      try {
        const r = await fetch("/api/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "add", video: v }),
        });
        if (!r.ok) throw new Error(`Add failed (${r.status})`);
        setAddedIds((prev) => new Set(prev).add(v.youtubeId));
        toast({
          title: "Added to queue",
          description: `"${v.title.slice(0, 50)}…" is now in your production queue.`,
        });
      } catch (e) {
        toast({
          title: "Failed to add",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setAddingId(null);
      }
    },
    [toast]
  );

  const generateTitle = React.useCallback(
    async (v: DiscoveredVideo) => {
      setTitlesFor(v.youtubeId);
      setLoadingTitles(true);
      setTitles(null);
      try {
        const r = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            videoId: v.youtubeId,
            action: "titles",
            style: v.hookType,
            count: 5,
            video: { title: v.title, niche: v.niche },
          }),
        });
        if (!r.ok) throw new Error(`Generate failed (${r.status})`);
        const j = await r.json();
        setTitles(j.titles ?? []);
      } catch (e) {
        toast({
          title: "Title generation failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoadingTitles(false);
      }
    },
    [toast]
  );

  const visible = videos.slice(0, visibleCount);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Discover Viral Long-Form Videos
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-powered search & viral scoring in your niche.
        </p>
      </div>

      {/* Search panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4 text-emerald-400" />
            Search & Score
          </CardTitle>
          <CardDescription>
            Find YouTube long-form videos with viral clipping potential.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 space-y-1.5">
              <Label htmlFor="disc-query" className="text-xs text-muted-foreground">
                Free-text query
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="disc-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`e.g. "ai tools" or "startup breakdown"`}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch();
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Niche</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select niche" />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disc-minviews" className="text-xs text-muted-foreground">
                Min views
              </Label>
              <Input
                id="disc-minviews"
                type="number"
                min={0}
                value={minViews}
                onChange={(e) => setMinViews(Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disc-maxdur" className="text-xs text-muted-foreground">
                Max duration (sec)
              </Label>
              <Input
                id="disc-maxdur"
                type="number"
                min={60}
                value={maxDuration}
                onChange={(e) => setMaxDuration(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={autoMeta} onCheckedChange={setAutoMeta} />
              <span className="text-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Auto-generate metadata
              </span>
            </label>
            <Button
              onClick={runSearch}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-semibold"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Searching & scoring…" : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && searched && videos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Search className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">No results matched your filters.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try lowering the min views or raising the max duration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !searched && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Flame className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Run a search to discover viral content in your niche.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Curated results are scored 0-100 by an LLM viral analyst.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && videos.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="text-foreground font-medium">
                {visible.length}
              </span>{" "}
              of {videos.length} videos, sorted by viral score
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {visible.map((v) => {
                const hm = hookMeta(v.hookType);
                const added = addedIds.has(v.youtubeId);
                const adding = addingId === v.youtubeId;
                return (
                  <motion.div
                    key={v.youtubeId + v.title}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card className="overflow-hidden h-full hover:border-emerald-500/40 transition-colors">
                      <div className="relative aspect-video bg-muted">
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                          }}
                        />
                        <div className="absolute top-2 left-2">
                          <Badge
                            className="backdrop-blur-md border-0 text-white"
                            style={{ backgroundColor: hm.color }}
                          >
                            {hm.label}
                          </Badge>
                        </div>
                        <div className="absolute bottom-2 right-2">
                          <Badge className="bg-black/70 backdrop-blur-md border-0 text-white font-mono">
                            {fmtDuration(v.duration)}
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <CircularScore score={v.viralScore} />
                          <div className="min-w-0 flex-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm font-medium leading-snug line-clamp-2 cursor-help">
                                  {v.title}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm text-xs">
                                {v.reasoning || "No reasoning provided."}
                              </TooltipContent>
                            </Tooltip>
                            <p className="text-xs text-muted-foreground mt-1">
                              {v.channelTitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {fmtViews(v.viewCount)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-emerald-400" />
                            {v.likeCount.toLocaleString()} likes
                          </span>
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock className="w-3.5 h-3.5" />
                            {fmtDuration(v.duration)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => addToQueue(v)}
                            disabled={adding || added}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-semibold"
                          >
                            {adding ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : added ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            {added ? "Added" : adding ? "Adding…" : "Add to Queue"}
                          </Button>

                          <Popover
                            open={titlesFor === v.youtubeId}
                            onOpenChange={(o) => {
                              if (!o) {
                                setTitlesFor(null);
                                setTitles(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateTitle(v)}
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                                Title
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3" align="end">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  AI title ideas
                                </p>
                                {loadingTitles ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Generating…
                                  </div>
                                ) : titles && titles.length > 0 ? (
                                  <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                    {titles.map((t, i) => (
                                      <li
                                        key={i}
                                        className="text-sm px-2 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(t).catch(() => {});
                                          toast({ title: "Copied to clipboard" });
                                        }}
                                      >
                                        {t}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No titles returned.
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {visibleCount < videos.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + 12)}
              >
                <ChevronDown className="w-4 h-4" />
                Load more
                <Badge variant="secondary" className="ml-1">
                  {videos.length - visibleCount}
                </Badge>
              </Button>
            </div>
          )}
        </>
      )}

      {settings && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Loaded defaults from your agent settings — niche:{" "}
          <span className="text-foreground font-mono">{settings.niche ?? "tech"}</span>
          , min views:{" "}
          <span className="text-foreground font-mono">
            {(settings.minViews ?? 50000).toLocaleString()}
          </span>
          .
        </p>
      )}
    </div>
  );
}
