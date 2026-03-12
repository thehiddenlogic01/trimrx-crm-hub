import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bell,
  Send,
  Loader2,
  CheckCircle,
  Settings,
  Clock,
  Users,
  Filter,
  FlaskConical,
  Save,
} from "lucide-react";

interface AlertConfig {
  enabled: boolean;
  hasBotToken: boolean;
  telegramChatId: string;
  intervalMinutes: number;
  filterUsers: string[];
  filterPages: string[];
  filterActions: string[];
  lastSent: string | null;
}

const ALL_PAGES = [
  "Manage Slack Case",
  "Slack Backlog All",
  "CV Report",
  "Retention Final Submit",
  "Disputes Finder",
];

const ALL_ACTIONS = [
  "Reply Sent",
  "Mark as Done",
  "Unmark Done",
  "Delete Message",
  "CV Report Created",
  "CV Report Updated",
  "CV Report Deleted",
  "Push to Google Sheets",
];

const INTERVAL_OPTIONS = [
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every 1 hour" },
  { value: "120", label: "Every 2 hours" },
  { value: "240", label: "Every 4 hours" },
  { value: "480", label: "Every 8 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

const MANUAL_PERIOD_OPTIONS = [
  { value: "15", label: "Last 15 minutes" },
  { value: "30", label: "Last 30 minutes" },
  { value: "60", label: "Last 1 hour" },
  { value: "120", label: "Last 2 hours" },
  { value: "240", label: "Last 4 hours" },
  { value: "480", label: "Last 8 hours" },
  { value: "720", label: "Last 12 hours" },
  { value: "1440", label: "Last 24 hours" },
];

export default function AlertsPage() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState("60");
  const [filterUsers, setFilterUsers] = useState<string[]>([]);
  const [filterPages, setFilterPages] = useState<string[]>([]);
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [manualPeriod, setManualPeriod] = useState("60");
  const [initialized, setInitialized] = useState(false);

  const configQuery = useQuery<AlertConfig>({
    queryKey: ["/api/audit-alerts/config"],
  });

  const usersQuery = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (configQuery.data && !initialized) {
      setEnabled(configQuery.data.enabled);
      setChatId(configQuery.data.telegramChatId || "");
      setInterval(String(configQuery.data.intervalMinutes || 60));
      setFilterUsers(configQuery.data.filterUsers || []);
      setFilterPages(configQuery.data.filterPages || []);
      setFilterActions(configQuery.data.filterActions || []);
      setInitialized(true);
    }
  }, [configQuery.data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        enabled,
        telegramChatId: chatId.trim(),
        intervalMinutes: parseInt(interval),
        filterUsers,
        filterPages,
        filterActions,
      };
      if (botToken.trim()) payload.telegramBotToken = botToken.trim();
      await apiRequest("POST", "/api/audit-alerts/config", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audit-alerts/config"] });
      toast({ title: "Alert settings saved" });
      setBotToken("");
    },
    onError: (err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/audit-alerts/test", {});
      return res.json();
    },
    onSuccess: () => toast({ title: "Test message sent to Telegram!" }),
    onError: (err: Error) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/audit-alerts/send-now", { sinceMinutes: parseInt(manualPeriod) });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.sent) {
        toast({ title: `Alert sent! (${data.logCount} actions reported)` });
        queryClient.invalidateQueries({ queryKey: ["/api/audit-alerts/config"] });
      } else {
        toast({ title: data.message || "No logs to report", variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const togglePage = (page: string) => {
    setFilterPages((prev) => prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]);
  };

  const toggleAction = (action: string) => {
    setFilterActions((prev) => prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]);
  };

  const toggleUser = (username: string) => {
    setFilterUsers((prev) => prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]);
  };

  const config = configQuery.data;
  const isConnected = config?.hasBotToken && config?.telegramChatId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bell className="h-6 w-6" />
            Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send audit report alerts to your Telegram group automatically or manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700" data-testid="status-connected">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300" data-testid="status-not-connected">
              <Settings className="h-3 w-3 mr-1" />
              Not configured
            </Badge>
          )}
          {config?.enabled && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Clock className="h-3 w-3 mr-1" />
              Auto: {INTERVAL_OPTIONS.find((o) => o.value === String(config.intervalMinutes))?.label || `${config.intervalMinutes}m`}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Telegram Configuration
            </CardTitle>
            <CardDescription>Connect your Telegram bot to receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bot Token</Label>
              <Input
                type="password"
                placeholder={config?.hasBotToken ? "Token saved. Paste new to update..." : "Paste your Telegram Bot Token"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                data-testid="input-bot-token"
              />
              <p className="text-[11px] text-muted-foreground">
                Create a bot via @BotFather on Telegram and paste the token here.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Chat ID</Label>
              <Input
                placeholder="e.g. -1001234567890"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                data-testid="input-chat-id"
              />
              <p className="text-[11px] text-muted-foreground">
                Group chat ID (starts with -100). Add the bot to your group first.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Auto Alerts</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automatically send reports on a schedule</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-enabled"
              />
            </div>

            {enabled && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Send Interval</Label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger data-testid="select-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Settings
              </Button>
              <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !isConnected} data-testid="button-test">
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
                Test
              </Button>
            </div>

            {config?.lastSent && (
              <p className="text-xs text-muted-foreground">
                Last alert sent: {new Date(config.lastSent).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ET
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send Manually
            </CardTitle>
            <CardDescription>Send an audit alert right now for a selected time period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time Period</Label>
              <Select value={manualPeriod} onValueChange={setManualPeriod}>
                <SelectTrigger data-testid="select-manual-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => sendNowMutation.mutate()}
              disabled={sendNowMutation.isPending || !isConnected}
              className="w-full"
              data-testid="button-send-now"
            >
              {sendNowMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send Alert Now
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Alert Filters
          </CardTitle>
          <CardDescription>Choose which users, pages, and actions to include in alerts. Leave empty to include all.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Users
            </Label>
            <div className="flex flex-wrap gap-2">
              {(usersQuery.data || []).map((u: any) => (
                <Badge
                  key={u.id}
                  variant={filterUsers.includes(u.username) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleUser(u.username)}
                  data-testid={`filter-user-${u.username}`}
                >
                  {u.username}
                </Badge>
              ))}
              {filterUsers.length === 0 && (
                <span className="text-xs text-muted-foreground italic">All users included</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Pages
            </Label>
            <div className="flex flex-wrap gap-2">
              {ALL_PAGES.map((page) => (
                <Badge
                  key={page}
                  variant={filterPages.includes(page) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => togglePage(page)}
                  data-testid={`filter-page-${page.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {page}
                </Badge>
              ))}
              {filterPages.length === 0 && (
                <span className="text-xs text-muted-foreground italic">All pages included</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Actions
            </Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ACTIONS.map((action) => (
                <Badge
                  key={action}
                  variant={filterActions.includes(action) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleAction(action)}
                  data-testid={`filter-action-${action.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {action}
                </Badge>
              ))}
              {filterActions.length === 0 && (
                <span className="text-xs text-muted-foreground italic">All actions included</span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            Click badges to toggle filters. Selected (filled) badges mean only those items will be included. Save settings after making changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
