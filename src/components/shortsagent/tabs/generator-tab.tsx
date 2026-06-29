"use client";

import * as React from "react";
import {
  Wand2,
  Play,
  Download,
  RefreshCw,
  Sparkles,
  Check,
  Loader2,
  Music,
  Film,
  Tags,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { HOOK_TYPES, AUDIO_TRACKS, type HookType } from "@/lib/constants";
import { motion } from "framer-motion";

interface Video {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnail: string | null;
  duration: number;
  viewCount: number;
  niche: string | null;
  viralScore: number;
  hookType: string | null;
  status: string;
  filePath: string | null;
  shortClipCount: number;
  generatedTitle: string | null;
  generatedTags: string | null;
  generatedDesc: string | null;
}

interface GenerateResponse {
  ok: boolean;
  filePath?: string;
  thumbnail?: string;
  segments: { start: number; end: number; reason: string; viralScore: number }[];
  titles: string[];
  tags: string[];
  overlay: { badge: string; title: string; subtitle: string; watermark: string };
  mode: string;
  durationSec: number;
  error?: string;
}

export function GeneratorTab() {
  const { toast } = useToast();
  const [videos, setVideos] = React.useState<Video[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [hookType, setHookType] = React.useState<HookType>("curiosity");
  const [audioTrack, setAudioTrack] = React.useState("wave");
  const [durationSec, setDurationSec] = React.useState(30);
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [progressStage, setProgressStage] = React.useState("");
  const [result, setResult] = React.useState<GenerateResponse | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [systemStatus, setSystemStatus] = React.useState<{ canGenerateVideos: boolean; ffmpeg?: { available: boolean; version?: string }; clipsDir?: { writable: boolean }; fonts?: { bold: boolean; regular: boolean } } | null>(null);
  const [installing, setInstalling] = React.useState(false);

  // Check system status (ffmpeg availability, etc.)
  React.useEffect(() => {
    fetch("/api/system-check")
      .then((r) => r.json())
      .then((j) => setSystemStatus(j))
      .catch(() => {});
  }, []);

  // Fetch discovered videos
  const fetchVideos = React.useCallback(async () => {
    try {
      const r = await fetch("/api/videos?status=discovered,generating,ready,posted&limit=50");
      const j = await r.json();
      const list = j.videos ?? j;
      setVideos(Array.isArray(list) ? list : []);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch {
      // ignore
    }
  }, [selectedId]);

  React.useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const selected = videos.find((v) => v.id === selectedId);

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setResult(null);
    setProgress(0);
    setProgressStage("Initializing...");

    // Simulate stage progress for UX
    const stages = [
      { pct: 15, label: "Analyzing source video..." },
      { pct: 30, label: "Identifying best clip segments..." },
      { pct: 50, label: "Rendering MP4 with ffmpeg (drawtext, overlays)..." },
      { pct: 75, label: "Generating hook-driven titles via LLM..." },
      { pct: 90, label: "Generating thumbnail..." },
      { pct: 100, label: "Done" },
    ];
    let stageIdx = 0;
    const interval = setInterval(() => {
      if (stageIdx < stages.length - 1) {
        stageIdx++;
        setProgress(stages[stageIdx].pct);
        setProgressStage(stages[stageIdx].label);
      }
    }, 1500);

    try {
      const r = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: selected.id,
          hookType,
          audioTrack,
          titleStyle: hookType,
          durationSec,
        }),
      });

      // Handle non-OK HTTP status (500, etc.) — try to parse JSON error, fall back to status text
      let j: GenerateResponse;
      try {
        j = await r.json();
      } catch {
        throw new Error(`Server returned ${r.status} ${r.statusText}. The server may not have ffmpeg installed. Check /api/system-check for details.`);
      }
      clearInterval(interval);
      setProgress(100);
      setProgressStage("Done");

      if (!j.ok) {
        throw new Error(j.error ?? "Generation failed");
      }

      setResult(j);
      toast({
        title: "Short generated!",
        description: `${j.durationSec}s MP4 created. ${j.titles.length} titles generated.`,
      });
      fetchVideos();
    } catch (e) {
      clearInterval(interval);
      setProgress(0);
      setProgressStage("");
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">AI Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate real MP4 Shorts using ffmpeg. Each clip is rendered with hook badges, text overlays, and audio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchVideos}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* System status warning */}
      {systemStatus && !systemStatus.canGenerateVideos && (
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-300 mb-1">Video generation unavailable on this server</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 mb-3">
                {!systemStatus.ffmpeg?.available && (
                  <li>• ffmpeg is not installed</li>
                )}
                {!systemStatus.fonts?.bold && !systemStatus.fonts?.regular && (
                  <li>• Font files are missing</li>
                )}
                {!systemStatus.clipsDir?.writable && (
                  <li>• The /public/clips directory is not writable</li>
                )}
              </ul>
              <Button
                size="sm"
                onClick={async () => {
                  setInstalling(true);
                  try {
                    const r = await fetch("/api/install-tools", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ force: true }),
                    });
                    const j = await r.json();
                    if (j.ok) {
                      toast({ title: "Tools installed!", description: "You can now generate videos." });
                      // Refresh system status
                      const sr = await fetch("/api/system-check");
                      const sj = await sr.json();
                      setSystemStatus(sj);
                    } else {
                      toast({
                        title: "Installation failed",
                        description: j.message ?? j.error ?? "Unknown error",
                        variant: "destructive",
                      });
                    }
                  } catch (e) {
                    toast({
                      title: "Installation failed",
                      description: e instanceof Error ? e.message : "Unknown error",
                      variant: "destructive",
                    });
                  } finally {
                    setInstalling(false);
                  }
                }}
                disabled={installing}
              >
                {installing ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Installing ffmpeg + fonts...</>
                ) : (
                  <><Download className="w-3.5 h-3.5 mr-2" /> Install ffmpeg + fonts automatically</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {videos.length === 0 ? (
        <Card className="p-12 text-center">
          <Wand2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No videos to generate from</h3>
          <p className="text-sm text-muted-foreground">
            Head to the <strong>Discover</strong> tab, search for viral videos in your niche, and add them to the queue first.
          </p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: video picker */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" /> Source Video
            </h3>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Select a video..." /></SelectTrigger>
              <SelectContent>
                {videos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="truncate">{v.title.slice(0, 50)}</span>
                    <span className="text-xs text-muted-foreground ml-2">· {v.status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selected && (
              <Card className="p-4">
                <img
                  src={selected.thumbnail ?? `https://i.ytimg.com/vi/${selected.youtubeId}/hqdefault.jpg`}
                  alt={selected.title}
                  className="w-full aspect-video object-cover rounded-md mb-3"
                />
                <h4 className="font-medium line-clamp-2 mb-1">{selected.title}</h4>
                <p className="text-xs text-muted-foreground mb-3">{selected.channelTitle}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-muted-foreground">Views</p>
                    <p className="font-semibold">{selected.viewCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-semibold">{formatTime(selected.duration)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-muted-foreground">Viral</p>
                    <p className="font-semibold text-emerald-400">{selected.viralScore}</p>
                  </div>
                </div>
                {selected.filePath && selected.status === "ready" && (
                  <div className="mt-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2">
                    <p className="text-xs text-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Already generated — preview below
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* Already-generated preview */}
            {selected?.filePath && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2 text-sm">Generated Short Preview</h4>
                <video
                  src={selected.filePath}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full rounded-md bg-black"
                  style={{ maxHeight: "400px" }}
                />
                {selected.generatedTitle && (
                  <p className="text-sm font-medium mt-2 line-clamp-2">{selected.generatedTitle}</p>
                )}
              </Card>
            )}
          </div>

          {/* Right: config */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Generation Config
            </h3>

            {/* Hook type */}
            <Card className="p-4">
              <Label className="text-sm font-medium mb-2 block">Hook Type</Label>
              <div className="flex flex-wrap gap-2">
                {HOOK_TYPES.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setHookType(h.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      hookType === h.id
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    style={hookType === h.id ? { backgroundColor: h.color } : {}}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {HOOK_TYPES.find((h) => h.id === hookType)?.desc}
              </p>
            </Card>

            {/* Duration + audio */}
            <Card className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">Duration (seconds)</Label>
                <Select value={String(durationSec)} onValueChange={(v) => setDurationSec(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 20, 30, 45, 60].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                  <Music className="w-3.5 h-3.5" /> Audio Track
                </Label>
                <Select value={audioTrack} onValueChange={setAudioTrack}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIO_TRACKS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} <span className="text-xs text-muted-foreground">· {t.category}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Generate button */}
            <Button
              className="w-full h-12 text-base"
              onClick={handleGenerate}
              disabled={generating || !selected}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Generate Short</>
              )}
            </Button>

            {/* Progress */}
            {generating && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{progressStage}</span>
                  <span className="text-xs text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </Card>
            )}

            {/* Result */}
            {result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-semibold text-emerald-300">Generation Complete</h4>
                    <Badge variant="outline" className="ml-auto text-[10px]">{result.mode}</Badge>
                  </div>

                  {/* Real video preview */}
                  <video
                    src={result.filePath}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full rounded-md bg-black mb-3"
                    style={{ maxHeight: "350px" }}
                  />

                  <div className="flex gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                      <Play className="w-3.5 h-3.5 mr-1" /> Full preview
                    </Button>
                    <a href={result.filePath} download>
                      <Button size="sm" variant="outline">
                        <Download className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    </a>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Tags className="w-3 h-3" /> Generated Titles
                    </p>
                    <ScrollArea className="h-24 rounded-md bg-muted/40 p-2">
                      <ul className="text-xs space-y-1">
                        {result.titles.map((t, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400">{i + 1}.</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Full preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Short Preview (9:16 vertical)</DialogTitle>
          </DialogHeader>
          {result?.filePath && (
            <video
              src={result.filePath}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full rounded-md bg-black"
              style={{ maxHeight: "70vh" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
