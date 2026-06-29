"use client";

import * as React from "react";
import {
  Youtube,
  Music2,
  Instagram,
  Twitter,
  Plus,
  Check,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Shield,
  ArrowRight,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SocialAccount {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
  followerCount: number;
  uploadCount: number;
  autoUpload: boolean;
  tokenExpiresAt: string | null;
  tokenStatus: string;
  connected: boolean;
}

interface OAuthConfig {
  platform: string;
  clientId: string | null;
  hasCredentials: boolean;
}

const PLATFORM_META: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  guideUrl: string;
  scopesHint: string;
}> = {
  youtube: {
    label: "YouTube",
    icon: Youtube,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    guideUrl: "https://console.cloud.google.com/apis/credentials",
    scopesHint: "youtube.upload, youtube.readonly, yt-analytics.readonly",
  },
  tiktok: {
    label: "TikTok",
    icon: Music2,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    guideUrl: "https://developers.tiktok.com/",
    scopesHint: "video.upload, user.info.basic",
  },
  instagram: {
    label: "Instagram",
    icon: Instagram,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    guideUrl: "https://developers.facebook.com/apps/",
    scopesHint: "instagram_content_publish, instagram_basic",
  },
  twitter: {
    label: "Twitter / X",
    icon: Twitter,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    guideUrl: "https://developer.twitter.com/en/portal/dashboard",
    scopesHint: "tweet.read, tweet.write, media.upload",
  },
};

