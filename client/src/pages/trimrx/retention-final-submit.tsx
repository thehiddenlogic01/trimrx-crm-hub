import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SendHorizonal, Search, Loader2, ExternalLink, FileSpreadsheet,
  Eye, EyeOff, CheckCircle2, MessageSquare, CheckSquare, XCircle,
  Send, MessageCircle, ChevronUp, ChevronDown, CreditCard, DollarSign,
  AlertCircle, FileText, CornerDownRight,
} from "lucide-react";
import type { CvReport } from "@shared/schema";

const CHANNEL_ID = "C09KBS41YHH";
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
}

type ReplyTemplate = { id: string; subject: string; text: string };

const SLACK_EMOJI: Record<string, string> = {
  white_check_mark: "\u2705", eyes: "\uD83D\uDC40", thumbsup: "\uD83D\uDC4D",
  "+1": "\uD83D\uDC4D", thumbsdown: "\uD83D\uDC4E", "-1": "\uD83D\uDC4E",
  heart: "\u2764\uFE0F", fire: "\uD83D\uDD25", tada: "\uD83C\uDF89",
  pray: "\uD83D\uDE4F", raised_hands: "\uD83D\uDE4C", clap: "\uD83D\uDC4F",
  wave: "\uD83D\uDC4B", rocket: "\uD83D\uDE80", star: "\u2B50",
  warning: "\u26A0\uFE0F", x: "\u274C", heavy_check_mark: "\u2714\uFE0F",
  question: "\u2753", exclamation: "\u2757", point_right: "\uD83D\uDC49",
  point_left: "\uD83D\uDC48", rotating_light: "\uD83D\uDEA8", memo: "\uD83D\uDCDD",
  small_orange_diamond: "\uD83D\uDD38", small_blue_diamond: "\uD83D\uDD39",
  large_orange_diamond: "\uD83D\uDD36", large_blue_diamond: "\uD83D\uDD37",
  thinking_face: "\uD83E\uDD14", muscle: "\uD83D\uDCAA", "100": "\uD83D\uDCAF",
  speech_balloon: "\uD83D\uDCAC", bulb: "\uD83D\uDCA1", smile: "\uD83D\uDE04",
  slightly_smiling_face: "\uD83D\uDE42", sob: "\uD83D\uDE2D", cry: "\uD83D\uDE22",
  angry: "\uD83D\uDE20", ok_hand: "\uD83D\uDC4C", handshake: "\uD83E\uDD1D",
  check: "\u2705", no_entry: "\u26D4", bell: "\uD83D\uDD14", email: "\uD83D\uDCE7",
  phone: "\u260E\uFE0F", calendar: "\uD83D\uDCC5", link: "\uD83D\uDD17",
  pushpin: "\uD83D\uDCCC", bookmark: "\uD83D\uDD16", lock: "\uD83D\uDD12",
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
  safe = safe.replace(/\n/g, "<br/>");
  safe = safe.replace(
    /(?::small_orange_diamond:|🔸)?\s*\*?Concern\/Request:?\*?\s*(.*?)(?=<br\/>|$)/g,
    '<div class="concern-block"><span class="concern-label">Concern/Request:</span> $1</div>'
  );
  return safe;
}

function formatTs(ts: string) {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString("en-US", { timeZone: "America/Guatemala" });
}

function hasCheckmark(reactions: { name: string }[]) {
  return reactions.some((r) => r.name === "white_check_mark");
}

function buildSearchQuery(report: CvReport): string {
  if (report.link) {
    const uuidMatch = report.link.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch) return uuidMatch[1];
  }
  if (report.caseId) return report.caseId;
  return "";
}

