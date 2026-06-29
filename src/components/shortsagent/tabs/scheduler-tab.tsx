"use client";

import * as React from "react";
import {
  Calendar,
  Plus,
  Play,
  Trash2,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  Activity,
  Cpu,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NICHES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ScheduleKind = "cron" | "fixed_rate" | "one_time";

interface Schedule {
  id: string;
  name: string;
  kind: string;
  expr: string;
  stages: string[];
  niche: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RunHistoryRow {
  id: string;
  scheduleId: string | null;
  scheduleName: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  stage: string | null;
  results: string | null;
  error: string | null;
}

interface AutopilotState {
  enabled: boolean;
  lastActivityAt: string | null;
  lastActivity: { action: string; detail: string | null } | null;
  nextScheduledRun: { id: string; name: string; nextRunAt: string } | null;
  todayStats: { videosProcessed: number; postsMade: number };
}

const STAGE_OPTIONS = [
  { id: "discover", label: "Discover", color: "#3b82f6" },
  { id: "generate", label: "Generate", color: "#f59e0b" },
  { id: "post", label: "Post", color: "#10b981" },
];

const KINDS: { id: ScheduleKind; label: string; hint: string }[] = [
  { id: "cron", label: "Cron", hint: "Standard 5-field cron expression" },
  { id: "fixed_rate", label: "Fixed rate", hint: "Runs every N minutes" },
  { id: "one_time", label: "One-time", hint: "Fires once at a specific date/time" },
];

export function SchedulerTab() {
  const { toast } = useToast();

  // Schedules state
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = React.useState(true);

  // Run history state
  const [history, setHistory] = React.useState<RunHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyTotalPages, setHistoryTotalPages] = React.useState(1);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  // Autopilot state
  const [autopilot, setAutopilot] = React.useState<AutopilotState | null>(null);
  const [loadingAutopilot, setLoadingAutopilot] = React.useState(true);
  const [togglingAutopilot, setTogglingAutopilot] = React.useState(false);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formKind, setFormKind] = React.useState<ScheduleKind>("cron");
  const [formExprCron, setFormExprCron] = React.useState("0 9 * * *");
  const [formExprFixed, setFormExprFixed] = React.useState("60");
  const [formExprOneTime, setFormExprOneTime] = React.useState("");
  const [formStages, setFormStages] = React.useState<string[]>(["discover", "generate", "post"]);
  const [formNiche, setFormNiche] = React.useState<string>("none");
  const [formTimezone, setFormTimezone] = React.useState("America/Los_Angeles");
  const [formEnabled, setFormEnabled] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

  const fetchSchedules = React.useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const r = await fetch("/api/schedule");
      if (!r.ok) throw new Error("fetch failed");
      const j = await r.json();
      setSchedules((j.schedules ?? []) as Schedule[]);
    } catch {
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  const fetchHistory = React.useCallback(async (page: number) => {
    setLoadingHistory(true);
    try {
      const r = await fetch(`/api/run-history?page=${page}&pageSize=10`);
      if (!r.ok) throw new Error("fetch failed");
      const j = await r.json();
      setHistory((j.items ?? []) as RunHistoryRow[]);
      setHistoryPage(j.page ?? 1);
      setHistoryTotalPages(j.totalPages ?? 1);
      setHistoryTotal(j.total ?? 0);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchAutopilot = React.useCallback(async () => {
    setLoadingAutopilot(true);
    try {
      const r = await fetch("/api/autopilot");
      if (!r.ok) throw new Error("fetch failed");
      const j = await r.json();
      setAutopilot(j as AutopilotState);
    } catch {
      setAutopilot(null);
    } finally {
      setLoadingAutopilot(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSchedules();
    fetchHistory(1);
    fetchAutopilot();
  }, [fetchSchedules, fetchHistory, fetchAutopilot]);

  // Toggle autopilot
  const toggleAutopilot = React.useCallback(
    async (next: boolean) => {
      setTogglingAutopilot(true);
      try {
        const r = await fetch("/api/autopilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        if (!r.ok) throw new Error("toggle failed");
        toast({
          title: next ? "Auto-pilot enabled" : "Auto-pilot disabled",
          description: next
            ? "All enabled schedules are now active."
            : "Scheduled jobs will not fire until you resume.",
        });
        await fetchAutopilot();
      } catch {
        toast({ title: "Failed to toggle auto-pilot" });
      } finally {
        setTogglingAutopilot(false);
      }
    },
    [fetchAutopilot, toast]
  );

  // Toggle a schedule's enabled flag
  const toggleScheduleEnabled = React.useCallback(
    async (id: string, enabled: boolean) => {
      // Optimistic update
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled } : s))
      );
      try {
        const r = await fetch("/api/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, enabled }),
        });
        if (!r.ok) throw new Error("patch failed");
      } catch {
        // Revert
        setSchedules((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
        );
        toast({ title: "Failed to update schedule" });
      }
    },
    [toast]
  );

  // Run a schedule now
  const runScheduleNow = React.useCallback(
    async (id: string, name: string) => {
      toast({
        title: `Triggering "${name}"`,
        description: "Run started — refreshing history when complete.",
      });
      try {
        const r = await fetch("/api/schedule-shorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: id }),
        });
        if (!r.ok) throw new Error("run failed");
        const j = await r.json();
        toast({
          title: `Run complete: ${name}`,
          description: j.results
            ? `Results: ${Object.entries(j.results as Record<string, Record<string, number>>)
                .map(([k, v]) => `${k} (${Object.entries(v).map(([k2, v2]) => `${k2}=${v2}`).join(", ")})`)
                .join(" · ")}`
            : "Finished.",
        });
        await Promise.all([fetchSchedules(), fetchHistory(1), fetchAutopilot()]);
      } catch {
        toast({ title: `Run failed for "${name}"` });
      }
    },
    [fetchSchedules, fetchHistory, fetchAutopilot, toast]
  );

  // Delete a schedule
  const deleteSchedule = React.useCallback(
    async (id: string, name: string) => {
      try {
        const r = await fetch(`/api/schedule/${id}`, { method: "DELETE" });
        if (!r.ok) throw new Error("delete failed");
        toast({ title: `Deleted "${name}"` });
        await fetchSchedules();
      } catch {
        toast({ title: `Failed to delete "${name}"` });
      }
    },
    [fetchSchedules, toast]
  );

  // Create a new schedule
  const handleCreate = React.useCallback(async () => {
    setCreating(true);
    try {
      let expr: string;
      if (formKind === "cron") {
        expr = formExprCron.trim() || "0 9 * * *";
      } else if (formKind === "fixed_rate") {
        expr = formExprFixed.trim() || "60";
      } else {
        // one_time — convert datetime-local to epoch millis
        if (!formExprOneTime) {
          toast({ title: "Pick a date/time for the one-time run" });
          setCreating(false);
          return;
        }
        const ms = new Date(formExprOneTime).getTime();
        if (!Number.isFinite(ms)) {
          toast({ title: "Invalid date/time" });
          setCreating(false);
          return;
        }
        expr = String(ms);
      }

      const body = {
        name: formName.trim() || "Untitled Schedule",
        kind: formKind,
        expr,
        stages: formStages.length > 0 ? formStages : ["discover"],
        niche: formNiche === "none" ? null : formNiche,
        timezone: formTimezone.trim() || "America/Los_Angeles",
        enabled: formEnabled,
      };
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("create failed");
      toast({
        title: `Created "${body.name}"`,
        description: `Kind: ${body.kind} · Stages: ${body.stages.join(", ")}`,
      });
      // Reset form
      setFormName("");
      setFormKind("cron");
      setFormExprCron("0 9 * * *");
      setFormExprFixed("60");
      setFormExprOneTime("");
      setFormStages(["discover", "generate", "post"]);
      setFormNiche("none");
      setFormTimezone("America/Los_Angeles");
      setFormEnabled(true);
      await Promise.all([fetchSchedules(), fetchAutopilot()]);
    } catch {
      toast({ title: "Failed to create schedule" });
    } finally {
      setCreating(false);
    }
  }, [
    formKind,
    formExprCron,
    formExprFixed,
    formExprOneTime,
    formName,
    formStages,
    formNiche,
    formTimezone,
    formEnabled,
    fetchSchedules,
    fetchAutopilot,
    toast,
  ]);

  const toggleStage = (stage: string) => {
    setFormStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          Scheduler
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Auto-pilot scheduling — set it and forget it.
        </p>
      </div>

      {/* Auto-pilot card */}
      <Card
        className={cn(
          "bg-gradient-to-br from-emerald-500/10 via-emerald-700/5 to-transparent border-emerald-500/20",
          !autopilot?.enabled && "opacity-80"
        )}
      >
        <CardContent className="p-4 lg:p-6">
          {loadingAutopilot || !autopilot ? (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-center">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center border-2",
                      autopilot.enabled
                        ? "border-emerald-400 bg-emerald-500/15"
                        : "border-muted-foreground/30 bg-muted/40"
                    )}
                  >
                    <Zap
                      className={cn(
                        "w-6 h-6",
                        autopilot.enabled ? "text-emerald-400" : "text-muted-foreground"
                      )}
                      fill="currentColor"
                    />
                  </div>
                  {autopilot.enabled && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-card emerald-pulse" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                    Auto-pilot
                  </p>
                  <p className="text-lg font-semibold">
                    {autopilot.enabled ? "ON" : "OFF"}
                  </p>
                  <Button
                    size="sm"
                    variant={autopilot.enabled ? "outline" : "default"}
                    className="h-7 text-xs"
                    disabled={togglingAutopilot}
                    onClick={() => toggleAutopilot(!autopilot.enabled)}
                  >
                    {togglingAutopilot && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    {autopilot.enabled ? "Pause" : "Resume"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCell
                  label="Last activity"
                  value={
                    autopilot.lastActivityAt
                      ? formatDistanceToNow(parseISO(autopilot.lastActivityAt), {
                          addSuffix: true,
                        })
                      : "—"
                  }
                  sub={
                    autopilot.lastActivity?.detail
                      ? autopilot.lastActivity.detail
                      : undefined
                  }
                  icon={Activity}
                />
                <InfoCell
                  label="Next scheduled run"
                  value={
                    autopilot.nextScheduledRun
                      ? format(parseISO(autopilot.nextScheduledRun.nextRunAt), "MMM d, h:mm a")
                      : "—"
                  }
                  sub={
                    autopilot.nextScheduledRun
                      ? autopilot.nextScheduledRun.name
                      : undefined
                  }
                  icon={Clock}
                />
                <InfoCell
                  label="Videos processed today"
                  value={autopilot.todayStats.videosProcessed.toString()}
                  sub="discover + generate + post"
                  icon={Cpu}
                />
                <InfoCell
                  label="Posts today"
                  value={autopilot.todayStats.postsMade.toString()}
                  sub="successful uploads"
                  icon={CheckCircle2}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create schedule + Active schedules grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        {/* Create schedule panel */}
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Create schedule</CardTitle>
                <CardDescription className="text-xs">
                  Set up a recurring or one-time pipeline trigger
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-name" className="text-xs">
                Name
              </Label>
              <Input
                id="sched-name"
                placeholder="Daily Discovery"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Kind selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <div className="flex gap-1 p-1 rounded-md border border-border bg-background/50">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setFormKind(k.id)}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-xs rounded font-medium transition-colors",
                      formKind === k.id
                        ? "bg-emerald-500 text-emerald-950"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {KINDS.find((k) => k.id === formKind)?.hint}
              </p>
            </div>

            {/* Expression */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {formKind === "cron"
                  ? "Cron expression"
                  : formKind === "fixed_rate"
                    ? "Interval (minutes)"
                    : "Run at"}
              </Label>
              {formKind === "cron" && (
                <>
                  <Input
                    value={formExprCron}
                    onChange={(e) => setFormExprCron(e.target.value)}
                    placeholder="0 9 * * *"
                    className="h-9 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    e.g. <code className="font-mono text-emerald-300">0 9 * * *</code> = daily at 9am
                  </p>
                </>
              )}
              {formKind === "fixed_rate" && (
                <Input
                  type="number"
                  min={1}
                  value={formExprFixed}
                  onChange={(e) => setFormExprFixed(e.target.value)}
                  className="h-9 font-mono"
                />
              )}
              {formKind === "one_time" && (
                <Input
                  type="datetime-local"
                  value={formExprOneTime}
                  onChange={(e) => setFormExprOneTime(e.target.value)}
                  className="h-9"
                />
              )}
            </div>

            {/* Stages */}
            <div className="space-y-1.5">
              <Label className="text-xs">Stages</Label>
              <div className="grid grid-cols-3 gap-2">
                {STAGE_OPTIONS.map((s) => {
                  const checked = formStages.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-md border cursor-pointer transition-colors",
                        checked
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleStage(s.id)}
                        style={{ borderColor: checked ? s.color : undefined }}
                      />
                      <span className="text-xs font-medium">{s.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Niche + Timezone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Niche (optional)</Label>
                <Select value={formNiche} onValueChange={setFormNiche}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any niche</SelectItem>
                    {NICHES.map((n) => (
                      <SelectItem key={n} value={n} className="capitalize">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <Input
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  className="h-9 font-mono"
                />
              </div>
            </div>

            <Separator />

            {/* Enabled + Create */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formEnabled}
                  onCheckedChange={setFormEnabled}
                />
                <Label className="text-xs">Enabled on create</Label>
              </div>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating}
                className="h-8 gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active schedules list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Active schedules
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              {schedules.length} total
            </Badge>
          </div>

          {loadingSchedules ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <Card className="bg-card/40 border-dashed">
              <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Calendar className="w-6 h-6 opacity-40" />
                <p className="text-sm">No schedules yet. Create one on the left.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onToggleEnabled={(v) => toggleScheduleEnabled(s.id, v)}
                  onRunNow={() => runScheduleNow(s.id, s.name)}
                  onDelete={() => deleteSchedule(s.id, s.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run history */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <History className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Run history</CardTitle>
                <CardDescription className="text-xs">
                  Recent executions across all schedules
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => fetchHistory(historyPage)}
            >
              <Loader2 className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground text-sm">
              <History className="w-6 h-6 opacity-40" />
              <span>No runs yet. Trigger a schedule above to see history.</span>
            </div>
          ) : (
            <>
              <div className="max-h-[420px] overflow-y-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead>Results / Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">
                          {r.scheduleName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>
                          {r.stage ? (
                            <Badge variant="outline" className="text-[10px] capitalize py-0 h-4">
                              {r.stage}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(r.startedAt), "MMM d, h:mm:ss a")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {r.error ? (
                            <span className="text-xs text-red-400 font-mono">{r.error}</span>
                          ) : r.results ? (
                            <ResultsCell raw={r.results} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Page {historyPage} of {historyTotalPages} · {historyTotal} total runs
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={historyPage <= 1}
                    onClick={() => fetchHistory(historyPage - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => fetchHistory(historyPage + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCell({
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
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-emerald-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function ScheduleCard({
  schedule,
  onToggleEnabled,
  onRunNow,
  onDelete,
}: {
  schedule: Schedule;
  onToggleEnabled: (v: boolean) => void;
  onRunNow: () => void;
  onDelete: () => void;
}) {
  const kindBadgeColor: Record<string, string> = {
    cron: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    fixed_rate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    one_time: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  };

  const exprLabel =
    schedule.kind === "cron"
      ? schedule.expr
      : schedule.kind === "fixed_rate"
        ? `every ${schedule.expr} min`
        : (() => {
            const ms = Number(schedule.expr);
            if (Number.isFinite(ms) && ms > 0) {
              return format(new Date(ms), "MMM d, h:mm a");
            }
            return schedule.expr;
          })();

  return (
    <Card
      className={cn(
        "bg-card/70 backdrop-blur-sm transition-opacity",
        !schedule.enabled && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">{schedule.name}</h3>
              <Badge
                variant="outline"
                className={cn("text-[10px] font-mono py-0 h-4 capitalize", kindBadgeColor[schedule.kind])}
              >
                {schedule.kind}
              </Badge>
              {schedule.niche && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">
                  {schedule.niche}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-mono">
              <Clock className="w-3 h-3" />
              <span className="truncate">{exprLabel}</span>
              <span className="text-border">·</span>
              <span className="truncate">{schedule.timezone}</span>
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={schedule.enabled}
              onCheckedChange={onToggleEnabled}
            />
          </div>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Next run
            </p>
            {schedule.nextRunAt ? (
              <div className="flex flex-col">
                <span className="text-emerald-300 font-medium">
                  {formatDistanceToNow(parseISO(schedule.nextRunAt), { addSuffix: true })}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {format(parseISO(schedule.nextRunAt), "MMM d, yyyy h:mm a")}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Last run
            </p>
            {schedule.lastRunAt ? (
              <div className="flex flex-col">
                <span className="text-foreground/80 font-medium">
                  {formatDistanceToNow(parseISO(schedule.lastRunAt), { addSuffix: true })}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {format(parseISO(schedule.lastRunAt), "MMM d, yyyy h:mm a")}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </div>
        </div>

        {/* Stages */}
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mr-1">
            Stages:
          </span>
          {schedule.stages.length === 0 ? (
            <span className="text-xs text-muted-foreground">none</span>
          ) : (
            schedule.stages.map((s) => {
              const opt = STAGE_OPTIONS.find((o) => o.id === s);
              return (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-[10px] py-0 h-4 capitalize"
                  style={{
                    color: opt?.color,
                    borderColor: `${opt?.color}55`,
                  }}
                >
                  {opt?.label ?? s}
                </Badge>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5 text-xs bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            onClick={onRunNow}
          >
            <Play className="w-3 h-3" fill="currentColor" />
            Run now
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <Badge className="text-[10px] py-0 h-5 gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="text-[10px] py-0 h-5 gap-1 bg-red-500/20 text-red-300 border-red-500/30">
        <XCircle className="w-2.5 h-2.5" />
        Failed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge className="text-[10px] py-0 h-5 gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
        <Loader2 className="w-2.5 h-2.5 animate-spin emerald-pulse" />
        Running
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] py-0 h-5 capitalize">
      {status}
    </Badge>
  );
}

function ResultsCell({ raw }: { raw: string }) {
  let parsed: Record<string, Record<string, number>> | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return <span className="text-xs text-muted-foreground font-mono">{raw}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(parsed).map(([stage, metrics]) => (
        <Badge
          key={stage}
          variant="outline"
          className="text-[10px] py-0 h-4 capitalize gap-1"
        >
          {stage}:
          {Object.entries(metrics).map(([k, v]) => (
            <span key={k} className="font-mono">
              {" "}
              {k}={v}
            </span>
          ))}
        </Badge>
      ))}
    </div>
  );
}
