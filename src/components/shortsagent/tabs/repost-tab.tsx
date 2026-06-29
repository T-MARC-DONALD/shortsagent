"use client";

import * as React from "react";
import {
  Repeat2,
  Search,
  Loader2,
  Eye,
  Heart,
  Play,
  Trash2,
  RotateCw,
  UploadCloud,
  Film,
  Sparkles,
  Cpu,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  NICHES,
  PLATFORMS,
  REPOST_STATUSES,
  type Platform,
  type RepostStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RepostJob {
  id: string;
  sourceUrl: string;
  sourceShortId: string | null;
  title: string | null;
  creator: string | null;
  thumbnail: string | null;
  viewCount: number;
  likeCount: number;
  niche: string | null;
  status: RepostStatus;
  progress: number;
  creditFormat: string;
  postedPlatforms: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface Candidate {
  sourceUrl: string;
  sourceShortId: string;
  title: string;
  creator: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  duration: number;
  niche: string;
}

interface RepostSettings {
  autoRepost: boolean;
  repostNiche: string;
  repostMinViews: number;
  repostCreditFmt: string;
  repostMaxPerDay: number;
  repostInterval: number;
}

const DEFAULT_SETTINGS: RepostSettings = {
  autoRepost: false,
  repostNiche: "tech",
  repostMinViews: 100000,
  repostCreditFmt: "Credit: @creator",
  repostMaxPerDay: 5,
  repostInterval: 60,
};

const STATUS_META: Record<RepostStatus, { color: string; pulse: boolean; label: string }> = Object.fromEntries(
  REPOST_STATUSES.map((s) => [s.id, { color: s.color, pulse: ["downloading", "processing", "uploading"].includes(s.id), label: s.label }])
) as Record<RepostStatus, { color: string; pulse: boolean; label: string }>;

const PLATFORM_DOT_COLOR: Record<Platform, string> = {
  youtube: "bg-red-500",
  tiktok: "bg-cyan-400",
  instagram: "bg-pink-500",
  twitter: "bg-sky-500",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function parsePlatforms(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function RepostTab() {
  const { toast } = useToast();

  // Settings
  const [settings, setSettings] = React.useState<RepostSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [settingsSaving, setSettingsSaving] = React.useState(false);

  // Discover
  const [discoverNiche, setDiscoverNiche] = React.useState("tech");
  const [discoverMinViews, setDiscoverMinViews] = React.useState(100000);
  const [discovering, setDiscovering] = React.useState(false);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [addingId, setAddingId] = React.useState<string | null>(null);

  // Queue
  const [jobs, setJobs] = React.useState<RepostJob[]>([]);
  const [jobsLoading, setJobsLoading] = React.useState(true);
  const [actionBusy, setActionBusy] = React.useState<Record<string, boolean>>({});

  // Credit preview
  const [creditFormat, setCreditFormat] = React.useState("Credit: @creator");
  const [sampleCreator, setSampleCreator] = React.useState("@aibreakthroughs");

  // Stats
  const stats = React.useMemo(() => {
    const total = jobs.length;
    const posted = jobs.filter((j) => j.status === "posted").length;
    const pending = jobs.filter((j) =>
      ["pending", "downloading", "processing", "ready", "uploading"].includes(j.status)
    ).length;
    const totalViews = jobs.reduce((sum, j) => sum + (j.viewCount ?? 0), 0);
    return { total, posted, pending, totalViews };
  }, [jobs]);

  // Load settings
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/repost-settings");
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const merged: RepostSettings = { ...DEFAULT_SETTINGS, ...j };
        setSettings(merged);
        setDiscoverNiche(merged.repostNiche);
        setDiscoverMinViews(merged.repostMinViews);
        setCreditFormat(merged.repostCreditFmt);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load jobs with polling
  const loadJobs = React.useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const r = await fetch("/api/repost-jobs");
      if (!r.ok) return;
      const j = await r.json();
      setJobs(Array.isArray(j.jobs) ? j.jobs : []);
    } catch {
      // ignore
    } finally {
      setJobsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadJobs();
    const id = setInterval(loadJobs, 5000);
    const onVis = () => {
      if (!document.hidden) loadJobs();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadJobs]);

  // Save settings
  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const r = await fetch("/api/repost-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) throw new Error("Save failed");
      toast({ title: "Repost settings saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  // Discover
  async function discover() {
    setDiscovering(true);
    setCandidates([]);
    try {
      const r = await fetch("/api/repost-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: discoverNiche, minViews: discoverMinViews }),
      });
      if (!r.ok) throw new Error("Discover failed");
      const j = await r.json();
      setCandidates(j.candidates ?? []);
      toast({ title: `Discovered ${(j.candidates ?? []).length} viral Shorts` });
    } catch (e) {
      toast({
        title: "Discover failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDiscovering(false);
    }
  }

  // Add to queue
  async function addToQueue(c: Candidate) {
    setAddingId(c.sourceShortId);
    try {
      const r = await fetch("/api/repost-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: c.sourceUrl,
          sourceShortId: c.sourceShortId,
          title: c.title,
          creator: c.creator,
          thumbnail: c.thumbnail,
          viewCount: c.viewCount,
          likeCount: c.likeCount,
          niche: c.niche,
        }),
      });
      if (!r.ok) throw new Error("Add failed");
      toast({ title: "Added to repost queue", description: c.title });
      await loadJobs();
    } catch (e) {
      toast({
        title: "Failed to add",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAddingId(null);
    }
  }

  // Process / upload / retry / delete
  async function callAction(jobId: string, action: "process" | "upload") {
    setActionBusy((s) => ({ ...s, [jobId]: true }));
    try {
      const r = await fetch("/api/repost-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      if (!r.ok) throw new Error("Action failed");
      const j = await r.json();
      toast({
        title: action === "process" ? "Processing started" : "Upload started",
        description: action === "upload" ? `Posted to: ${Object.keys(j.results ?? {}).join(", ") || "—"}` : undefined,
      });
      setTimeout(loadJobs, 800);
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionBusy((s) => ({ ...s, [jobId]: false }));
    }
  }

  async function retryJob(jobId: string) {
    setActionBusy((s) => ({ ...s, [jobId]: true }));
    try {
      await fetch(`/api/repost-jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending", progress: 0, errorMessage: null }),
      });
      await callAction(jobId, "process");
    } finally {
      setActionBusy((s) => ({ ...s, [jobId]: false }));
    }
  }

  async function deleteJob(jobId: string) {
    setActionBusy((s) => ({ ...s, [jobId]: true }));
    try {
      await fetch(`/api/repost-jobs/${jobId}`, { method: "DELETE" });
      toast({ title: "Job deleted" });
      await loadJobs();
    } finally {
      setActionBusy((s) => ({ ...s, [jobId]: false }));
    }
  }

  const creditPreviewText = creditFormat.replace("@creator", sampleCreator || "@creator");

  return (
    <div className="p-4 lg:p-6 max-w-[1500px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Repeat2 className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Repost Engine</h1>
          <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-emerald-950 font-mono font-bold gap-1">
            <Sparkles className="w-3 h-3" /> v10
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Auto-repost viral Shorts with built-in credit attribution</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Film} label="Total reposts" value={stats.total.toLocaleString()} color="text-emerald-400" />
        <StatTile icon={CheckCircle2} label="Posted" value={stats.posted.toLocaleString()} color="text-emerald-400" />
        <StatTile icon={Clock} label="In progress" value={stats.pending.toLocaleString()} color="text-amber-400" />
        <StatTile icon={TrendingUp} label="Views captured" value={fmt(stats.totalViews)} color="text-emerald-400" />
      </div>

      {/* Top row: settings + credit preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Auto-repost settings */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold">Auto-Repost Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch
                checked={settings.autoRepost}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, autoRepost: v }))}
                disabled={settingsLoading}
              />
            </div>
          </div>

          {settingsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Niche</Label>
                <Select value={settings.repostNiche} onValueChange={(v) => setSettings((s) => ({ ...s, repostNiche: v }))}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{NICHES.map((n) => <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min views</Label>
                <Input
                  type="number"
                  value={settings.repostMinViews}
                  onChange={(e) => setSettings((s) => ({ ...s, repostMinViews: parseInt(e.target.value || "0", 10) }))}
                  className="font-mono h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max per day</Label>
                <Input
                  type="number"
                  value={settings.repostMaxPerDay}
                  onChange={(e) => setSettings((s) => ({ ...s, repostMaxPerDay: parseInt(e.target.value || "0", 10) }))}
                  className="font-mono h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Interval (min)</Label>
                <Input
                  type="number"
                  value={settings.repostInterval}
                  onChange={(e) => setSettings((s) => ({ ...s, repostInterval: parseInt(e.target.value || "0", 10) }))}
                  className="font-mono h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label className="text-xs">Credit format</Label>
                <Input
                  value={settings.repostCreditFmt}
                  onChange={(e) => setSettings((s) => ({ ...s, repostCreditFmt: e.target.value }))}
                  placeholder="Credit: @creator"
                  className="h-9"
                />
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 gap-1.5"
                  onClick={saveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Credit overlay preview */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold">Credit Overlay Preview</h2>
          </div>

          <div className="flex justify-center mb-4">
            <div className="aspect-[9/16] max-w-[200px] w-full rounded-[2rem] border-8 border-card relative overflow-hidden bg-black shadow-2xl">
              {/* Background placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-black to-black" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-8 h-8 text-white/30" fill="currentColor" />
              </div>

              {/* Top mock UI */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-white/70 text-[10px]">
                <span className="font-mono">SHORTS</span>
                <span className="font-mono">0:32</span>
              </div>

              {/* Right action rail */}
              <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white/80">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Heart className="w-3 h-3" /></div>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Eye className="w-3 h-3" /></div>
              </div>

              {/* Credit pill */}
              <div className="absolute bottom-3 left-3 right-12">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm pl-1 pr-3 py-1 border border-white/10">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-[9px] font-bold text-emerald-950">
                    {(sampleCreator || "@u").replace("@", "").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-white text-[11px] font-medium leading-none truncate max-w-[120px]">
                    {creditPreviewText}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="credit-fmt" className="text-[11px] text-muted-foreground">Credit format</Label>
              <Input
                id="credit-fmt"
                value={creditFormat}
                onChange={(e) => setCreditFormat(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="creator-fmt" className="text-[11px] text-muted-foreground">Sample creator handle</Label>
              <Input
                id="creator-fmt"
                value={sampleCreator}
                onChange={(e) => setSampleCreator(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              <code className="text-emerald-300">@creator</code> is replaced with the actual handle when the overlay is burned in.
            </p>
          </div>
        </Card>
      </div>

      {/* Discover section */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              Discover Viral Shorts
            </h2>
            <p className="text-xs text-muted-foreground">Search for high-performing Shorts to repost with credit.</p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Niche</Label>
              <Select value={discoverNiche} onValueChange={setDiscoverNiche}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{NICHES.map((n) => <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Min views</Label>
              <Input
                type="number"
                value={discoverMinViews}
                onChange={(e) => setDiscoverMinViews(parseInt(e.target.value || "0", 10))}
                className="font-mono h-9 w-[140px]"
              />
            </div>
            <Button
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 gap-1.5 h-9"
              onClick={discover}
              disabled={discovering}
            >
              {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Discover
            </Button>
          </div>
        </div>

        {discovering ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-md" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No candidates yet. Click <span className="text-emerald-300 font-medium">Discover</span> to find viral Shorts.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {candidates.map((c) => (
              <motion.div
                key={c.sourceShortId}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="overflow-hidden border border-border hover:border-emerald-500/40 transition-colors group">
                  <div className="relative aspect-[9/16] bg-black overflow-hidden">
                    <img
                      src={c.thumbnail}
                      alt={c.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 16'%3E%3Crect width='9' height='16' fill='%23111820'/%3E%3C/svg%3E";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                    {/* Top stats */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                      <Badge variant="outline" className="bg-black/60 text-white border-white/20 text-[10px] gap-1">
                        <Eye className="w-2.5 h-2.5" /> {fmt(c.viewCount)}
                      </Badge>
                      <Badge variant="outline" className="bg-black/60 text-white border-white/20 text-[10px] gap-1">
                        <Heart className="w-2.5 h-2.5" /> {fmt(c.likeCount)}
                      </Badge>
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 space-y-1">
                      <p className="text-[10px] text-emerald-300 font-mono truncate">{c.creator}</p>
                      <p className="text-xs text-white font-medium line-clamp-2 leading-tight">{c.title}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <Button
                      size="sm"
                      className="w-full h-7 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[11px] gap-1"
                      onClick={() => addToQueue(c)}
                      disabled={addingId === c.sourceShortId}
                    >
                      {addingId === c.sourceShortId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Repeat2 className="w-3 h-3" />
                      )}
                      Repost with credit
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Queue */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Repeat2 className="w-4 h-4 text-emerald-400" />
              Repost Queue
            </h2>
            <p className="text-xs text-muted-foreground">Live · polls every 5 seconds</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
          </Badge>
        </div>

        {jobsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Queue is empty. Discover and add viral Shorts to begin reposting.
          </div>
        ) : (
          <ScrollArea className="max-h-[700px] pr-3">
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {jobs.map((job) => {
                  const meta = STATUS_META[job.status];
                  const posted = parsePlatforms(job.postedPlatforms);
                  return (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Card className="p-3 border border-border hover:border-emerald-500/30 transition-colors">
                        <div className="flex items-stretch gap-3">
                          {/* Thumbnail */}
                          <div className="relative w-14 sm:w-16 aspect-[9/16] rounded-md overflow-hidden bg-black shrink-0">
                            {job.thumbnail && (
                              <img src={job.thumbnail} alt={job.title ?? ""} className="w-full h-full object-cover" />
                            )}
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium line-clamp-1">{job.title ?? "Untitled"}</p>
                                <p className="text-[11px] text-muted-foreground truncate font-mono">
                                  {job.creator ?? "unknown"} · {fmt(job.viewCount)} views
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("shrink-0 text-[10px] gap-1", meta.pulse && "animate-pulse")}
                                style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}1a`, color: meta.color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                                {meta.label}
                              </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-2 flex items-center gap-2">
                              <Progress value={job.progress} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{job.progress}%</span>
                            </div>

                            {/* Bottom row: platforms + actions */}
                            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-3">
                                {/* Platform dots */}
                                <div className="flex items-center gap-1.5" title="Per-platform upload status">
                                  {PLATFORMS.map((p) => {
                                    const isPosted = posted.includes(p.id);
                                    return (
                                      <span
                                        key={p.id}
                                        title={p.label}
                                        className={cn(
                                          "w-2.5 h-2.5 rounded-full transition-colors",
                                          isPosted ? PLATFORM_DOT_COLOR[p.id] : "bg-muted-foreground/30"
                                        )}
                                      />
                                    );
                                  })}
                                </div>
                                {job.niche && (
                                  <Badge variant="secondary" className="text-[10px] capitalize h-5">{job.niche}</Badge>
                                )}
                                {job.errorMessage && (
                                  <span className="text-[10px] text-red-400 truncate max-w-[200px]" title={job.errorMessage}>
                                    {job.errorMessage}
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5">
                                {job.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                    onClick={() => callAction(job.id, "process")}
                                    disabled={actionBusy[job.id]}
                                  >
                                    {actionBusy[job.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                    Process Now
                                  </Button>
                                )}
                                {job.status === "ready" && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] gap-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
                                    onClick={() => callAction(job.id, "upload")}
                                    disabled={actionBusy[job.id]}
                                  >
                                    {actionBusy[job.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                                    Post Now
                                  </Button>
                                )}
                                {job.status === "failed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                                    onClick={() => retryJob(job.id)}
                                    disabled={actionBusy[job.id]}
                                  >
                                    <RotateCw className="w-3 h-3" /> Retry
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-red-300"
                                  onClick={() => deleteJob(job.id)}
                                  disabled={actionBusy[job.id]}
                                  title="Delete job"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </Card>

      <Separator />
      <p className="text-[11px] text-muted-foreground text-center pb-2">
        Repost Engine v10 — every credit pill is burned in via ffmpeg overlay filter for platform-agnostic attribution.
      </p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="p-4 border-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold font-mono">{value}</p>
    </Card>
  );
}