export function ChannelsTab() {
  const { toast } = useToast();
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [configs, setConfigs] = React.useState<OAuthConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [credentialDialog, setCredentialDialog] = React.useState<string | null>(null);
  // Form state for credentials
  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [savingCreds, setSavingCreds] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, cfgRes] = await Promise.all([
        fetch("/api/social-accounts"),
        fetch("/api/oauth-config"),
      ]);
      const acctJson = await acctRes.json();
      const cfgJson = await cfgRes.json();
      setAccounts(Array.isArray(acctJson) ? acctJson : (acctJson.accounts ?? []));
      setConfigs(cfgJson.configs ?? []);
    } catch (e) {
      toast({
        title: "Failed to load channels",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Check URL for OAuth callback params
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_success")) {
      const platform = params.get("platform");
      toast({
        title: "Account connected!",
        description: `${platform ? platform[0].toUpperCase() + platform.slice(1) : "Account"} is now connected.`,
      });
      window.history.replaceState({}, "", "/");
      fetchData();
    }
    if (params.get("oauth_error")) {
      toast({
        title: "Connection failed",
        description: params.get("oauth_error") ?? "Unknown error",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/");
    }
  }, [toast, fetchData]);

  const getAccount = (platform: string) => accounts.find((a) => a.platform === platform);
  const getConfig = (platform: string) => configs.find((c) => c.platform === platform);

  const handleSaveCredentials = async () => {
    if (!credentialDialog) return;
    setSavingCreds(true);
    try {
      const r = await fetch("/api/oauth-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: credentialDialog,
          clientId,
          clientSecret,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast({ title: "Credentials saved", description: "You can now connect your account." });
      setCredentialDialog(null);
      setClientId("");
      setClientSecret("");
      fetchData();
    } catch (e) {
      toast({
        title: "Failed to save credentials",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleConnect = async (platform: string) => {
    const cfg = getConfig(platform);
    if (!cfg?.hasCredentials) {
      setCredentialDialog(platform);
      return;
    }
    // Only YouTube supports real OAuth in this build
    if (platform !== "youtube") {
      toast({
        title: "Coming soon",
        description: `${PLATFORM_META[platform].label} OAuth is not yet wired. YouTube is fully functional.`,
      });
      return;
    }
    try {
      const r = await fetch(`/api/oauth/connect?platform=${platform}`);
      const j = await r.json();
      if (!j.ok) {
        if (j.error?.includes("credentials")) {
          setCredentialDialog(platform);
          return;
        }
        throw new Error(j.error);
      }
      // Open Google consent screen in new window
      window.open(j.authUrl, "_blank", "noopener,noreferrer,width=600,height=700");
      toast({
        title: "Redirecting to Google...",
        description: "Complete the consent flow in the popup. This tab will refresh when done.",
      });
    } catch (e) {
      toast({
        title: "Connection failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await fetch("/api/social-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      toast({ title: "Disconnected", description: `${PLATFORM_META[platform].label} account removed.` });
      fetchData();
    } catch (e) {
      toast({
        title: "Failed to disconnect",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleToggleAutoUpload = async (platform: string, enabled: boolean) => {
    try {
      await fetch("/api/social-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, autoUpload: enabled }),
      });
      fetchData();
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRefreshToken = async (platform: string) => {
    try {
      const r = await fetch("/api/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast({ title: "Token refreshed", description: `${PLATFORM_META[platform].label} token is now valid.` });
      fetchData();
    } catch (e) {
      toast({
        title: "Refresh failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const getTokenCountdown = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms < 0) return "Expired";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `Expires in ${days}d ${hours}h`;
    if (hours > 0) return `Expires in ${hours}h`;
    const mins = Math.floor(ms / 60000);
    return `Expires in ${mins}m`;
  };

  const tokenStatusColor = (status: string) => {
    switch (status) {
      case "valid": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "warning": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "critical": return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "expired": return "text-red-400 bg-red-500/10 border-red-500/30";
      default: return "text-muted-foreground bg-muted/40 border-border";
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your real social accounts via OAuth 2.0. YouTube is fully functional — TikTok, Instagram, and Twitter are coming soon.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Onboarding banner if no accounts connected */}
      {accounts.filter((a) => a.connected).length === 0 && (
        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-300 mb-1">Get started — connect YouTube</h3>
              <p className="text-sm text-muted-foreground mb-3">
                To upload Shorts automatically, you need a Google Cloud project with OAuth 2.0 credentials.
                Click <strong>Connect</strong> on the YouTube card below, paste your Client ID and Secret, then authorize access.
              </p>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-300">
                  Open Google Cloud Console
                  <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Platform cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(PLATFORM_META).map(([platform, meta]) => {
          const account = getAccount(platform);
          const cfg = getConfig(platform);
          const connected = account?.connected;
          const Icon = meta.icon;

          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={cn("p-5 border-2 transition-colors", meta.borderColor, connected ? meta.bgColor : "")}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", meta.bgColor)}>
                      <Icon className={cn("w-5 h-5", meta.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{meta.label}</h3>
                      {connected ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 mt-0.5">
                          <Check className="w-3 h-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground mt-0.5">
                          Not connected
                        </Badge>
                      )}
                    </div>
                  </div>
                  {cfg?.hasCredentials && (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                      <Shield className="w-3 h-3 mr-1" /> Credentials set
                    </Badge>
                  )}
                </div>

                {connected && account ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {account.avatar && (
                        <img src={account.avatar} alt="" className="w-10 h-10 rounded-full" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{account.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{account.handle}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Followers</p>
                        <p className="font-semibold">{account.followerCount.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Uploads</p>
                        <p className="font-semibold">{account.uploadCount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[10px]", tokenStatusColor(account.tokenStatus))}>
                        {account.tokenStatus === "valid" && <Check className="w-3 h-3 mr-1" />}
                        {(account.tokenStatus === "warning" || account.tokenStatus === "critical") && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {account.tokenStatus === "expired" && <X className="w-3 h-3 mr-1" />}
                        {getTokenCountdown(account.tokenExpiresAt) ?? "No expiry"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleRefreshToken(platform)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                      </Button>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border p-2">
                      <div>
                        <Label htmlFor={`auto-${platform}`} className="text-xs font-medium cursor-pointer">
                          Auto-upload
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Post generated Shorts automatically</p>
                      </div>
                      <Switch
                        id={`auto-${platform}`}
                        checked={account.autoUpload}
                        onCheckedChange={(v) => handleToggleAutoUpload(platform, v)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setCredentialDialog(platform)}
                      >
                        Update credentials
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDisconnect(platform)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {platform === "youtube"
                        ? "Connect to upload Shorts and pull real analytics from your channel."
                        : "OAuth integration for this platform is coming soon."}
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => handleConnect(platform)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {cfg?.hasCredentials ? "Connect" : "Add credentials & connect"}
                    </Button>
                    <a
                      href={meta.guideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      Get {meta.label} credentials <ExternalLink className="inline w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Upload Pipeline visualization */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-400" />
          Upload Pipeline
        </h3>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {[
            { label: "Short Created", icon: "🎬" },
            { label: "Title & Tags", icon: "✏️" },
            { label: "Multi-Platform Upload", icon: "🚀" },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1 min-w-[120px]">
              <div className="flex-1 rounded-md border border-border bg-muted/40 p-3 text-center">
                <div className="text-2xl mb-1">{step.icon}</div>
                <p className="text-xs font-medium">{step.label}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          When you click "Post" in the Queue tab, your generated MP4 is uploaded via the YouTube Data API v3 resumable upload.
        </p>
      </Card>

      {/* Credentials Dialog */}
      <Dialog open={credentialDialog !== null} onOpenChange={(o) => !o && setCredentialDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {credentialDialog ? PLATFORM_META[credentialDialog]?.label : ""}</DialogTitle>
            <DialogDescription>
              Enter your OAuth 2.0 credentials. These are stored securely in the database and used only for server-side token exchange.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="client-id" className="text-sm font-medium">Client ID</Label>
              <Input
                id="client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx.apps.googleusercontent.com"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="client-secret" className="text-sm font-medium">Client Secret</Label>
              <Input
                id="client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                className="mt-1 font-mono text-xs"
              />
            </div>
            {credentialDialog && (
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <p className="font-medium mb-1">Required redirect URI:</p>
                <code className="text-emerald-400 break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/oauth/callback?platform=${credentialDialog}` : ""}
                </code>
                <p className="text-muted-foreground mt-2">
                  Add this exact URL to your {PLATFORM_META[credentialDialog]?.label} OAuth app's authorized redirect URIs.
                </p>
                <p className="text-muted-foreground mt-1">
                  Required scopes: <code className="text-emerald-400">{PLATFORM_META[credentialDialog]?.scopesHint}</code>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveCredentials} disabled={savingCreds || !clientId || !clientSecret}>
              {savingCreds ? "Saving..." : "Save & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
