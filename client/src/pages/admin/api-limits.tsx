import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Zap, Database, Users, Activity, Wifi, WifiOff, RotateCcw, TrendingUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiStatsResponse {
  startedAt: number;
  uptime: number;
  slackApiCalls: number;
  slackApiCallsByType: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  total: number;
  queue: {
    active: number;
    pending: number;
    peak: number;
    maxConcurrent: number;
  };
  socketModeActive: boolean;
  perUser: {
    username: string;
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    slackCalls: number;
    lastSeen: number;
  }[];
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatLastSeen(ts: number) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

function HitRateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{rate}%</span>
    </div>
  );
}

export default function ApiLimitsPage() {
  const { toast } = useToast();

  const { data: stats, isLoading, dataUpdatedAt } = useQuery<ApiStatsResponse>({
    queryKey: ["/api/slack/api-stats"],
    queryFn: async () => {
      const res = await fetch("/api/slack/api-stats");
      if (!res.ok) throw new Error("Failed to fetch API stats");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const resetMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/slack/api-stats/reset", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/api-stats"] });
      toast({ title: "Stats reset", description: "All counters have been cleared" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = stats!;
  const queueBusy = s.queue.active > 0 || s.queue.pending > 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Usage & Limits</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Slack API quota, cache performance, and per-user request breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {dataUpdatedAt ? formatLastSeen(dataUpdatedAt) : "—"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/slack/api-stats"] })}
            data-testid="button-refresh-stats"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-stats"
          >
            {resetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
            Reset Stats
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-uptime">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3.5 w-3.5" /> Server Uptime
            </div>
            <div className="text-2xl font-bold">{formatUptime(s.uptime)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              since {new Date(s.startedAt).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-slack-calls">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="h-3.5 w-3.5" /> Slack API Calls
            </div>
            <div className="text-2xl font-bold">{s.slackApiCalls.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">actual calls to Slack</div>
          </CardContent>
        </Card>

        <Card data-testid="card-cache-rate">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Database className="h-3.5 w-3.5" /> Cache Hit Rate
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{s.hitRate}%</span>
              <span className="text-xs text-muted-foreground">({s.total} total)</span>
            </div>
            <div className="mt-1.5">
              <HitRateBar rate={s.hitRate} />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-queue">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Queue Status
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{s.queue.active}</span>
              <span className="text-xs text-muted-foreground">active</span>
              {s.queue.pending > 0 && (
                <Badge variant="secondary" className="text-xs">{s.queue.pending} waiting</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              peak {s.queue.peak} · max {s.queue.maxConcurrent} concurrent
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" /> Real-time Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center gap-2">
                {s.socketModeActive ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">Socket Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {s.socketModeActive ? "Receiving real-time events from Slack" : "Not connected — using polling only"}
                  </p>
                </div>
              </div>
              {s.socketModeActive ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
              )}
            </div>
            {!s.socketModeActive && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Socket Mode is off. Without it, reply caches expire every 30 min, causing more Slack API calls. Enable it in Integrations → Slack → Socket Mode.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" /> Cache Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Cache hits</span>
              <span className="font-medium text-green-600">{s.cacheHits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Cache misses (→ Slack API)</span>
              <span className="font-medium text-red-500">{s.cacheMisses.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">By API type</p>
              {Object.keys(s.slackApiCallsByType).length === 0 ? (
                <p className="text-xs text-muted-foreground">No API calls recorded yet</p>
              ) : (
                Object.entries(s.slackApiCallsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground capitalize">{type}</span>
                      <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Per-User Request Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {s.perUser.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No requests recorded yet — stats are tracked since last server start or reset.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 pr-4 font-medium">User</th>
                    <th className="text-right pb-2 pr-4 font-medium">Requests</th>
                    <th className="text-right pb-2 pr-4 font-medium">Cache Hits</th>
                    <th className="text-right pb-2 pr-4 font-medium">Cache Misses</th>
                    <th className="text-right pb-2 pr-4 font-medium">Slack Calls</th>
                    <th className="pb-2 pr-4 font-medium">Hit Rate</th>
                    <th className="text-right pb-2 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.perUser.map((u) => (
                    <tr key={u.username} className="hover:bg-muted/30" data-testid={`row-user-${u.username}`}>
                      <td className="py-2.5 pr-4 font-medium">{u.username}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{u.requests.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-green-600">{u.cacheHits.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-red-500">{u.cacheMisses.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {u.slackCalls > 0 ? (
                          <span className="text-orange-500 font-medium">{u.slackCalls.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <HitRateBar rate={u.hitRate} />
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground text-xs">{formatLastSeen(u.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {queueBusy && (
        <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Queue Active — {s.queue.active} running, {s.queue.pending} waiting
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Slack API calls are currently being processed. This page refreshes every 5 seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