function extractCaseFromSlackMsg(text: string) {
  let caseId = "";
  let link = "";

  const idMatch = text.match(/Case\s*(?:ID|Id|id)\s*:?\s*\*?\s*(?:ID\s*:?\s*\*?\s*)?(\S+)/i);
  if (idMatch) {
    caseId = idMatch[1].replace(/\*/g, "").replace(/[:\s]+$/g, "").trim();
    if (caseId.toUpperCase() === "ID" || caseId.length < 3) caseId = "";
    if (!caseId) {
      const fallback = text.match(/\b(ADA-[A-Z0-9]+)/i);
      if (fallback) caseId = fallback[1].replace(/\*/g, "").trim();
    }
  }
  if (!caseId) {
    const adaMatch = text.match(/\b(ADA-[A-Z0-9]{4,})/i);
    if (adaMatch) caseId = adaMatch[1].replace(/\*/g, "").trim();
  }

  const cleanSlackUrl = (raw: string) => raw.replace(/[>*<]/g, "").replace(/\|.*$/, "").trim();
  const linkMatch = text.match(/Case\s*Link\s*:?\s*\*?\s*(https?:\/\/\S+)/i);
  if (linkMatch) link = cleanSlackUrl(linkMatch[1]);
  if (!link) {
    const urlMatch = text.match(/(https?:\/\/(?:careglp|accommodations)\.carevalidate\.com\/accommodations\/(?:cases|requests)\/\S+)/i);
    if (urlMatch) link = cleanSlackUrl(urlMatch[1]);
  }

  return { caseId, link };
}

const COLUMNS = [
  { key: "submittedBy", label: "User" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "slackAction", label: "Slack Action" },
  { key: "caseId", label: "Case ID" },
  { key: "status", label: "Status" },
  { key: "link", label: "Link" },
  { key: "duplicated", label: "Duplicated" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "notesTrimrx", label: "Notes TrimRX" },
  { key: "slackUpdate", label: "Slack Update" },
  { key: "productType", label: "Product Type" },
  { key: "clientThreat", label: "Client Threat" },
  { key: "reason", label: "Reason" },
  { key: "subReason", label: "Sub-reason" },
  { key: "desiredAction", label: "Desired Action" },
] as const;

type ColumnKey = typeof COLUMNS[number]["key"];

