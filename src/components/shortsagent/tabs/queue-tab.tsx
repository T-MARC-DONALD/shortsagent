"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Wand2,
  Play,
  Send,
  Trash2,
  Eye,
  Flame,
  Loader2,
  GitCompare,
  ListVideo,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HOOK_TYPES, type TabId, type HookType } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface VideoRow {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnail: string | null;
  duration: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  niche: string | null;
  viralScore: number;
  hookType: string | null;
  status: string;
  filePath: string | null;
  generatedTitle: string | null;
  shortClipCount: number;
  createdAt: string;
  updatedAt: string;
}

type FilterPill = "all" | "pending" | "ready" | "posted";

const STATUS_META: Record<
  string,
  { label: string; color: string; pulse?: boolean }
> = {
  discovered: { label: "Discovered", color: "#9ca3af" },
  generating: { label: "Generating", color: "#f59e0b", pulse: true },
  ready: { label: "Ready", color: "#10b981" },
  posting: { label: "Posting", color: "#3b82f6", pulse: true },
  posted: { label: "Posted", color: "#10b981" },
  failed: { label: "Failed", color: "#ef4444" },
};

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

export function QueueTab({ onNavigate }: { onNavigate?: (t: TabId) => void }) {
  const { toast } = useToast();
  const [videos, setVideos] = React.useState<VideoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<FilterPill>("all");
  const [selectedForCompare, setSelectedForCompare] = React.useState<string[]>(
    []
  );
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [previewVideo, setPreviewVideo] = React.useState<VideoRow | null>(null);

  const loadVideos = React.useCallback(async () => {
    try {
      const r = await fetch("/api/videos?limit=500");
      if (!r.ok) return;
      const j = await r.json();
      const list: VideoRow[] = j.videos ?? [];
      setVideos(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Poll every 4s while any video is generating or posting
  const hasActive = videos.some(
    (v) => v.status === "generating" || v.status === "posting"
  );
  React.useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(loadVideos, 4000);
    return () => clearInterval(id);
  }, [hasActive, loadVideos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = videos.findIndex((v) => v.id === active.id);
      const newIndex = videos.findIndex((v) => v.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(videos, oldIndex, newIndex);
      setVideos(reordered);
      // Best-effort persist (visual reorder is the primary contract)
      try {
        await fetch("/api/videos", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: reordered.map((v) => v.id) }),
        });
      } catch {
        // ignore — UI already updated
      }
    },
    [videos]
  );

  const counts = React.useMemo(() => {
    const c = { all: videos.length, pending: 0, ready: 0, posted: 0 };
    for (const v of videos) {
      if (v.status === "discovered" || v.status === "generating") c.pending++;
      else if (v.status === "ready" || v.status === "posting") c.ready++;
      else if (v.status === "posted") c.posted++;
    }
    return c;
  }, [videos]);

  const filtered = React.useMemo(() => {
    if (filter === "all") return videos;
    if (filter === "pending")
      return videos.filter(
        (v) => v.status === "discovered" || v.status === "generating"
      );
    if (filter === "ready")
      return videos.filter(
        (v) => v.status === "ready" || v.status === "posting"
      );
    if (filter === "posted")
      return videos.filter((v) => v.status === "posted");
    return videos;
  }, [videos, filter]);

  const generate = React.useCallback(
    async (v: VideoRow) => {
      try {
        const r = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            videoId: v.id,
            hookType: v.hookType ?? "curiosity",
            audioTrack: "trending",
            titleStyle: v.hookType ?? "curiosity",
          }),
        });
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        toast({ title: "Generation started", description: v.title });
        loadVideos();
      } catch (e) {
        toast({
          title: "Generation failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [toast, loadVideos]
  );

  const post = React.useCallback(
    async (v: VideoRow) => {
      try {
        const r = await fetch("/api/post", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ videoId: v.id }),
        });
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = await r.json();
        const okCount = (j.results ?? []).filter(
          (x: { ok: boolean }) => x.ok
        ).length;
        toast({
          title: `Posted to ${okCount} platform${okCount === 1 ? "" : "s"}`,
          description: v.generatedTitle ?? v.title,
        });
        loadVideos();
      } catch (e) {
        toast({
          title: "Post failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [toast, loadVideos]
  );

  const remove = React.useCallback(
    async (v: VideoRow) => {
      try {
        await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
        setVideos((prev) => prev.filter((x) => x.id !== v.id));
        setSelectedForCompare((prev) => prev.filter((id) => id !== v.id));
        toast({ title: "Removed from queue", description: v.title });
      } catch (e) {
        toast({
          title: "Delete failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const toggleCompare = React.useCallback((id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const compareA = videos.find((v) => v.id === selectedForCompare[0]);
  const compareB = videos.find((v) => v.id === selectedForCompare[1]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Production Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Drag to reorder. Statuses flow: discovered → generating → ready →
          posting → posted.
        </p>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "ready", label: "Ready" },
            { id: "posted", label: "Posted" },
          ] as { id: FilterPill; label: string }[]
        ).map((p) => {
          const isActive = filter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isActive
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {p.label}
              <Badge
                variant="secondary"
                className="text-[10px] py-0 px-1.5 h-4 min-w-4 justify-center"
              >
                {counts[p.id]}
              </Badge>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {selectedForCompare.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen(true)}
              disabled={selectedForCompare.length < 2}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare ({selectedForCompare.length}/2)
            </Button>
          )}
          {hasActive && (
            <Badge
              variant="outline"
              className="text-amber-400 border-amber-500/40"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Live polling
            </Badge>
          )}
        </div>
      </div>

      {/* Queue list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3 flex gap-3 items-center">
                <div className="w-6 h-6 bg-muted animate-pulse rounded" />
                <div className="w-24 h-12 bg-muted animate-pulse rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-1/3 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ListVideo className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">
                No videos in queue yet. Discover some viral content first.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Or adjust the filter above.
              </p>
            </div>
            {onNavigate && (
              <Button
                variant="outline"
                onClick={() => onNavigate("discover")}
                className="mt-2"
              >
                Go to Discover
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={filtered.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((v) => (
                  <SortableRow
                    key={v.id}
                    video={v}
                    selected={selectedForCompare.includes(v.id)}
                    onToggleCompare={() => toggleCompare(v.id)}
                    onGenerate={() => generate(v)}
                    onPreview={() => setPreviewVideo(v)}
                    onPost={() => post(v)}
                    onDelete={() => remove(v)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Comparison dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-emerald-400" />
              Video Comparison
            </DialogTitle>
            <DialogDescription>
              Side-by-side stats to pick the better candidate.
            </DialogDescription>
          </DialogHeader>
          {compareA && compareB ? (
            <CompareView a={compareA} b={compareB} />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select two videos via checkboxes to compare.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewVideo} onOpenChange={(o) => !o && setPreviewVideo(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Short Preview</DialogTitle>
            <DialogDescription>
              {previewVideo?.generatedTitle ?? previewVideo?.title}
            </DialogDescription>
          </DialogHeader>
          {previewVideo && (
            <div className="space-y-3">
              {previewVideo.filePath ? (
                <video
                  src={previewVideo.filePath}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full rounded-md bg-black"
                  style={{ maxHeight: "60vh" }}
                />
              ) : (
                <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                  {previewVideo.thumbnail && (
                    <img
                      src={previewVideo.thumbnail}
                      alt={previewVideo.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge className="absolute bottom-2 left-2 bg-black/70 text-white border-0">
                    {STATUS_META[previewVideo.status]?.label ?? previewVideo.status}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={
                  previewVideo.status === "posted" ? "border-emerald-500/40 text-emerald-400" :
                  previewVideo.status === "ready" ? "border-amber-500/40 text-amber-400" :
                  "text-muted-foreground"
                }>
                  {STATUS_META[previewVideo.status]?.label ?? previewVideo.status}
                </Badge>
                {previewVideo.filePath && (
                  <a href={previewVideo.filePath} download>
                    <Button size="sm" variant="outline">Download MP4</Button>
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-md bg-muted/40">
                  <p className="text-muted-foreground">Source views</p>
                  <p className="font-mono font-semibold">
                    {previewVideo.viewCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                  <p className="text-muted-foreground">Viral</p>
                  <p className="font-mono font-semibold text-emerald-400">
                    {previewVideo.viralScore}/100
                  </p>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                  <p className="text-muted-foreground">Hook</p>
                  <p className="font-mono font-semibold">
                    {previewVideo.hookType ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableRow({
  video,
  selected,
  onToggleCompare,
  onGenerate,
  onPreview,
  onPost,
  onDelete,
}: {
  video: VideoRow;
  selected: boolean;
  onToggleCompare: () => void;
  onGenerate: () => void;
  onPreview: () => void;
  onPost: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const sm = STATUS_META[video.status] ?? STATUS_META.discovered;
  const hm =
    HOOK_TYPES.find((h) => h.id === video.hookType) ?? HOOK_TYPES[1];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      ref={setNodeRef}
      style={style}
    >
      <Card
        className={`py-0 overflow-hidden ${
          isDragging ? "border-emerald-500/50 shadow-xl" : ""
        } ${selected ? "ring-1 ring-emerald-500/50" : ""}`}
      >
        <CardContent className="py-3 flex items-center gap-3">
          {/* Drag handle */}
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Compare checkbox */}
          <Checkbox checked={selected} onCheckedChange={onToggleCompare} />

          {/* Thumbnail */}
          <div className="relative w-24 h-14 rounded overflow-hidden bg-muted shrink-0">
            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            )}
            <Badge className="absolute bottom-0.5 right-0.5 bg-black/70 text-white border-0 font-mono text-[9px] px-1 py-0">
              {fmtDuration(video.duration)}
            </Badge>
          </div>

          {/* Title + meta */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-1 leading-snug">
              {video.generatedTitle ?? video.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {video.channelTitle ?? "Unknown channel"}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  sm.pulse ? "animate-pulse" : ""
                }`}
                style={{
                  color: sm.color,
                  backgroundColor: `${sm.color}1a`,
                }}
              >
                {sm.label}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1.5"
                style={{ color: hm.color, borderColor: `${hm.color}40` }}
              >
                {hm.label}
              </Badge>
              {video.niche && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">
                  {video.niche}
                </Badge>
              )}
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Eye className="w-2.5 h-2.5" />
                {fmtViews(video.viewCount)}
              </span>
            </div>
          </div>

          {/* Viral score mini-bar */}
          <div className="hidden md:flex flex-col items-end gap-1 w-24 shrink-0">
            <span className="text-[10px] font-mono text-emerald-400">
              {video.viralScore}/100
            </span>
            <Progress
              value={video.viralScore}
              className="h-1.5 bg-emerald-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {(video.status === "discovered" ||
              video.status === "failed") && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onGenerate}
                title="Generate"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              </Button>
            )}
            {(video.status === "ready" ||
              video.status === "posted") && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onPreview}
                title="Preview"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            {video.status === "ready" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onPost}
                title="Post"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              </Button>
            )}
            {video.status === "generating" && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 mx-1" />
            )}
            {video.status === "posting" && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 mx-1" />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CompareView({ a, b }: { a: VideoRow; b: VideoRow }) {
  const hmA = HOOK_TYPES.find((h) => h.id === a.hookType) ?? HOOK_TYPES[1];
  const hmB = HOOK_TYPES.find((h) => h.id === b.hookType) ?? HOOK_TYPES[1];

  const diff = a.viralScore - b.viralScore;
  const verdict =
    diff === 0
      ? "Both videos have identical viral scores."
      : `Video A has ${Math.abs(diff)}% ${
          diff > 0 ? "higher" : "lower"
        } viral score.`;

  const rows: {
    label: string;
    a: string | number;
    b: string | number;
    aBetter: boolean;
  }[] = [
    {
      label: "Viral score",
      a: a.viralScore,
      b: b.viralScore,
      aBetter: a.viralScore > b.viralScore,
    },
    {
      label: "Views",
      a: a.viewCount.toLocaleString(),
      b: b.viewCount.toLocaleString(),
      aBetter: a.viewCount > b.viewCount,
    },
    {
      label: "Likes",
      a: a.likeCount.toLocaleString(),
      b: b.likeCount.toLocaleString(),
      aBetter: a.likeCount > b.likeCount,
    },
    {
      label: "Comments",
      a: a.commentCount.toLocaleString(),
      b: b.commentCount.toLocaleString(),
      aBetter: a.commentCount > b.commentCount,
    },
    {
      label: "Duration",
      a: fmtDuration(a.duration),
      b: fmtDuration(b.duration),
      aBetter: a.duration > b.duration,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: a, hm: hmA, label: "A" },
          { v: b, hm: hmB, label: "B" },
        ].map(({ v, hm, label }) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px]">
                Video {label}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ color: hm.color, borderColor: `${hm.color}40` }}
              >
                {hm.label}
              </Badge>
            </div>
            <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
              {v.thumbnail && (
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <p className="text-xs font-medium line-clamp-2 leading-snug">
              {v.title}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {v.channelTitle ?? "Unknown channel"} ·{" "}
              <span className="capitalize">{v.niche ?? "general"}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2 font-medium">Metric</th>
              <th className="text-right p-2 font-medium">A</th>
              <th className="text-right p-2 font-medium">B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="p-2 text-muted-foreground">{r.label}</td>
                <td
                  className={`p-2 text-right font-mono ${
                    r.aBetter ? "text-emerald-400 font-semibold" : ""
                  }`}
                >
                  {r.a}
                </td>
                <td
                  className={`p-2 text-right font-mono ${
                    !r.aBetter ? "text-emerald-400 font-semibold" : ""
                  }`}
                >
                  {r.b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
        <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">{verdict}</p>
      </div>
    </div>
  );
}
