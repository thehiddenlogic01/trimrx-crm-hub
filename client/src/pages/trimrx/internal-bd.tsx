import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2,
  RefreshCw,
  Send,
  CheckSquare,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Calendar,
  X,
  CornerDownRight,
  XCircle,
  Trash2,
  FileText,
  Pencil,
  Hash,
  Volume2,
  VolumeX,
} from "lucide-react";

const WORKSPACE_ID = "T07H8FUDT96";
const CHANNEL_NAME = "trimrx-internal-bd";
const HARDCODED_CHANNEL_ID = "C0AJWEV8VMH";

interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
  reply_count: number;
  parent_text?: string;
  parent_user?: string;
  reactions: { name: string; count: number; users: string[] }[];
  files: { name: string; url: string; mimetype: string }[];
  attachments: { title: string; text: string; title_link: string; color: string; service_name: string }[];
}

interface SlackUser {
  name: string;
  real_name: string;
  avatar: string;
}

interface ThreadReply {
  ts: string;
  user: string;
  text: string;
  bot_id?: string | null;
  reactions: { name: string; count: number; users: string[] }[];
  files?: { name: string; url: string; mimetype: string }[];
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

function formatTs(ts: string) {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString("en-US", { timeZone: "America/Guatemala" });
}

function hasCheckmark(reactions: { name: string }[]) {
  return reactions.some((r) => r.name === "white_check_mark");
}

const SLACK_EMOJI: Record<string, string> = {
  white_check_mark: "\u2705",
  eyes: "\uD83D\uDC40",
  thumbsup: "\uD83D\uDC4D",
  "+1": "\uD83D\uDC4D",
  thumbsdown: "\uD83D\uDC4E",
  "-1": "\uD83D\uDC4E",
  heart: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
  tada: "\uD83C\uDF89",
  pray: "\uD83D\uDE4F",
  raised_hands: "\uD83D\uDE4C",
  clap: "\uD83D\uDC4F",
  wave: "\uD83D\uDC4B",
  rocket: "\uD83D\uDE80",
  star: "\u2B50",
  warning: "\u26A0\uFE0F",
  x: "\u274C",
  heavy_check_mark: "\u2714\uFE0F",
  question: "\u2753",
  exclamation: "\u2757",
  point_right: "\uD83D\uDC49",
  point_left: "\uD83D\uDC48",
  rotating_light: "\uD83D\uDEA8",
  memo: "\uD83D\uDCDD",
  small_orange_diamond: "\uD83D\uDD38",
  small_blue_diamond: "\uD83D\uDD39",
  large_orange_diamond: "\uD83D\uDD36",
  large_blue_diamond: "\uD83D\uDD37",
  thinking_face: "\uD83E\uDD14",
  muscle: "\uD83D\uDCAA",
  100: "\uD83D\uDCAF",
  speech_balloon: "\uD83D\uDCAC",
  bulb: "\uD83D\uDCA1",
  smile: "\uD83D\uDE04",
  slightly_smiling_face: "\uD83D\uDE42",
  sob: "\uD83D\uDE2D",
  cry: "\uD83D\uDE22",
  angry: "\uD83D\uDE20",
  ok_hand: "\uD83D\uDC4C",
  handshake: "\uD83E\uDD1D",
  check: "\u2705",
  no_entry: "\u26D4",
  bell: "\uD83D\uDD14",
  email: "\uD83D\uDCE7",
  phone: "\u260E\uFE0F",
  calendar: "\uD83D\uDCC5",
  link: "\uD83D\uDD17",
  pushpin: "\uD83D\uDCCC",
  bookmark: "\uD83D\uDD16",
  lock: "\uD83D\uDD12",
  unlock: "\uD83D\uDD13",
};

function emojiFromName(name: string): string {
  return SLACK_EMOJI[name] || `:${name}:`;
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatSlackText(text: string, users?: Record<string, SlackUser>) {
  const links: { placeholder: string; html: string }[] = [];
  let i = 0;
  let safe = text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, (_m, url, label) => {
      const ph = `__LINK${i++}__`;
      links.push({ placeholder: ph, html: `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${escapeHtml(label)}</a>` });
      return ph;
    })
    .replace(/<(https?:\/\/[^>]+)>/g, (_m, url) => {
      const ph = `__LINK${i++}__`;
      links.push({ placeholder: ph, html: `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">${escapeHtml(url)}</a>` });
      return ph;
    })
    .replace(/<@([A-Za-z0-9]+)(?:\|[^>]*)?>/g, (_m, userId) => {
      const ph = `__LINK${i++}__`;
      const name = users?.[userId]?.real_name || users?.[userId]?.name || userId;
      links.push({ placeholder: ph, html: `<span class="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded font-medium">@${escapeHtml(name)}</span>` });
      return ph;
    })
    .replace(/@([A-Za-z][A-Za-z0-9 _.-]*[A-Za-z0-9])/g, (full, rawName) => {
      if (!users) return full;
      const nameLower = rawName.toLowerCase().trim();
      const matched = Object.values(users).find((u) => {
        const rn = (u.real_name || "").toLowerCase();
        const dn = (u.name || "").toLowerCase();
        return rn === nameLower || dn === nameLower || rn.startsWith(nameLower) || nameLower.startsWith(rn);
      });
      if (matched) {
        const ph = `__LINK${i++}__`;
        links.push({ placeholder: ph, html: `<span class="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded font-medium">@${escapeHtml(matched.real_name || matched.name)}</span>` });
        return ph;
      }
      const ph = `__LINK${i++}__`;
      links.push({ placeholder: ph, html: `<span class="bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1 rounded font-medium">@${escapeHtml(rawName)}</span>` });
      return ph;
    })
    .replace(/:([a-z0-9_+-]+):/g, (_m, name) => {
      const emoji = SLACK_EMOJI[name];
      if (emoji) return emoji;
      return `:${name}:`;
    });
  safe = escapeHtml(safe);
  for (const link of links) {
    safe = safe.replace(link.placeholder, link.html);
  }
  return safe.replace(/\n/g, "<br/>");
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export default function InternalBdPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [channelId, setChannelId] = useState(HARDCODED_CHANNEL_ID);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessageText, setNewMessageText] = useState("");
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("bd_sound_enabled") !== "false"; } catch { return true; }
  });
  const prevMsgCountRef = useRef<number | null>(null);
  const prevLatestTsRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  const { data: slackStatus } = useQuery<{ connected: boolean; team?: string }>({
    queryKey: ["/api/slack/status"],
  });

  const forceRefreshRef = useRef(false);

  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages, error: messagesError } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", channelId, "messages", dateFilter],
    queryFn: async () => {
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      let url: string;
      if (dateFilter) {
        url = `/api/slack/channels/${channelId}/messages?date=${dateFilter}${force ? "&force=1" : ""}`;
      } else {
        url = `/api/slack/channels/${channelId}/messages`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch messages");
      }
      return res.json();
    },
    enabled: slackStatus?.connected === true && !!channelId,
    refetchInterval: dateFilter ? false : 30000,
    retry: false,
  });

  useEffect(() => {
    try { localStorage.setItem("bd_sound_enabled", soundEnabled ? "true" : "false"); } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const latestTs = messages[messages.length - 1]?.ts;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevMsgCountRef.current = messages.length;
      prevLatestTsRef.current = latestTs;
      return;
    }
    if (
      soundEnabled &&
      prevLatestTsRef.current &&
      latestTs &&
      latestTs !== prevLatestTsRef.current &&
      messages.length >= (prevMsgCountRef.current || 0)
    ) {
      playNotificationSound();
      const newMsg = messages[messages.length - 1];
      if (newMsg) {
        const preview = newMsg.text.replace(/<[^>]+>/g, "").slice(0, 80);
        toast({ title: "New message", description: preview });
      }
    }
    prevMsgCountRef.current = messages.length;
    prevLatestTsRef.current = latestTs;
  }, [messages, soundEnabled]);

  const isBotNotInChannel = messagesError?.message?.includes("channel_not_found") || messagesError?.message?.includes("not_in_channel");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: loadingSearch } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", channelId, "search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${channelId}/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: slackStatus?.connected === true && !!channelId && debouncedSearch.length > 0,
  });

  const { data: users } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/users"],
    enabled: slackStatus?.connected === true,
  });

  const snapshotCache = () => {
    const cache = queryClient.getQueriesData<unknown>({ queryKey: ["/api/slack/channels", channelId] });
    return cache.map(([key, data]) => ({ key, data }));
  };
  const restoreCache = (snapshot: { key: any; data: unknown }[]) => {
    snapshot.forEach(({ key, data }) => queryClient.setQueryData(key, data));
  };

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text }: { threadTs: string; text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/reply`, { thread_ts: threadTs, text });
    },
    onMutate: ({ threadTs, text }) => {
      const snapshot = snapshotCache();
      const draftKey = Object.keys(replyText).find(k => replyText[k]?.trim()) || threadTs;
      const prevReplyText = replyText[draftKey] || "";
      setReplyText((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        next[threadTs] = "";
        return next;
      });
      setReplyingTo(null);
      const newReply: ThreadReply = { ts: String(Date.now() / 1000), user: "me", text, reactions: [] };
      queryClient.setQueriesData<ThreadReply[]>(
        { queryKey: ["/api/slack/channels", channelId, "replies", threadTs] },
        (old) => old ? [...old, newReply] : [newReply]
      );
      const updateCount = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === threadTs ? { ...m, reply_count: m.reply_count + 1 } : m);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", channelId] }, updateCount);
      return { snapshot, prevReplyText, draftKey };
    },
    onSuccess: () => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        restoreCache(context.snapshot);
        setReplyText((prev) => ({ ...prev, [context.draftKey]: context.prevReplyText }));
      }
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/react`, { timestamp, name: "white_check_mark" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotCache();
      const updateMessages = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.ts !== timestamp) return msg;
          const existing = msg.reactions.find((r) => r.name === "white_check_mark");
          if (existing) {
            return { ...msg, reactions: msg.reactions.map((r) => r.name === "white_check_mark" ? { ...r, count: r.count + 1, users: [...r.users, "me"] } : r) };
          }
          return { ...msg, reactions: [...msg.reactions, { name: "white_check_mark", count: 1, users: ["me"] }] };
        });
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", channelId] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark added" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to add reaction", description: err.message, variant: "destructive" });
    },
  });

  const unreactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/unreact`, { timestamp, name: "white_check_mark" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotCache();
      const updateMessages = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.ts !== timestamp) return msg;
          const existing = msg.reactions.find((r) => r.name === "white_check_mark");
          if (existing && existing.count <= 1) {
            return { ...msg, reactions: msg.reactions.filter((r) => r.name !== "white_check_mark") };
          }
          if (existing) {
            return { ...msg, reactions: msg.reactions.map((r) => r.name === "white_check_mark" ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== "me") } : r) };
          }
          return msg;
        });
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", channelId] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to remove checkmark", description: err.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("DELETE", `/api/slack/channels/${channelId}/messages/${timestamp}`);
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotCache();
      const removeMsg = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.filter((m) => m.ts !== timestamp);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", channelId] }, removeMsg);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to delete message", description: err.message, variant: "destructive" });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ timestamp, text }: { timestamp: string; text: string }) => {
      await apiRequest("PATCH", `/api/slack/channels/${channelId}/messages/${timestamp}`, { text });
    },
    onMutate: ({ timestamp, text }) => {
      const snapshot = snapshotCache();
      const updateMsg = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === timestamp ? { ...m, text } : m);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", channelId] }, updateMsg);
      return { snapshot };
    },
    onSuccess: () => {
      setEditingMsg(null);
      setEditText("");
      toast({ title: "Message updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to edit message", description: err.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/send`, { text });
    },
    onMutate: ({ text }) => {
      const snapshot = snapshotCache();
      const prevText = newMessageText;
      setNewMessageText("");
      const optimisticMsg: SlackMessage = {
        ts: String(Date.now() / 1000),
        user: "me",
        text,
        reply_count: 0,
        reactions: [],
        files: [],
        attachments: [],
      };
      queryClient.setQueriesData<SlackMessage[]>(
        { queryKey: ["/api/slack/channels", channelId] },
        (old) => old ? [...old, optimisticMsg] : [optimisticMsg]
      );
      return { snapshot, prevText };
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        restoreCache(context.snapshot);
        setNewMessageText(context.prevText);
      }
      toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
    },
  });

  const isSearchMode = debouncedSearch.length > 0;
  const baseMessages = isSearchMode ? (searchResults || []) : (messages || []);

  const filteredMessages = baseMessages.filter((msg) => {
    if (statusFilter !== "all") {
      const hasCheck = msg.reactions.some((r) => r.name === "white_check_mark");
      if (statusFilter === "done" && !hasCheck) return false;
      if (statusFilter === "pending" && hasCheck) return false;
    }
    return true;
  });

  function getUserName(userId: string) {
    if (!users || !users[userId]) return userId;
    return users[userId].real_name || users[userId].name;
  }

  useEffect(() => {
    if (filteredMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredMessages.length]);

  function getUserAvatar(userId: string) {
    if (!users || !users[userId]) return "";
    return users[userId].avatar;
  }

  if (!slackStatus?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Trimrx Internal (BD)</h2>
          <p className="text-sm text-muted-foreground mt-1">#{CHANNEL_NAME}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Slack is not connected. Please go to <strong>Admin &gt; API Keys</strong> and connect your Slack Bot Token first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Trimrx Internal (BD)</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            {CHANNEL_NAME}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-[220px] pr-8"
            data-testid="input-search-bd"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search-bd"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]" data-testid="select-status-bd">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-9 pr-8 h-9 w-[180px]"
            data-testid="input-date-bd"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-date-bd"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { forceRefreshRef.current = true; refetchMessages(); }}
          disabled={loadingMessages}
          data-testid="button-refresh-bd"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingMessages ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          variant={soundEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) playNotificationSound();
          }}
          data-testid="button-toggle-sound-bd"
          title={soundEnabled ? "Sound notifications ON" : "Sound notifications OFF"}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4 mr-1.5" /> : <VolumeX className="h-4 w-4 mr-1.5" />}
          {soundEnabled ? "Sound On" : "Sound Off"}
        </Button>
      </div>

      {isSearchMode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {loadingSearch ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</>
          ) : (
            <span data-testid="text-search-count-bd">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""} found for "{debouncedSearch}"
            </span>
          )}
        </div>
      )}

      {isBotNotInChannel ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <div className="text-center space-y-3 max-w-lg">
              <p className="text-sm font-medium">Bot is not in #{CHANNEL_NAME}</p>
              <p className="text-xs text-muted-foreground">To add the bot, follow these steps in Slack:</p>
              <div className="text-left bg-muted rounded-md px-4 py-3 space-y-2 text-xs">
                <p><strong>1.</strong> Open the #{CHANNEL_NAME} channel in Slack</p>
                <p><strong>2.</strong> Click the channel name at the top</p>
                <p><strong>3.</strong> Go to the <strong>Integrations</strong> tab</p>
                <p><strong>4.</strong> Click <strong>Add an App</strong></p>
                <p><strong>5.</strong> Search for <strong>Ethan - TrimRx</strong> (the bot) and add it</p>
              </div>
              <p className="text-xs text-muted-foreground">After adding the bot, click Refresh below.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => { forceRefreshRef.current = true; refetchMessages(); }}
              disabled={loadingMessages}
              data-testid="button-retry-after-invite-bd"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingMessages ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (loadingMessages && !messages) || (isSearchMode && loadingSearch) ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !isSearchMode && (!messages || messages.length === 0) ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              {dateFilter ? `No messages found for ${dateFilter}` : "No messages found"}
            </p>
          </CardContent>
        </Card>
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              {isSearchMode
                ? `No results found for "${debouncedSearch}"`
                : `No messages matching the selected filter (${messages?.length || 0} total)`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => (
            <BdMessageCard
              key={msg.ts}
              msg={msg}
              getUserName={getUserName}
              getUserAvatar={getUserAvatar}
              users={users}
              expandedThread={expandedThread}
              setExpandedThread={setExpandedThread}
              replyText={replyText}
              setReplyText={setReplyText}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyMutation={replyMutation}
              reactMutation={reactMutation}
              unreactMutation={unreactMutation}
              deleteMessageMutation={deleteMessageMutation}
              editMessageMutation={editMessageMutation}
              editingMsg={editingMsg}
              setEditingMsg={setEditingMsg}
              editText={editText}
              setEditText={setEditText}
              channelId={channelId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {can("internal-bd", "send-message") && channelId && !isBotNotInChannel && (
        <div className="flex gap-2 pt-2 border-t sticky bottom-0 bg-background pb-2">
          <Textarea
            placeholder="Type a message..."
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && newMessageText.trim()) {
                e.preventDefault();
                sendMessageMutation.mutate({ text: newMessageText.trim() });
              }
            }}
            rows={1}
            className="text-sm resize-none flex-1"
            data-testid="input-send-message-bd"
          />
          <Button
            onClick={() => sendMessageMutation.mutate({ text: newMessageText.trim() })}
            disabled={!newMessageText.trim() || sendMessageMutation.isPending}
            data-testid="button-send-message-bd"
          >
            {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

type BdReplyTemplate = { id: string; subject: string; text: string };

function BdReplyWithTemplates({
  msgTs,
  threadTs,
  replyText,
  setReplyText,
  replyMutation,
}: {
  msgTs: string;
  threadTs: string;
  replyText: Record<string, string>;
  setReplyText: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  replyMutation: any;
}) {
  const [templateOpen, setTemplateOpen] = useState(false);

  const { data: templates } = useQuery<BdReplyTemplate[]>({
    queryKey: ["/api/slack/reply-templates"],
  });

  const selectTemplate = (template: BdReplyTemplate) => {
    setReplyText((prev) => ({ ...prev, [msgTs]: template.text }));
    setTemplateOpen(false);
  };

  return (
    <div className="space-y-1 pt-1">
      <div className="flex gap-2">
        <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              data-testid={`bd-button-templates-${msgTs}`}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Templates
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            {!templates || templates.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No templates yet. Add them in Slack Settings.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                    data-testid={`bd-template-option-${t.id}`}
                  >
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.text}</p>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-2">
        <Textarea
          placeholder="Type your reply..."
          value={replyText[msgTs] || ""}
          onChange={(e) => setReplyText((prev) => ({ ...prev, [msgTs]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && (replyText[msgTs] || "").trim()) {
              e.preventDefault();
              replyMutation.mutate({ threadTs, text: (replyText[msgTs] || "").trim() });
            }
          }}
          rows={2}
          className="text-sm resize-none flex-1"
          data-testid={`bd-input-reply-${msgTs}`}
        />
        <Button
          size="sm"
          onClick={() => replyMutation.mutate({ threadTs, text: replyText[msgTs] || "" })}
          disabled={!replyText[msgTs]?.trim() || replyMutation.isPending}
          data-testid={`bd-button-send-reply-${msgTs}`}
        >
          {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function BdMessageCard({
  msg,
  getUserName,
  getUserAvatar,
  users,
  expandedThread,
  setExpandedThread,
  replyText,
  setReplyText,
  replyingTo,
  setReplyingTo,
  replyMutation,
  reactMutation,
  unreactMutation,
  deleteMessageMutation,
  editMessageMutation,
  editingMsg,
  setEditingMsg,
  editText,
  setEditText,
  channelId,
}: {
  msg: SlackMessage;
  getUserName: (id: string) => string;
  getUserAvatar: (id: string) => string;
  users?: Record<string, SlackUser>;
  expandedThread: string | null;
  setExpandedThread: (ts: string | null) => void;
  replyText: Record<string, string>;
  setReplyText: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  replyingTo: string | null;
  setReplyingTo: (ts: string | null) => void;
  replyMutation: any;
  reactMutation: any;
  unreactMutation: any;
  deleteMessageMutation: any;
  editMessageMutation: any;
  editingMsg: string | null;
  setEditingMsg: (ts: string | null) => void;
  editText: string;
  setEditText: (text: string) => void;
  channelId: string;
}) {
  const { can } = usePermissions();
  const threadTs = msg.thread_ts || msg.ts;
  const isExpanded = expandedThread === msg.ts;
  const isReplying = replyingTo === msg.ts;
  const checked = hasCheckmark(msg.reactions);
  const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${channelId}/p${msg.ts.replace(".", "")}`;

  const { data: threadReplies, isLoading: loadingReplies } = useQuery<ThreadReply[]>({
    queryKey: ["/api/slack/channels", channelId, "replies", msg.ts],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${channelId}/replies/${msg.ts}`);
      if (!res.ok) throw new Error("Failed to fetch replies");
      return res.json();
    },
    enabled: isExpanded && msg.reply_count > 0,
  });

  const isReply = msg.thread_ts && msg.thread_ts !== msg.ts;
  const parentPreview = msg.parent_text
    ? msg.parent_text.replace(/<@[A-Z0-9]+>/g, "").replace(/<[^>]+>/g, "").replace(/\*/g, "").trim().slice(0, 120)
    : "";

  return (
    <Card className={`${checked ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" : ""}`} data-testid={`bd-msg-${msg.ts}`}>
      <CardContent className="p-4 space-y-3">
        {isReply && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-xs" data-testid={`bd-reply-indicator-${msg.ts}`}>
            <CornerDownRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-medium text-blue-600 dark:text-blue-400">Replying to {msg.parent_user ? getUserName(msg.parent_user) : "a message"}</span>
              {parentPreview && <p className="text-muted-foreground mt-0.5 line-clamp-2">{parentPreview}</p>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          {getUserAvatar(msg.user) ? (
            <img src={getUserAvatar(msg.user)} alt="" className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
              {getUserName(msg.user).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" data-testid={`bd-text-user-${msg.ts}`}>{getUserName(msg.user)}</span>
              <span className="text-xs text-muted-foreground">{formatTs(msg.ts)}</span>
              {isReply && <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"><CornerDownRight className="h-3 w-3" /> Reply</Badge>}
              {checked && <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"><CheckSquare className="h-3 w-3" /> Done</Badge>}
            </div>
            {editingMsg === msg.ts ? (
              <div className="mt-1 space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="text-sm min-h-[60px]"
                  data-testid={`bd-input-edit-${msg.ts}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && editText.trim()) {
                      e.preventDefault();
                      editMessageMutation.mutate({ timestamp: msg.ts, text: editText.trim() });
                    }
                    if (e.key === "Escape") { setEditingMsg(null); setEditText(""); }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => editMessageMutation.mutate({ timestamp: msg.ts, text: editText.trim() })}
                    disabled={!editText.trim() || editMessageMutation.isPending}
                    data-testid={`bd-button-save-edit-${msg.ts}`}
                  >
                    {editMessageMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingMsg(null); setEditText(""); }}
                    data-testid={`bd-button-cancel-edit-${msg.ts}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm mt-1 break-words"
                dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, users) }}
                data-testid={`bd-text-msg-${msg.ts}`}
              />
            )}
            {msg.files && msg.files.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.files.map((f, i) => {
                  const proxyUrl = f.url ? `/api/slack/file-proxy?url=${encodeURIComponent(f.url)}` : "";
                  return (<div key={i} className="text-xs">
                    {f.mimetype?.startsWith("image/") && proxyUrl ? (
                      <div className="mt-1">
                        <img src={proxyUrl} alt={f.name} className="max-w-sm max-h-64 rounded border" />
                        <p className="text-muted-foreground mt-0.5">{f.name}</p>
                      </div>
                    ) : proxyUrl ? (
                      <a href={proxyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{f.name}</a>
                    ) : (
                      <span className="text-muted-foreground">{f.name}</span>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
            {msg.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.attachments.map((att, i) => (
                  <div key={i} className="border-l-4 pl-3 py-1 text-xs text-muted-foreground" style={{ borderColor: att.color ? `#${att.color}` : undefined }}>
                    {att.title && <p className="font-medium">{att.title}</p>}
                    {att.text && <p>{att.text}</p>}
                    {att.service_name && <p className="text-xs opacity-60">{att.service_name}</p>}
                  </div>
                ))}
              </div>
            )}
            {msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {msg.reactions.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    <span className="text-sm">{emojiFromName(r.name)}</span>
                    <span className="font-medium">{r.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t">
          {can("internal-bd", "mark-done") && (
            !checked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactMutation.mutate({ timestamp: msg.ts })}
                disabled={reactMutation.isPending}
                data-testid={`bd-button-check-${msg.ts}`}
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                Mark Done
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unreactMutation.mutate({ timestamp: msg.ts })}
                disabled={unreactMutation.isPending}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                data-testid={`bd-button-uncheck-${msg.ts}`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            )
          )}
          {can("internal-bd", "reply") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyingTo(isReplying ? null : msg.ts)}
              data-testid={`bd-button-reply-${msg.ts}`}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
          )}
          {can("internal-bd", "edit-message") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingMsg(msg.ts); setEditText(msg.text); }}
              data-testid={`bd-button-edit-${msg.ts}`}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {can("internal-bd", "delete-message") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (confirm("Delete this message?")) deleteMessageMutation.mutate({ timestamp: msg.ts }); }}
              disabled={deleteMessageMutation.isPending}
              className="text-red-600 border-red-300 hover:bg-red-50"
              data-testid={`bd-button-delete-${msg.ts}`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
          {msg.reply_count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedThread(isExpanded ? null : msg.ts)}
              data-testid={`bd-button-thread-${msg.ts}`}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )}
          <a
            href={slackLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            data-testid={`bd-link-slack-${msg.ts}`}
          >
            Open in Slack <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {isReplying && (
          <BdReplyWithTemplates
            msgTs={msg.ts}
            threadTs={threadTs}
            replyText={replyText}
            setReplyText={setReplyText}
            replyMutation={replyMutation}
          />
        )}

        {isExpanded && (
          <div className="pl-8 space-y-3 pt-2 border-t">
            {loadingReplies ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : threadReplies && threadReplies.length > 0 ? (
              threadReplies.map((reply) => (
                <div key={reply.ts} className="flex items-start gap-2" data-testid={`bd-reply-${reply.ts}`}>
                  {getUserAvatar(reply.user) ? (
                    <img src={getUserAvatar(reply.user)} alt="" className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                      {getUserName(reply.user).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{getUserName(reply.user)}</span>
                      <span className="text-xs text-muted-foreground">{formatTs(reply.ts)}</span>
                    </div>
                    <div
                      className="text-sm mt-0.5 break-words"
                      dangerouslySetInnerHTML={{ __html: formatSlackText(reply.text, users) }}
                    />
                    {reply.files && reply.files.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {reply.files.map((f, i) => {
                          const proxyUrl = f.url ? `/api/slack/file-proxy?url=${encodeURIComponent(f.url)}` : "";
                          return (<div key={i} className="text-xs">
                            {f.mimetype?.startsWith("image/") && proxyUrl ? (
                              <div className="mt-1">
                                <img src={proxyUrl} alt={f.name} className="max-w-xs max-h-48 rounded border" />
                                <p className="text-muted-foreground mt-0.5">{f.name}</p>
                              </div>
                            ) : proxyUrl ? (
                              <a href={proxyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{f.name}</a>
                            ) : (
                              <span className="text-muted-foreground">{f.name}</span>
                            )}
                          </div>);
                        })}
                      </div>
                    )}
                  </div>
                  {can("internal-bd", "delete-message") && reply.bot_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => { if (confirm("Delete this reply?")) deleteMessageMutation.mutate({ timestamp: reply.ts }); }}
                      disabled={deleteMessageMutation.isPending}
                      data-testid={`bd-button-delete-reply-${reply.ts}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No replies yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