function PaymentIntentsButton({ msg }: { msg: SlackMessage }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleClick = async () => {
    const extracted = extractCaseFromSlackMsg(msg.text);
    if (!extracted || (!extracted.link && !extracted.caseId)) {
      toast({ title: "No case link or ID found in this message", variant: "destructive" });
      return;
    }
    setOpen(true);
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await apiRequest("POST", "/api/stripe-payments/lookup-by-case", {
        caseLink: extracted.link || undefined,
        caseId: extracted.caseId || undefined,
      });
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to look up payment data");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === "succeeded") return "text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300";
    if (s === "canceled" || s === "failed") return "text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300";
    if (s === "requires_payment_method" || s === "requires_action") return "text-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300";
    return "text-gray-700 bg-gray-100";
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-950"
        data-testid={`button-payment-intents-${msg.ts}`}
      >
        <CreditCard className="h-3.5 w-3.5 mr-1" />
        Payment Intents
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Intents
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">Looking up email & payment data...</span>
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-red-600">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          )}
          {data && !loading && (
            <div className="space-y-4">
              {!data.found && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{data.message}</p>
                </div>
              )}
              {data.found && (
                <>
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                    <span className="font-medium">Email:</span>
                    <span>{data.email}</span>
                    <Badge variant="secondary" className="text-xs">{data.source}</Badge>
                  </div>
                  {data.subscriptions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Subscriptions ({data.subscriptions.length})
                      </h4>
                      <div className="space-y-2">
                        {data.subscriptions.map((sub: any) => (
                          <div key={sub.id} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <Badge className={statusColor(sub.status)}>{sub.status}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(sub.created).toLocaleDateString()}</span>
                            </div>
                            {sub.items?.map((item: any, i: number) => (
                              <div key={i} className="mt-1 text-xs text-muted-foreground">
                                ${item.amount.toFixed(2)} {item.currency}/{item.interval}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.paymentIntents?.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        Payment Intents ({data.paymentIntents.length})
                      </h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Date</th>
                              <th className="text-left p-2 font-medium">Amount</th>
                              <th className="text-left p-2 font-medium">Status</th>
                              <th className="text-left p-2 font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.paymentIntents.map((pi: any) => (
                              <tr key={pi.id} className="border-t">
                                <td className="p-2 text-xs whitespace-nowrap">{new Date(pi.created).toLocaleString()}</td>
                                <td className="p-2 whitespace-nowrap font-medium">${pi.amount.toFixed(2)} {pi.currency}</td>
                                <td className="p-2">
                                  <Badge variant="outline" className={statusColor(pi.status)}>
                                    {pi.status === "succeeded" && "✓ "}{pi.status}
                                  </Badge>
                                </td>
                                <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">{pi.description || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : data.customers?.length > 0 ? (
                    <div className="text-center py-6 text-muted-foreground"><p>No payment intents found</p></div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReplyWithTemplates({
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
  const { data: templates } = useQuery<ReplyTemplate[]>({
    queryKey: ["/api/slack/reply-templates"],
  });

  return (
    <div className="space-y-1.5 pt-1">
      {templates && templates.length > 0 && (
        <div className="flex gap-1.5 flex-wrap" data-testid={`templates-bar-${msgTs}`}>
          {templates.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setReplyText((prev) => ({ ...prev, [msgTs]: t.text }))}
                  data-testid={`template-quick-${t.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all cursor-pointer"
                >
                  <FileText className="h-3 w-3" />
                  {t.subject}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {t.text.length > 150 ? t.text.slice(0, 150) + "..." : t.text}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
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
          data-testid={`input-reply-${msgTs}`}
        />
        <Button
          size="sm"
          onClick={() => replyMutation.mutate({ threadTs, text: replyText[msgTs] || "" })}
          disabled={!replyText[msgTs]?.trim() || replyMutation.isPending}
          data-testid={`button-send-reply-${msgTs}`}
        >
          {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

interface SlackActionInfo {
  checked: boolean;
  lastReplyUser: string;
  lastReplyText: string;
  lastReplyTs: string;
}

function SlackMessagePanel({
  msg,
  users,
  onClose,
  onActionUpdate,
}: {
  msg: SlackMessage;
  users: Record<string, SlackUser>;
  onClose: () => void;
  onActionUpdate: (info: SlackActionInfo) => void;
}) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const checked = hasCheckmark(msg.reactions);
  const threadTs = msg.thread_ts || msg.ts;
  const isExpanded = expandedThread === msg.ts;
  const isReplying = replyingTo === msg.ts;
  const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${CHANNEL_ID}/p${msg.ts.replace(".", "")}`;

  const getUserName = useCallback((id: string) => users[id]?.real_name || users[id]?.name || id, [users]);
  const getUserAvatar = useCallback((id: string) => users[id]?.avatar || "", [users]);

  const isReply = msg.thread_ts && msg.thread_ts !== msg.ts;
  const parentPreview = msg.parent_text
    ? msg.parent_text.replace(/<@[A-Z0-9]+>/g, "").replace(/<[^>]+>/g, "").replace(/\*/g, "").trim().slice(0, 120)
    : "";

  const [localChecked, setLocalChecked] = useState(checked);
  const [lastReply, setLastReply] = useState<{ user: string; text: string; ts: string } | null>(null);

  const localReactions = useMemo(() => {
    const orig = msg.reactions || [];
    if (localChecked === checked) return orig;
    if (localChecked) {
      const has = orig.find((r) => r.name === "white_check_mark");
      if (has) return orig;
      return [...orig, { name: "white_check_mark", count: 1, users: [] as string[] }];
    } else {
      return orig
        .map((r) => r.name === "white_check_mark" ? { ...r, count: r.count - 1 } : r)
        .filter((r) => r.count > 0);
    }
  }, [msg.reactions, localChecked, checked]);

  const getUserNameStr = useCallback((id: string) => users[id]?.real_name || users[id]?.name || id, [users]);

  const emitUpdate = useCallback((isChecked: boolean, reply?: { user: string; text: string; ts: string } | null) => {
    const r = reply !== undefined ? reply : lastReply;
    onActionUpdate({
      checked: isChecked,
      lastReplyUser: r ? getUserNameStr(r.user) : "",
      lastReplyText: r ? r.text : "",
      lastReplyTs: r ? r.ts : "",
    });
  }, [lastReply, onActionUpdate, getUserNameStr]);

  const reactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/react`, { timestamp, name: "white_check_mark" });
    },
    onSuccess: () => {
      toast({ title: "Marked as done" });
      setLocalChecked(true);
      emitUpdate(true);
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "search"] });
    },
    onError: (err: any) => toast({ title: "Failed to react", description: err.message, variant: "destructive" }),
  });

  const unreactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/unreact`, { timestamp, name: "white_check_mark" });
    },
    onSuccess: () => {
      toast({ title: "Removed checkmark" });
      setLocalChecked(false);
      emitUpdate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "search"] });
    },
    onError: (err: any) => toast({ title: "Failed to remove reaction", description: err.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text }: { threadTs: string; text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/reply`, { thread_ts: threadTs, text });
    },
    onSuccess: (_d, vars) => {
      toast({ title: "Reply sent" });
      const newReply = { user: "you", text: vars.text, ts: String(Date.now() / 1000) };
      setLastReply(newReply);
      emitUpdate(localChecked, newReply);
      setReplyText((prev) => ({ ...prev, [msg.ts]: "" }));
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts] });
    },
    onError: (err: any) => toast({ title: "Failed to reply", description: err.message, variant: "destructive" }),
  });

  const { data: threadReplies, isLoading: loadingReplies } = useQuery<ThreadReply[]>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/replies/${msg.ts}`, { signal });
      if (!res.ok) throw new Error("Failed to fetch replies");
      return res.json();
    },
    enabled: msg.reply_count > 0,
    retry: 1,
    staleTime: 3 * 60 * 1000,
  });

  useEffect(() => {
    if (threadReplies && threadReplies.length > 0) {
      const last = threadReplies[threadReplies.length - 1];
      const newReply = { user: last.user, text: last.text, ts: last.ts };
      setLastReply(newReply);
      emitUpdate(localChecked, newReply);
    } else if (threadReplies && threadReplies.length === 0) {
      emitUpdate(localChecked, null);
    }
  }, [threadReplies]);

  return (
    <div className="space-y-4" data-testid="slack-message-panel">
      {isReply && (
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-xs">
          <CornerDownRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-medium text-blue-600 dark:text-blue-400">Replying to {msg.parent_user ? getUserName(msg.parent_user) : "a message"}</span>
            {parentPreview && <p className="text-muted-foreground mt-0.5 line-clamp-2">{parentPreview}</p>}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        {getUserAvatar(msg.user) ? (
          <img src={getUserAvatar(msg.user)} alt="" className="h-9 w-9 rounded-full flex-shrink-0 mt-0.5" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium">
            {getUserName(msg.user).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" data-testid="text-slack-user">{getUserName(msg.user)}</span>
            <span className="text-xs text-muted-foreground">{formatTs(msg.ts)}</span>
            {isReply && <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"><CornerDownRight className="h-3 w-3" /> Reply</Badge>}
            {localChecked && <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"><CheckSquare className="h-3 w-3" /> Done</Badge>}
          </div>
        </div>
      </div>

      <div
        className="text-sm break-words"
        dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, users) }}
        data-testid="text-slack-message-body"
      />

      {msg.attachments.length > 0 && (
        <div className="space-y-1">
          {msg.attachments.map((att, i) => (
            <div key={i} className="border-l-2 pl-3 py-1.5 text-xs text-muted-foreground bg-muted/30 rounded-r-md" style={{ borderColor: att.color ? `#${att.color}` : 'hsl(var(--border))' }}>
              {att.title && <p className="font-medium text-muted-foreground/80">{att.title}</p>}
              {att.text && <p className="opacity-70">{att.text}</p>}
              {att.service_name && <p className="text-[11px] opacity-50">{att.service_name}</p>}
            </div>
          ))}
        </div>
      )}

      {localReactions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {localReactions.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              <span className="text-sm">{emojiFromName(r.name)}</span>
              <span className="font-medium">{r.count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
        {can("slack-messages", "mark-done") && (
          !localChecked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reactMutation.mutate({ timestamp: msg.ts })}
              disabled={reactMutation.isPending}
              data-testid="button-mark-done"
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
              data-testid="button-remove-check"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Remove ✅
            </Button>
          )
        )}
        {can("slack-messages", "reply") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReplyingTo(isReplying ? null : msg.ts)}
            data-testid="button-reply"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Reply
          </Button>
        )}
        <PaymentIntentsButton msg={msg} />
        {(threadReplies ? threadReplies.length > 0 : msg.reply_count > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedThread(isExpanded ? null : msg.ts)}
            data-testid="button-thread-toggle"
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1" />
            {(() => { const c = threadReplies ? threadReplies.length : msg.reply_count; return `${c} ${c === 1 ? "reply" : "replies"}`; })()}
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
        )}
      </div>

      <a
        href={slackLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        data-testid="link-open-in-slack"
      >
        Open in Slack <ExternalLink className="h-3 w-3" />
      </a>

      {isReplying && (
        <ReplyWithTemplates
          msgTs={msg.ts}
          threadTs={threadTs}
          replyText={replyText}
          setReplyText={setReplyText}
          replyMutation={replyMutation}
        />
      )}

      {isExpanded && (
        <div className="ml-4 pl-4 space-y-0 pt-2 border-l-2 border-border">
          {loadingReplies ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : threadReplies && threadReplies.length > 0 ? (
            threadReplies.map((reply, idx) => (
              <div key={reply.ts} className={`flex items-start gap-2 py-2.5 px-3 rounded-md bg-amber-50/60 dark:bg-amber-950/20 ${idx !== 0 ? "mt-1.5" : ""}`} data-testid={`reply-${reply.ts}`}>
                {getUserAvatar(reply.user) ? (
                  <img src={getUserAvatar(reply.user)} alt="" className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
                    {getUserName(reply.user).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-muted-foreground">{getUserName(reply.user)}</span>
                    <span className="text-xs text-muted-foreground/60">{formatTs(reply.ts)}</span>
                  </div>
                  <div
                    className="text-sm mt-0.5 break-words text-foreground/80"
                    dangerouslySetInnerHTML={{ __html: formatSlackText(reply.text, users) }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No replies yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RetentionFinalSubmitPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(() => {
    try {
      const saved = localStorage.getItem("retention-final-hidden-columns");
      if (saved) return new Set(JSON.parse(saved) as ColumnKey[]);
    } catch {}
    return new Set<ColumnKey>();
  });
  const [selectedReport, setSelectedReport] = useState<CvReport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const slackCacheRef = useRef<Record<string, SlackMessage[] | null>>({});
  const [slackCache, setSlackCache] = useState<Record<string, SlackMessage[] | null>>({});
  const [slackLoading, setSlackLoading] = useState<Record<string, boolean>>({});
  const [slackActions, setSlackActions] = useState<Record<string, SlackActionInfo>>({});

  const { data: allReports, isLoading } = useQuery<CvReport[]>({
    queryKey: ["/api/cv-reports"],
  });

  const { data: slackUsers } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "users"],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/users`);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const readyReports = (allReports || []).filter((r) => r.checkingStatus === "Ready");

  const fetchSlackMessages = useCallback(async (report: CvReport): Promise<SlackMessage[] | null> => {
    const query = buildSearchQuery(report);
    if (!query) return null;
    try {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const messages: SlackMessage[] = Array.isArray(data) ? data : (data.messages || []);
      if (messages.length > 0) return messages;
      return null;
    } catch {
      return null;
    }
  }, []);

  const reportIdsKey = readyReports.map((r) => r.id).join(",");
  useEffect(() => {
    if (readyReports.length === 0) return;
    let cancelled = false;

    const loadMessages = async () => {
      for (const report of readyReports) {
        if (cancelled) break;
        const key = String(report.id);
        if (slackCacheRef.current[key] !== undefined) continue;
        const query = buildSearchQuery(report);
        if (!query) {
          slackCacheRef.current[key] = null;
          setSlackCache((prev) => ({ ...prev, [key]: null }));
          continue;
        }
        try {
          const msgs = await fetchSlackMessages(report);
          if (cancelled) break;
          slackCacheRef.current[key] = msgs;
          setSlackCache((prev) => ({ ...prev, [key]: msgs }));
        } catch {
          slackCacheRef.current[key] = null;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    loadMessages();
    return () => { cancelled = true; };
  }, [reportIdsKey, fetchSlackMessages]);

  const handleSlackClick = async (report: CvReport) => {
    const key = String(report.id);
    setSelectedReport(report);
    setSheetOpen(true);

    setSlackLoading((prev) => ({ ...prev, [key]: true }));
    const msgs = await fetchSlackMessages(report);
    slackCacheRef.current[key] = msgs;
    setSlackCache((prev) => ({ ...prev, [key]: msgs }));
    setSlackLoading((prev) => ({ ...prev, [key]: false }));
  };

  const filtered = readyReports.filter((report) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return COLUMNS.some((col) => {
      if (col.key === "slackUpdate" || col.key === "slackAction") return false;
      const val = (report as any)[col.key];
      return val && String(val).toLowerCase().includes(q);
    });
  });

  const toggleColumn = (key: ColumnKey) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("retention-final-hidden-columns", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const visibleColumns = COLUMNS.filter((col) => !hiddenColumns.has(col.key));

  const cleanSlackActionText = (text: string) => {
    return text
      .replace(/<@[A-Z0-9]+(?:\|[^>]*)?>/g, "")
      .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1")
      .replace(/<https?:\/\/[^>]+>/g, "")
      .replace(/:[a-z0-9_+-]+:/g, "")
      .replace(/\*/g, "")
      .replace(/\n/g, " ")
      .trim();
  };

  const renderCellContent = (report: CvReport, col: typeof COLUMNS[number]) => {
    if (col.key === "slackAction") {
      const key = String(report.id);
      const action = slackActions[key];
      const cached = slackCache[key];

      if (!cached && cached !== null) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      if (cached === null) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      const isChecked = action?.checked ?? cached.some((m) => hasCheckmark(m.reactions));
      const replyText = action?.lastReplyText ? cleanSlackActionText(action.lastReplyText) : "";
      const replyUser = action?.lastReplyUser || "";

      return (
        <div className="flex flex-col gap-1 min-w-[120px] max-w-[200px]" data-testid={`slack-action-${report.id}`}>
          {isChecked && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 w-fit">
              <CheckSquare className="h-3 w-3" />
              Done
            </Badge>
          )}
          {replyText && (
            <div className="text-[11px] text-muted-foreground leading-tight">
              {replyUser && <span className="font-medium text-foreground/70">{replyUser}: </span>}
              <span className="line-clamp-2">{replyText.length > 80 ? replyText.slice(0, 80) + "..." : replyText}</span>
            </div>
          )}
          {!isChecked && !replyText && (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      );
    }

    if (col.key === "slackUpdate") {
      const key = String(report.id);
      const cached = slackCache[key];
      const loading = slackLoading[key];
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSlackClick(report)}
          className="h-7 text-xs gap-1 whitespace-nowrap"
          data-testid={`button-slack-update-${report.id}`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <MessageSquare className="h-3 w-3" />
          )}
          Slack
          {cached !== undefined && cached !== null && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
          )}
        </Button>
      );
    }

    const value = (report as any)[col.key] || "";
    if (col.key === "link" && value) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline text-xs inline-flex items-center gap-1 max-w-[180px] truncate"
          data-testid={`link-case-${report.id}`}
        >
          {value.length > 30 ? value.slice(0, 30) + "..." : value}
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </a>
      );
    }
    if (col.key === "notesTrimrx" && value) {
      return (
        <span className="text-xs max-w-[200px] block truncate" title={value}>
          {value}
        </span>
      );
    }
    if (col.key === "status" && value) {
      const short = value.length > 20 ? value.slice(0, 20) + "..." : value;
      return (
        <span className="text-xs max-w-[120px] block truncate" title={value}>
          {short}
        </span>
      );
    }
    if (col.key === "productType" && value) {
      const items = value.split(",").map((v: string) => v.trim()).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((item: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
              {item}
            </Badge>
          ))}
        </div>
      );
    }
    if (col.key === "clientThreat" && value) {
      const items = value.split(",").map((v: string) => v.trim()).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((item: string, i: number) => (
            <Badge key={i} className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px] px-1.5 py-0">
              {item}
            </Badge>
          ))}
        </div>
      );
    }
    if (!value || value === "—") {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    return <span className="text-xs">{value}</span>;
  };

  const selectedKey = selectedReport ? String(selectedReport.id) : "";
  const selectedSlackMsg = selectedKey ? slackCache[selectedKey] : undefined;
  const selectedSlackLoading = selectedKey ? slackLoading[selectedKey] : false;

  return (
    <div className="space-y-6 max-w-full">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
          Retention Final Submit
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          CV reports marked as Ready for final submission
        </p>
      </div>

      <Card data-testid="card-retention-reports">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Reports
              {readyReports.length > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-ready-count">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {readyReports.length} Ready
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-[220px] text-sm"
                  data-testid="input-search"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-columns">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Columns
                    {hiddenColumns.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1">{hiddenColumns.size} hidden</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-3">
                  <p className="text-sm font-medium mb-2">Toggle Columns</p>
                  {hiddenColumns.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs mb-2 h-7"
                      onClick={() => { setHiddenColumns(new Set()); localStorage.removeItem("retention-final-hidden-columns"); }}
                      data-testid="button-show-all-columns"
                    >
                      Show all
                    </Button>
                  )}
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {COLUMNS.map((col) => (
                      <button
                        key={col.key}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted"
                        onClick={() => toggleColumn(col.key)}
                        data-testid={`toggle-col-${col.key}`}
                      >
                        {hiddenColumns.has(col.key) ? (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span className={hiddenColumns.has(col.key) ? "text-muted-foreground" : ""}>{col.label}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16" data-testid="loading-state">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="text-empty-state">
              <SendHorizonal className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">No reports ready for final submission</p>
              <p className="text-xs mt-1">Reports will appear here once their checking status is set to "Ready" in CV Report</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        data-testid={`th-${col.key}`}
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report) => (
                    <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.key} className="py-2.5">
                          {renderCellContent(report, col)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Slack Message
              {selectedReport?.caseId && (
                <Badge variant="secondary" className="text-xs">{selectedReport.caseId}</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedReport?.notesTrimrx
                ? selectedReport.notesTrimrx.length > 80
                  ? selectedReport.notesTrimrx.slice(0, 80) + "..."
                  : selectedReport.notesTrimrx
                : "Slack message for this case"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {selectedSlackLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">Searching Slack...</p>
              </div>
            ) : selectedSlackMsg && selectedSlackMsg.length > 0 ? (
              <div className="space-y-6">
                {selectedSlackMsg.length > 1 && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
                    {selectedSlackMsg.length} messages found for this case
                  </div>
                )}
                {selectedSlackMsg.map((m, idx) => (
                  <div key={m.ts}>
                    {idx > 0 && <div className="border-t my-4" />}
                    <SlackMessagePanel
                      msg={m}
                      users={slackUsers || {}}
                      onClose={() => setSheetOpen(false)}
                      onActionUpdate={(info) => {
                        if (selectedKey) {
                          setSlackActions((prev) => ({ ...prev, [selectedKey]: info }));
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : selectedKey && slackCache[selectedKey] === null ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">No Slack message found</p>
                <p className="text-xs mt-1">Could not find a matching message for this case</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">Loading...</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
