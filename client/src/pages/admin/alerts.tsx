import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Eye,
  RefreshCw,
  Pencil,
  RotateCcw,
  Megaphone,
  Code2,
  ShieldAlert,
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
  "Send to CV Report",
  "Bulk Mark Done",
  "Bulk Send to CV",
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

const NOTICE_TEMPLATES = [
  {
    id: "dev-update",
    label: "🛠 Dev Update",
    category: "dev",
    text: `🛠 *TrimRX Dev Update*\n\nA system update has been deployed successfully.\n\n📋 *Changes:*\n• [Describe what was updated]\n\n✅ Everything is running normally. No action needed.\n\n— Dev Team`,
  },
  {
    id: "dev-maintenance",
    label: "🔧 Maintenance Notice",
    category: "dev",
    text: `🔧 *Scheduled Maintenance Notice*\n\nWe will be performing scheduled maintenance:\n📅 Date: [DATE]\n⏰ Time: [START TIME] → [END TIME] (GT)\n\nSome features may be temporarily unavailable during this window.\n\nWe apologize for any inconvenience.\n\n— Dev Team`,
  },
  {
    id: "admin-urgent",
    label: "🚨 Urgent Notice",
    category: "admin",
    text: `🚨 *URGENT NOTICE — Action Required*\n\n📌 *Details:*\n[Describe the situation here]\n\n⚡ Please respond as soon as possible.\n📞 Contact: [Name / channel]\n\n— Admin`,
  },
  {
    id: "admin-announcement",
    label: "📢 Admin Announcement",
    category: "admin",
    text: `📢 *Team Announcement*\n\n[Write your announcement here]\n\n📅 Effective: [Date / Time if relevant]\n\nThank you for your attention.\n\n— Admin`,
  },
];

const GT_TZ = "America/Guatemala";

function getGuatemalaDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: GT_TZ });
}

function getGuatemalaTime(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: GT_TZ, hour: "2-digit", minute: "2-digit" });
}

function guatemalaToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00-06:00`).toISOString();
}

export default function AlertsPage() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState("60");
  const [filterUsers, setFilterUsers] = useState<string[]>([]);
  const [filterPages, setFilterPages] = useState<string[]>([]);
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [manualDate, setManualDate] = useState(getGuatemalaDate);
  const [manualFromTime, setManualFromTime] = useState("00:00");
  const [manualToTime, setManualToTime] = useState(getGuatemalaTime);
  const [initialized, setInitialized] = useState(false);

  // Notice sender state
  const [noticeTemplate, setNoticeTemplate] = useState("");
  const [noticeText, setNoticeText] = useState("");

  // Preview message state
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewLogCount, setPreviewLogCount] = useState<number>(0);
  const [editedMessage, setEditedMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const buildMessageMutation = useMutation({
    mutationFn: async () => {
      const fromISO = guatemalaToISO(manualDate, manualFromTime);
      const toISO = guatemalaToISO(manualDate, manualToTime);
      const res = await apiRequest("POST", "/api/audit-alerts/build-message", { fromTime: fromISO, toTime: toISO });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewMessage(data.message || "");
      setPreviewLogCount(data.logCount || 0);
      setEditedMessage(null);
      setIsEditing(false);
    },
    onError: (err: Error) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const fromISO = guatemalaToISO(manualDate, manualFromTime);
      const toISO = guatemalaToISO(manualDate, manualToTime);
      const payload: any = { fromTime: fromISO, toTime: toISO };
      const msgToSend = editedMessage !== null ? editedMessage : previewMessage;
      if (msgToSend !== null) payload.customMessage = msgToSend;
      const res = await apiRequest("POST", "/api/audit-alerts/send-now", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.sent) {
        toast({ title: data.logCount != null ? `Alert sent! (${data.logCount} actions reported)` : "Alert sent!" });
        queryClient.invalidateQueries({ queryKey: ["/api/audit-alerts/config"] });
      } else {
        toast({ title: data.message || "No logs to report", variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const sendNoticeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/audit-alerts/send-now", { customMessage: noticeText.trim() });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.sent) {
        toast({ title: "Notice sent to Telegram! ✅" });
      } else {
        toast({ title: data.message || "Failed to send", variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const resetPreview = () => {
    setPreviewMessage(null);
    setPreviewLogCount(0);
    setEditedMessage(null);
    setIsEditing(false);
  };

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
  const hasPreview = previewMessage !== null;
  const displayMessage = editedMessage !== null ? editedMessage : (previewMessage || "");

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
                Last alert sent: {new Date(config.lastSent).toLocaleString("en-US", { timeZone: "America/Guatemala", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} GT
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
            <CardDescription>Preview the report message, edit if needed, then send to Telegram</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Date
              </Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => { setManualDate(e.target.value); resetPreview(); }}
                data-testid="input-manual-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">From (GT)</Label>
                <Input
                  type="time"
                  value={manualFromTime}
                  onChange={(e) => { setManualFromTime(e.target.value); resetPreview(); }}
                  data-testid="input-manual-from-time"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">To (GT)</Label>
                <Input
                  type="time"
                  value={manualToTime}
                  onChange={(e) => { setManualToTime(e.target.value); resetPreview(); }}
                  data-testid="input-manual-to-time"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Times are in <span className="font-medium">Guatemala (CST, UTC−6)</span> timezone.
            </p>

            <Button
              variant="outline"
              onClick={() => buildMessageMutation.mutate()}
              disabled={buildMessageMutation.isPending}
              className="w-full"
              data-testid="button-preview-logs"
            >
              {buildMessageMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Building preview...</>
                : hasPreview
                  ? <><RefreshCw className="h-4 w-4 mr-1" />Refresh Preview</>
                  : <><Eye className="h-4 w-4 mr-1" />Preview Message</>
              }
            </Button>

            {hasPreview && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b gap-2">
                  <span className="text-xs font-medium">
                    {previewLogCount > 0
                      ? <>{previewLogCount} action{previewLogCount !== 1 ? "s" : ""} — <span className="text-muted-foreground">{manualDate} · {manualFromTime} → {manualToTime} GT</span></>
                      : <span className="text-muted-foreground">No actions in this period</span>
                    }
                  </span>
                  <div className="flex gap-1 shrink-0">
                    {editedMessage !== null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => { setEditedMessage(null); setIsEditing(false); }}
                        data-testid="button-reset-message"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => setIsEditing((v) => !v)}
                      data-testid="button-edit-message"
                    >
                      <Pencil className="h-3 w-3" />
                      {isEditing ? "Done" : "Edit"}
                    </Button>
                  </div>
                </div>

                {previewLogCount === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No actions found for this time range.</p>
                ) : isEditing ? (
                  <Textarea
                    className="font-mono text-[11px] leading-relaxed rounded-none border-0 focus-visible:ring-0 min-h-[220px] resize-y"
                    value={displayMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    data-testid="textarea-message-edit"
                  />
                ) : (
                  <div className="max-h-64 overflow-y-auto px-3 py-2">
                    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground">
                      {displayMessage}
                    </pre>
                  </div>
                )}

                {editedMessage !== null && (
                  <div className="px-3 py-1.5 border-t bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">✏️ Message has been edited — this edited version will be sent</p>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => sendNowMutation.mutate()}
              disabled={sendNowMutation.isPending || !isConnected || (hasPreview && previewLogCount === 0 && editedMessage === null)}
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
            <Megaphone className="h-4 w-4" />
            Send Notice to Telegram
          </CardTitle>
          <CardDescription>Send a manual notice to your Telegram group — choose a Dev or Admin template, edit, then send</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Template</Label>
            <Select
              value={noticeTemplate}
              onValueChange={(val) => {
                setNoticeTemplate(val);
                const tpl = NOTICE_TEMPLATES.find((t) => t.id === val);
                if (tpl) setNoticeText(tpl.text);
              }}
            >
              <SelectTrigger data-testid="select-notice-template">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Code2 className="h-3 w-3" /> Dev Templates
                </div>
                {NOTICE_TEMPLATES.filter((t) => t.category === "dev").map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
                <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-t">
                  <ShieldAlert className="h-3 w-3" /> Admin Templates
                </div>
                {NOTICE_TEMPLATES.filter((t) => t.category === "admin").map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {noticeText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Message</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    const tpl = NOTICE_TEMPLATES.find((t) => t.id === noticeTemplate);
                    if (tpl) setNoticeText(tpl.text);
                  }}
                  data-testid="button-reset-notice"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              <Textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                className="font-mono text-[12px] leading-relaxed min-h-[180px] resize-y"
                placeholder="Write your message here..."
                data-testid="textarea-notice-text"
              />
              <p className="text-[11px] text-muted-foreground">Supports Telegram markdown: *bold*, _italic_, `code`</p>
            </div>
          )}

          <Button
            onClick={() => sendNoticeMutation.mutate()}
            disabled={sendNoticeMutation.isPending || !isConnected || !noticeText.trim()}
            className="w-full"
            data-testid="button-send-notice"
          >
            {sendNoticeMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Sending...</>
              : <><Send className="h-4 w-4 mr-1.5" />Send Notice to Telegram</>
            }
          </Button>

          {!isConnected && (
            <p className="text-xs text-amber-600 text-center">Configure Telegram Bot Token and Chat ID first</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Alert Filters
          </CardTitle>
          <CardDescription>Choose which users, pages, and actions to include in <b>auto</b> alerts. Manual sends always show all actions.</CardDescription>
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
            Click badges to toggle filters. Selected (filled) badges mean only those items will be included in automatic scheduled alerts. Save settings after making changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
