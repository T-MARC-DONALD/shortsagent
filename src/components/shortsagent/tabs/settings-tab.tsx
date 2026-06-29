"use client";

import * as React from "react";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Loader2,
  CircleDot,
  Repeat2,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { NICHES, HOOK_TYPES, type HookType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SettingsForm {
  niche: string;
  channelName: string;
  postingSchedule: string;
  autoPost: boolean;
  minViews: number;
  maxDuration: number;
  clipsPerDay: number;
  titleStyle: HookType;
  language: string;
  // repost
  autoRepost: boolean;
  repostNiche: string;
  repostMinViews: number;
  repostCreditFmt: string;
  repostMaxPerDay: number;
  repostInterval: number;
}

const DEFAULTS: SettingsForm = {
  niche: "tech",
  channelName: "@ShortsAgent",
  postingSchedule: "0 9,12,18 * * *",
  autoPost: false,
  minViews: 50000,
  maxDuration: 900,
  clipsPerDay: 3,
  titleStyle: "curiosity",
  language: "en",
  autoRepost: false,
  repostNiche: "tech",
  repostMinViews: 100000,
  repostCreditFmt: "Credit: @creator",
  repostMaxPerDay: 5,
  repostInterval: 60,
};

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "pt", label: "Portuguese" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh", label: "Chinese" },
];

function isDirty(a: SettingsForm, b: SettingsForm): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function SettingsTab() {
  const { toast } = useToast();
  const [form, setForm] = React.useState<SettingsForm>(DEFAULTS);
  const [server, setServer] = React.useState<SettingsForm>(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/settings");
      if (!r.ok) return;
      const j = await r.json();
      // /api/settings returns either the settings object directly or { ok, settings }.
      const data = j?.settings ?? j;
      const merged: SettingsForm = { ...DEFAULTS, ...data };
      setForm(merged);
      setServer(merged);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const dirty = isDirty(form, server);

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Save failed");
      const j = await r.json();
      const data = j?.settings ?? j;
      const merged: SettingsForm = { ...DEFAULTS, ...data };
      setForm(merged);
      setServer(merged);
      toast({ title: "Settings saved", description: "Agent configuration updated." });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULTS),
      });
      if (!r.ok) throw new Error("Reset failed");
      const j = await r.json();
      const data = j?.settings ?? j;
      const merged: SettingsForm = { ...DEFAULTS, ...data };
      setForm(merged);
      setServer(merged);
      toast({ title: "Reset to defaults", description: "All settings restored." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          {dirty && (
            <Badge variant="outline" className="ml-2 border-amber-500/40 bg-amber-500/10 text-amber-300 gap-1">
              <CircleDot className="w-3 h-3" /> Unsaved changes
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Global agent configuration</p>
      </div>

      {/* General settings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold">General</h2>
            <p className="text-xs text-muted-foreground">Discovery, generation, and posting defaults</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label>Niche</Label>
              <Select value={form.niche} onValueChange={(v) => set("niche", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select niche" />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Channel name</Label>
              <Input value={form.channelName} onChange={(e) => set("channelName", e.target.value)} placeholder="@ShortsAgent" />
            </div>

            <div className="space-y-1.5">
              <Label>Posting schedule (cron)</Label>
              <Input
                value={form.postingSchedule}
                onChange={(e) => set("postingSchedule", e.target.value)}
                className="font-mono text-xs"
                placeholder="0 9,12,18 * * *"
              />
              <p className="text-[11px] text-muted-foreground">Standard 5-field cron expression.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Auto-post</Label>
              <div className="flex items-center justify-between gap-2 h-9 rounded-md border border-border px-3 bg-card/40">
                <span className="text-xs text-muted-foreground">Post generated Shorts automatically</span>
                <Switch checked={form.autoPost} onCheckedChange={(v) => set("autoPost", v)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Min views filter</Label>
              <Input
                type="number"
                value={form.minViews}
                onChange={(e) => set("minViews", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Skip source videos below this view count.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Max duration (seconds)</Label>
              <Input
                type="number"
                value={form.maxDuration}
                onChange={(e) => set("maxDuration", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">900s = 15 min</p>
            </div>

            <div className="space-y-1.5">
              <Label>Clips per day</Label>
              <Input
                type="number"
                value={form.clipsPerDay}
                onChange={(e) => set("clipsPerDay", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Title style</Label>
              <Select value={form.titleStyle} onValueChange={(v) => set("titleStyle", v as HookType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  {HOOK_TYPES.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => set("language", v)}>
                <SelectTrigger className="w-full md:w-[240px]">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {/* Repost settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Repeat2 className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="font-semibold">Repost Engine</h2>
            <p className="text-xs text-muted-foreground">Auto-repost viral Shorts with credit attribution</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Auto-repost</Label>
              <div className="flex items-center justify-between gap-2 h-9 rounded-md border border-border px-3 bg-card/40">
                <span className="text-xs text-muted-foreground">Enable automatic reposting of viral Shorts</span>
                <Switch checked={form.autoRepost} onCheckedChange={(v) => set("autoRepost", v)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Repost niche</Label>
              <Select value={form.repostNiche} onValueChange={(v) => set("repostNiche", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select niche" />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Min view threshold</Label>
              <Input
                type="number"
                value={form.repostMinViews}
                onChange={(e) => set("repostMinViews", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Credit format</Label>
              <Input
                value={form.repostCreditFmt}
                onChange={(e) => set("repostCreditFmt", e.target.value)}
                placeholder="Credit: @creator"
              />
              <p className="text-[11px] text-muted-foreground"><code className="text-emerald-300">@creator</code> will be replaced with actual creator handle.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Max reposts per day</Label>
              <Input
                type="number"
                value={form.repostMaxPerDay}
                onChange={(e) => set("repostMaxPerDay", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Repost interval (minutes)</Label>
              <Input
                type="number"
                value={form.repostInterval}
                onChange={(e) => set("repostInterval", parseInt(e.target.value || "0", 10))}
                className="font-mono"
              />
            </div>
          </div>
        )}
      </Card>

      <Separator />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 sticky bottom-0 lg:bottom-0 bg-background/80 backdrop-blur-md py-3 -mx-4 lg:-mx-6 px-4 lg:px-6 border-t border-border">
        <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
          {!loading && !dirty && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              All changes saved
            </>
          )}
          {!loading && dirty && (
            <>
              <CircleDot className="w-3.5 h-3.5 text-amber-400" />
              You have unsaved changes
            </>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={loading || saving}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore all settings to their default values. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={reset}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 disabled:opacity-50"
            onClick={save}
            disabled={loading || saving || !dirty}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
