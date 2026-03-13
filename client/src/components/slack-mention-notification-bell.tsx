import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, MessageCircle, ChevronRight, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

const SEEN_KEY = "slack_mention_notifications_seen";

interface SlackUser {
  name: string;
  real_name: string;
  avatar: string;
  display_name?: string;
}

interface MentionNotification {
  id: string;
  ts: string;
  thread_ts: string;
  text: string;
  sender: { id: string; name: string; avatar: string };
  mentionedPerson: string;
  mentionedUserId: string;
  reactions: { name: string; count: number; users: string[] }[];
  replies: { ts: string; user: string; text: string; bot_id?: string | null; reactions: { name: string; count: number; users: string[] }[] }[];
  replyCount: number;
}

const SLACK_EMOJI: Record<string, string> = {
  white_check_mark: "\u2705", eyes: "\uD83D\uDC40", thumbsup: "\uD83D\uDC4D",
  "+1": "\uD83D\uDC4D", thumbsdown: "\uD83D\uDC4E", "-1": "\uD83D\uDC4E",
  heart: "\u2764\uFE0F", fire: "\uD83D\uDD25", tada: "\uD83C\uDF89",
  pray: "\uD83D\uDE4F", raised_hands: "\uD83D\uDE4C", clap: "\uD83D\uDC4F",
  wave: "\uD83D\uDC4B", rocket: "\uD83D\uDE80", star: "\u2B50",
  warning: "\u26A0\uFE0F", x: "\u274C", heavy_check_mark: "\u2714\uFE0F",
  question: "\u2753", exclamation: "\u2757", point_right: "\uD83D\uDC49",
  rotating_light: "\uD83D\uDEA8", memo: "\uD83D\uDCDD", thinking_face: "\uD83E\uDD14",
  muscle: "\uD83D\uDCAA", "100": "\uD83D\uDCAF", speech_balloon: "\uD83D\uDCAC",
  bulb: "\uD83D\uDCA1", smile: "\uD83D\uDE04", slightly_smiling_face: "\uD83D\uDE42",
  ok_hand: "\uD83D\uDC4C", handshake: "\uD83E\uDD1D", check: "\u2705",
  bell: "\uD83D\uDD14", email: "\uD83D\uDCE7",
};

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emojiFromName(name: string): string {
  return SLACK_EMOJI[name] || `:${name}:`;
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
    .replace(/:([a-z0-9_+-]+):/g, (_m, name) => {
      const emoji = SLACK_EMOJI[name];
      if (emoji) return emoji;
      return `:${name}:`;
    });
  safe = escapeHtml(safe);
  for (const link of links) {
    safe = safe.replace(link.placeholder, link.html);
  }
  safe = safe.replace(/\n/g, "<br/>");
  return safe;
}

function formatTs(ts: string) {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString("en-US", { timeZone: "America/Guatemala" });
}

function timeAgo(ts: string) {
  const now = Date.now();
  const then = Number(ts) * 1000;
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

function snippetText(text: string, maxLen = 80): string {
  let clean = text
    .replace(/<@[A-Za-z0-9]+(?:\|[^>]*)?>/g, "@someone")
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:\/\/[^>]+)>/g, "link")
    .replace(/:[a-z0-9_+-]+:/g, "")
    .replace(/\n/g, " ")
    .trim();
  if (clean.length > maxLen) clean = clean.slice(0, maxLen) + "...";
  return clean;
}

const CHANNEL_ID = "C09KBS41YHH";

