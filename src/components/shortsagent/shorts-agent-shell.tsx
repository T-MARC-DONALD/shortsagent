"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Wand2,
  ListVideo,
  TrendingUp,
  BarChart3,
  Calendar,
  Radio,
  Settings as SettingsIcon,
  Repeat2,
  Zap,
  Bell,
  Github,
  Activity,
} from "lucide-react";
import { TABS, type TabId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

import { DashboardTab } from "@/components/shortsagent/tabs/dashboard-tab";
import { DiscoverTab } from "@/components/shortsagent/tabs/discover-tab";
import { GeneratorTab } from "@/components/shortsagent/tabs/generator-tab";
import { QueueTab } from "@/components/shortsagent/tabs/queue-tab";
import { TrendsTab } from "@/components/shortsagent/tabs/trends-tab";
import { AnalyticsTab } from "@/components/shortsagent/tabs/analytics-tab";
import { SchedulerTab } from "@/components/shortsagent/tabs/scheduler-tab";
import { ChannelsTab } from "@/components/shortsagent/tabs/channels-tab";
import { SettingsTab } from "@/components/shortsagent/tabs/settings-tab";
import { RepostTab } from "@/components/shortsagent/tabs/repost-tab";

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  discover: Search,
  generator: Wand2,
  queue: ListVideo,
  trends: TrendingUp,
  analytics: BarChart3,
  scheduler: Calendar,
  channels: Radio,
  settings: SettingsIcon,
  repost: Repeat2,
};

export function ShortsAgentShell() {
  const [active, setActive] = React.useState<TabId>("dashboard");
  const [notifCount, setNotifCount] = React.useState(0);
  const [autopilot, setAutopilot] = React.useState(true);
  const { toast } = useToast();

  // Load active tab from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("shortsagent_tab") as TabId | null;
    if (saved && TABS.some((t) => t.id === saved)) setActive(saved);
  }, []);

  // Persist active tab
  React.useEffect(() => {
    localStorage.setItem("shortsagent_tab", active);
  }, [active]);

  // Keyboard shortcuts 1-9, R
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "combobox" ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === "R") {
        e.preventDefault();
        setActive("repost");
      } else if (key >= "1" && key <= "9") {
        const idx = parseInt(key, 10) - 1;
        if (TABS[idx]) {
          e.preventDefault();
          setActive(TABS[idx].id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch notification count
  const fetchNotifs = React.useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const j = await r.json();
      setNotifCount(Array.isArray(j) ? j.filter((n: { read: boolean }) => !n.read).length : 0);
    } catch {
      // ignore
    }
  }, []);
  React.useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  const activeTab = TABS.find((t) => t.id === active)!;
  const ActiveIcon = TAB_ICONS[active];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-xl">
        <div className="flex items-center h-14 px-4 lg:px-6 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="w-4 h-4 text-emerald-950" fill="currentColor" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-card emerald-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight">
                Shorts<span className="text-emerald-400">Agent</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                v10 · autonomous pipeline
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-4 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono">{activeTab.label}</span>
            <span className="text-border">·</span>
            <span className="text-foreground/70 line-clamp-1 max-w-[420px]">
              {activeTab.description}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 font-mono text-xs",
                autopilot && "border-emerald-500/40 text-emerald-400"
              )}
              onClick={() => {
                setAutopilot((v) => !v);
                toast({
                  title: autopilot ? "Auto-pilot paused" : "Auto-pilot resumed",
                  description: autopilot
                    ? "Scheduled jobs will not fire until you resume."
                    : "All enabled schedules are now active.",
                });
              }}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  autopilot ? "bg-emerald-400 emerald-pulse" : "bg-muted-foreground"
                )}
              />
              {autopilot ? "AUTO-PILOT ON" : "AUTO-PILOT OFF"}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative"
              onClick={() => {
                toast({
                  title: `${notifCount} unread notification${notifCount === 1 ? "" : "s"}`,
                  description: "Open the Dashboard to view your activity feed.",
                });
              }}
            >
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-emerald-950 text-[10px] font-bold flex items-center justify-center">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex"
            >
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Github className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-[244px] flex-col border-r border-border bg-card/30 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "group w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-emerald-400" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1 text-left font-medium">{tab.label}</span>
                  <kbd
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                      isActive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-border bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {tab.shortcut}
                  </kbd>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border">
            <div className="rounded-md bg-gradient-to-br from-emerald-500/10 to-emerald-700/5 border border-emerald-500/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Repeat2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">Repost Engine v10</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Auto-repost viral Shorts with built-in credit attribution. Press{" "}
                <kbd className="px-1 py-0.5 rounded border border-border bg-muted/40 text-[10px] font-mono">R</kbd>{" "}
                to open.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile tab bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
          <div className="flex items-center overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "flex-1 min-w-[64px] flex flex-col items-center gap-1 py-2 text-[10px] font-medium",
                    isActive ? "text-emerald-400" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate max-w-[60px]">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="min-h-[calc(100vh-3.5rem)]"
            >
              {active === "dashboard" && <DashboardTab onNavigate={setActive} />}
              {active === "discover" && <DiscoverTab />}
              {active === "generator" && <GeneratorTab />}
              {active === "queue" && <QueueTab />}
              {active === "trends" && <TrendsTab />}
              {active === "analytics" && <AnalyticsTab />}
              {active === "scheduler" && <SchedulerTab />}
              {active === "channels" && <ChannelsTab />}
              {active === "settings" && <SettingsTab />}
              {active === "repost" && <RepostTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
