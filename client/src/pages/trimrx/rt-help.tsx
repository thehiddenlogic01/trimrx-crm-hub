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
  Users,
  FileText,
  Pencil,
} from "lucide-react";

const WORKSPACE_ID = "T07H8FUDT96";

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

interface SlackConversation {
  id: string;
  name: string;
  is_mpim: boolean;
  is_im: boolean;
  is_private: boolean;
  topic: string;
  purpose: string;
  num_members: number;
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

const SAVED_CONV_KEY = "rt_help_conversation_id";

export default function RtHelpPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [conversationId, setConversationId] = useState(() => {
    try { return localStorage.getItem(SAVED_CONV_KEY) || ""; } catch { return ""; }
  });
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchText, setUserSearchText] = useState("");
  const [newMessageText, setNewMessageText] = useState("");
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: slackStatus } = useQuery<{ connected: boolean; team?: string }>({
    queryKey: ["/api/slack/status"],
  });

  const { data: groupDMs, isLoading: loadingGroups, error: groupDMsError } = useQuery<SlackConversation[]>({
    queryKey: ["/api/slack/channels", "mpim"],
    queryFn: async () => {
      const res = await fetch("/api/slack/channels?types=mpim");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch group DMs");
      }
      return res.json();
    },
    enabled: slackStatus?.connected === true,
    retry: false,
  });

  useEffect(() => {
    if (conversationId) {
      try { localStorage.setItem(SAVED_CONV_KEY, conversationId); } catch {}
    }
  }, [conversationId]);

  const forceRefreshRef = useRef(false);

  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages, error: messagesError } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", conversationId, "messages", dateFilter],
    queryFn: async () => {
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      let url: string;
      if (dateFilter) {
        url = `/api/slack/channels/${conversationId}/messages?date=${dateFilter}${force ? "&force=1" : ""}`;
      } else {
        url = `/api/slack/channels/${conversationId}/messages`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch messages");
      }
      return res.json();
    },
    enabled: slackStatus?.connected === true && !!conversationId,
    refetchInterval: dateFilter ? false : 30000,
    retry: false,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await apiRequest("POST", "/api/slack/conversations/open", { userIds });
      return res.json();
    },
    onSuccess: (data: { conversationId: string }) => {
      if (data.conversationId) {
        setConversationId(data.conversationId);
        toast({ title: "Group DM created with bot included" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create conversation", description: err.message, variant: "destructive" });
    },
  });

  const isBotNotInChannel = messagesError?.message?.includes("channel_not_found");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: loadingSearch } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", conversationId, "search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${conversationId}/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: slackStatus?.connected === true && !!conversationId && debouncedSearch.length > 0,
  });

  const { data: users } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/users"],
    enabled: slackStatus?.connected === true,
  });

  const snapshotCache = () => {
    const cache = queryClient.getQueriesData<unknown>({ queryKey: ["/api/slack/channels", conversationId] });
    return cache.map(([key, data]) => ({ key, data }));
  };
  const restoreCache = (snapshot: { key: any; data: unknown }[]) => {
    snapshot.forEach(({ key, data }) => queryClient.setQueryData(key, data));
  };

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text }: { threadTs: string; text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${conversationId}/reply`, { thread_ts: threadTs, text });
    },
    onMutate: ({ threadTs, text }) => {
      const snapshot = snapshotCache();
      const prevReplyText = replyText[threadTs] || "";
      setReplyText((prev) => ({ ...prev, [threadTs]: "" }));
      setReplyingTo(null);
      const newReply: ThreadReply = { ts: String(Date.now() / 1000), user: "me", text, reactions: [] };
      queryClient.setQueriesData<ThreadReply[]>(
        { queryKey: ["/api/slack/channels", conversationId, "replies", threadTs] },
        (old) => old ? [...old, newReply] : [newReply]
      );
      const updateCount = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === threadTs ? { ...m, reply_count: m.reply_count + 1 } : m);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", conversationId] }, updateCount);
      return { snapshot, prevReplyText, threadTs };
    },
    onSuccess: () => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        restoreCache(context.snapshot);
        setReplyText((prev) => ({ ...prev, [context.threadTs]: context.prevReplyText }));
      }
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${conversationId}/react`, { timestamp, name: "white_check_mark" });
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
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", conversationId] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark added" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to add reaction", description: err.message, variant: "destructive" });
    },
  });

  const unreactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${conversationId}/unreact`, { timestamp, name: "white_check_mark" });
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
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", conversationId] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to remove checkmark", description: err.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("DELETE", `/api/slack/channels/${conversationId}/messages/${timestamp}`);
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotCache();
      const removeMsg = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.filter((m) => m.ts !== timestamp);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", conversationId] }, removeMsg);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to delete message", description: err.message, variant: "destructive" });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ timestamp, text }: { timestamp: string; text: string }) => {
      await apiRequest("PATCH", `/api/slack/channels/${conversationId}/messages/${timestamp}`, { text });
    },
    onMutate: ({ timestamp, text }) => {
      const snapshot = snapshotCache();
      const updateMsg = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === timestamp ? { ...m, text } : m);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", conversationId] }, updateMsg);
      return { snapshot };
    },
    onSuccess: () => {
      setEditingMsg(null);
      setEditText("");
      toast({ title: "Message updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreCache(context.snapshot);
      toast({ title: "Failed to edit message", description: err.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${conversationId}/send`, { text });
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
        { queryKey: ["/api/slack/channels", conversationId] },
        (old) => old ? [...old, optimisticMsg] : [optimisticMsg]
      );
      return { snapshot, prevText };
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", conversationId] });
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

  function getConversationDisplayName(conv: SlackConversation) {
    if (conv.purpose) return conv.purpose;
    if (conv.topic) return conv.topic;
    const name = conv.name || conv.id;
    const cleaned = name.replace(/^mpdm-/, "").replace(/--/g, ", ").replace(/-\d+$/, "");
    return cleaned;
  }

  if (!slackStatus?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">RT Help</h2>
          <p className="text-sm text-muted-foreground mt-1">Slack Group Communication</p>
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

  const selectedConv = groupDMs?.find((c) => c.id === conversationId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">RT Help</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedConv ? getConversationDisplayName(selectedConv) : "Select a Slack group to view messages"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {groupDMs && groupDMs.length > 0 ? (
            <Select value={conversationId} onValueChange={setConversationId}>
              <SelectTrigger className="h-9 w-[320px]" data-testid="select-conversation">
                <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a Slack group..."} />
              </SelectTrigger>
              <SelectContent>
                {groupDMs.map((conv) => (
                  <SelectItem key={conv.id} value={conv.id}>
                    {getConversationDisplayName(conv)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="text"
              placeholder={groupDMsError ? "Enter conversation ID..." : loadingGroups ? "Loading..." : "Enter conversation ID..."}
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value.trim())}
              className="h-9 w-[320px]"
              data-testid="input-conversation-id"
            />
          )}
        </div>

        {conversationId && (
          <>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-[220px] pr-8"
                data-testid="input-search-rt"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-search-rt"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px]" data-testid="select-status-rt">
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
                data-testid="input-date-rt"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-date-rt"
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
              data-testid="button-refresh-rt"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingMessages ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        )}
      </div>

      {groupDMsError && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Could not load group DMs automatically. You may need to add the <strong>mpim:read</strong> scope to your Slack app. You can still enter a conversation ID manually above.</span>
        </div>
      )}

      {!conversationId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {loadingGroups ? "Loading Slack groups..." : groupDMs && groupDMs.length > 0 ? "Select a Slack group DM from the dropdown above to view and manage messages." : "Enter a Slack conversation ID above to view and manage messages."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {isSearchMode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {loadingSearch ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</>
              ) : (
                <span data-testid="text-search-count-rt">
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
                  <p className="text-sm font-medium">Bot is not in this conversation</p>
                  <p className="text-xs text-muted-foreground">To add the bot, follow these steps in Slack:</p>
                  <div className="text-left bg-muted rounded-md px-4 py-3 space-y-2 text-xs">
                    <p><strong>1.</strong> Open the group DM in Slack</p>
                    <p><strong>2.</strong> Click the group name at the top of the chat (e.g. "Olia - TrimRx, Samuel Han")</p>
                    <p><strong>3.</strong> Go to the <strong>Members</strong> tab</p>
                    <p><strong>4.</strong> Click <strong>Add people</strong></p>
                    <p><strong>5.</strong> Search for <strong>Ethan - TrimRx</strong> (the bot) and add it</p>
                  </div>
                  <p className="text-xs text-muted-foreground">After adding the bot, click Refresh below.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { forceRefreshRef.current = true; refetchMessages(); }}
                  disabled={loadingMessages}
                  data-testid="button-retry-after-invite"
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
                <RtMessageCard
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
                  conversationId={conversationId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {can("rt-help", "send-message") && conversationId && !isBotNotInChannel && (
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
                data-testid="input-send-message"
              />
              <Button
                onClick={() => sendMessageMutation.mutate({ text: newMessageText.trim() })}
                disabled={!newMessageText.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RtReplyTemplate = { id: string; subject: string; text: string };

function RtReplyWithTemplates({
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

  const { data: templates } = useQuery<RtReplyTemplate[]>({
    queryKey: ["/api/slack/reply-templates"],
  });

  const selectTemplate = (template: RtReplyTemplate) => {
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
              data-testid={`rt-button-templates-${msgTs}`}
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
                    data-testid={`rt-template-option-${t.id}`}
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
          data-testid={`rt-input-reply-${msgTs}`}
        />
        <Button
          size="sm"
          onClick={() => replyMutation.mutate({ threadTs, text: replyText[msgTs] || "" })}
          disabled={!replyText[msgTs]?.trim() || replyMutation.isPending}
          data-testid={`rt-button-send-reply-${msgTs}`}
        >
          {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function RtMessageCard({
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
  conversationId,
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
  conversationId: string;
}) {
  const { can } = usePermissions();
  const threadTs = msg.thread_ts || msg.ts;
  const isExpanded = expandedThread === msg.ts;
  const isReplying = replyingTo === msg.ts;
  const checked = hasCheckmark(msg.reactions);
  const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${conversationId}/p${msg.ts.replace(".", "")}`;

  const { data: threadReplies, isLoading: loadingReplies } = useQuery<ThreadReply[]>({
    queryKey: ["/api/slack/channels", conversationId, "replies", msg.ts],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${conversationId}/replies/${msg.ts}`);
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
    <Card className={`${checked ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" : ""}`} data-testid={`rt-msg-${msg.ts}`}>
      <CardContent className="p-4 space-y-3">
        {isReply && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-xs" data-testid={`rt-reply-indicator-${msg.ts}`}>
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
              <span className="font-semibold text-sm" data-testid={`rt-text-user-${msg.ts}`}>{getUserName(msg.user)}</span>
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
                  data-testid={`rt-input-edit-${msg.ts}`}
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
                    data-testid={`rt-button-save-edit-${msg.ts}`}
                  >
                    {editMessageMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingMsg(null); setEditText(""); }}
                    data-testid={`rt-button-cancel-edit-${msg.ts}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm mt-1 break-words"
                dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, users) }}
                data-testid={`rt-text-msg-${msg.ts}`}
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
          {can("rt-help", "mark-done") && (
            !checked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactMutation.mutate({ timestamp: msg.ts })}
                disabled={reactMutation.isPending}
                data-testid={`rt-button-check-${msg.ts}`}
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
                data-testid={`rt-button-uncheck-${msg.ts}`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            )
          )}
          {can("rt-help", "reply") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyingTo(isReplying ? null : msg.ts)}
              data-testid={`rt-button-reply-${msg.ts}`}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
          )}
          {can("rt-help", "edit-message") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingMsg(msg.ts); setEditText(msg.text); }}
              data-testid={`rt-button-edit-${msg.ts}`}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {can("rt-help", "delete-message") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (confirm("Delete this message?")) deleteMessageMutation.mutate({ timestamp: msg.ts }); }}
              disabled={deleteMessageMutation.isPending}
              className="text-red-600 border-red-300 hover:bg-red-50"
              data-testid={`rt-button-delete-${msg.ts}`}
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
              data-testid={`rt-button-thread-${msg.ts}`}
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
            data-testid={`rt-link-slack-${msg.ts}`}
          >
            Open in Slack <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {isReplying && (
          <RtReplyWithTemplates
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
                <div key={reply.ts} className="flex items-start gap-2" data-testid={`rt-reply-${reply.ts}`}>
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
                  {can("rt-help", "delete-message") && reply.bot_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => { if (confirm("Delete this reply?")) deleteMessageMutation.mutate({ timestamp: reply.ts }); }}
                      disabled={deleteMessageMutation.isPending}
                      data-testid={`rt-button-delete-reply-${reply.ts}`}
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