export function SlackMentionNotificationBell() {
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<MentionNotification | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text }: { threadTs: string; text: string }) => {
      return apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/reply`, { threadTs, text });
    },
    onSuccess: () => {
      setReplyText("");
    },
  });

  const { data } = useQuery<{ notifications: MentionNotification[]; users: Record<string, SlackUser> }>({
    queryKey: ["/api/slack/mention-notifications"],
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });

  const notifications = data?.notifications || [];
  const users = data?.users || {};

  const unreadNotifications = notifications.filter((n) => !seenIds.has(n.id));
  const unreadCount = unreadNotifications.length;

  const markSeen = useCallback((id: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSeenIds(next);
      return next;
    });
  }, []);

  const handleNotifClick = useCallback((notif: MentionNotification) => {
    markSeen(notif.id);
    setSelectedNotif(notif);
    setReplyText("");
    setDialogOpen(true);
    setPopoverOpen(false);
  }, [markSeen]);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedNotif) return;
    replyMutation.mutate({ threadTs: selectedNotif.thread_ts || selectedNotif.ts, text: replyText.trim() });
  };

  useEffect(() => {
    if (notifications.length > 0 && seenIds.size > 0) {
      const validIds = new Set(notifications.map((n) => n.id));
      const cleaned = new Set([...seenIds].filter((id) => validIds.has(id)));
      if (cleaned.size !== seenIds.size) {
        setSeenIds(cleaned);
        saveSeenIds(cleaned);
      }
    }
  }, [notifications]);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            data-testid="button-notification-bell"
            className="relative p-1.5 rounded-lg hover:bg-sidebar-accent/80 transition-colors"
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span
                data-testid="badge-notification-count"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
              >
                {unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0 max-h-[400px] overflow-y-auto"
          align="end"
          side="right"
          sideOffset={8}
        >
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Mention Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          {unreadNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No unread mention notifications
            </div>
          ) : (
            <div className="divide-y">
              {unreadNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    data-testid={`notification-item-${notif.id}`}
                    onClick={() => handleNotifClick(notif)}
                    className="w-full text-left p-3 hover:bg-accent/50 transition-colors bg-blue-50/50 dark:bg-blue-950/20"
                  >
                    <div className="flex items-start gap-2">
                      {notif.sender.avatar ? (
                        <img src={notif.sender.avatar} alt="" className="h-7 w-7 rounded-full shrink-0 mt-0.5" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">{notif.sender.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{notif.sender.name}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                            @{notif.mentionedPerson}
                          </Badge>
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {snippetText(notif.text)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(notif.ts)}</span>
                          {notif.replyCount > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MessageCircle className="h-2.5 w-2.5" />
                              {notif.replyCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Mention Details</span>
              {selectedNotif && (
                <Badge variant="outline">@{selectedNotif.mentionedPerson}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedNotif && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {selectedNotif.sender.avatar ? (
                  <img src={selectedNotif.sender.avatar} alt="" className="h-9 w-9 rounded-full shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{selectedNotif.sender.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{selectedNotif.sender.name}</span>
                    <span className="text-xs text-muted-foreground">{formatTs(selectedNotif.ts)}</span>
                  </div>
                  <div
                    className="text-sm mt-1.5 leading-relaxed break-words [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: formatSlackText(selectedNotif.text, users) }}
                  />
                </div>
              </div>

              {selectedNotif.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-12">
                  {selectedNotif.reactions.map((r) => (
                    <span key={r.name} className="inline-flex items-center gap-1 bg-muted rounded-full px-2 py-0.5 text-xs">
                      {emojiFromName(r.name)} {r.count}
                    </span>
                  ))}
                </div>
              )}

              {selectedNotif.replies.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedNotif.replies.length} {selectedNotif.replies.length === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedNotif.replies.map((reply) => {
                      const replyUser = users[reply.user];
                      return (
                        <div key={reply.ts} className="flex items-start gap-2.5 pl-2">
                          {replyUser?.avatar ? (
                            <img src={replyUser.avatar} alt="" className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold">{(replyUser?.real_name || replyUser?.name || "?").charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium">{replyUser?.real_name || replyUser?.name || reply.user}</span>
                              <span className="text-[10px] text-muted-foreground">{formatTs(reply.ts)}</span>
                            </div>
                            <div
                              className="text-xs mt-0.5 leading-relaxed break-words [&_a]:text-primary [&_a]:underline"
                              dangerouslySetInnerHTML={{ __html: formatSlackText(reply.text, users) }}
                            />
                            {reply.reactions && reply.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {reply.reactions.map((r) => (
                                  <span key={r.name} className="inline-flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0 text-[10px]">
                                    {emojiFromName(r.name)} {r.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Send className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Reply in thread</span>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="text-sm resize-none min-h-[72px]"
                    data-testid="textarea-mention-reply"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    data-testid="button-send-mention-reply"
                  >
                    {replyMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending...</>
                    ) : (
                      <><Send className="h-3.5 w-3.5 mr-1.5" />Send Reply</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
