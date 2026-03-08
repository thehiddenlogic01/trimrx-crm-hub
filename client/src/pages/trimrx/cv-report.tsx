import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CvReport } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Loader2, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Check, X, Search, Upload, ArrowUpDown, AlertTriangle, ExternalLink, Download, MessageCircle, Send, CheckSquare, Hash, RefreshCw, Settings2, Eye, EyeOff, UserPlus, Copy, CheckCircle2, CircleDot, FileUp, Shield, Undo2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALL_REASONS, REASON_SUBREASON_MAP, ALL_SUB_REASONS, DESIRED_ACTION_OPTIONS, CLIENT_THREAT_OPTIONS, getSubReasonsForReason } from "@shared/classification";


const COLUMNS = [
  { key: "submittedBy", label: "User" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "caseId", label: "Case ID" },
  { key: "status", label: "Case Status" },
  { key: "link", label: "Link" },
  { key: "duplicated", label: "Duplicated" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "notesTrimrx", label: "Notes TrimRX" },
  { key: "productType", label: "Product Type" },
  { key: "slackStatusRt", label: "Slack Status (RT)" },
  { key: "clientThreat", label: "Client Threat" },
  { key: "reason", label: "Reason" },
  { key: "subReason", label: "Sub-reason" },
  { key: "desiredAction", label: "Desired Action" },
  { key: "checkingStatus", label: "Checking Status" },
  { key: "sentToSheet", label: "Sheet Status" },
] as const;

type ColumnKey = typeof COLUMNS[number]["key"];

const INLINE_EDITABLE_KEYS: ColumnKey[] = ["name", "customerEmail", "date"];

const PRODUCT_TYPE_OPTIONS = ["1M", "3M Bundle", "6M Bundle", "12M Bundle", "Supplement", "Upsell", "NAD+", "Zofran", "Sermorelin", "Semaglutide", "Tirzepatide"];
const SLACK_STATUS_RT_FALLBACK = ["Send", "Managed by K/E"];

const emptyForm: Record<ColumnKey, string> = {
  submittedBy: "",
  assignedTo: "",
  caseId: "",
  status: "",
  link: "",
  duplicated: "",
  customerEmail: "",
  date: "",
  name: "",
  notesTrimrx: "",
  productType: "",
  slackStatusRt: "",
  clientThreat: "",
  reason: "",
  subReason: "",
  desiredAction: "",
  checkingStatus: "Need Check",
  sentToSheet: "",
};

const CHECKING_STATUS_OPTIONS = ["Need Check", "Ready"];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function optimisticCvUpdate(reportId: number, colKey: string, newValue: string) {
  queryClient.cancelQueries({ queryKey: ["/api/cv-reports"] });
  const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
  if (prev) {
    queryClient.setQueryData<CvReport[]>(["/api/cv-reports"],
      prev.map((r) => r.id === reportId ? { ...r, [colKey]: newValue } : r)
    );
  }
  return prev;
}

function InlineEditCell({ reportId, colKey, value, displayLabel }: { reportId: number; colKey: ColumnKey; value: string; displayLabel?: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { [colKey]: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticCvUpdate(reportId, colKey, newValue);
      setEditing(false);
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  function handleSave() {
    if (editValue !== value) {
      updateMutation.mutate(editValue);
    } else {
      setEditing(false);
    }
  }

  function handleCancel() {
    setEditValue(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        <Input
          ref={inputRef}
          type={colKey === "date" ? "date" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs px-2 py-0"
          disabled={updateMutation.isPending}
          data-testid={`inline-input-${colKey}-${reportId}`}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          data-testid={`inline-save-${colKey}-${reportId}`}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-green-600" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          data-testid={`inline-cancel-${colKey}-${reportId}`}
        >
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors inline-block truncate max-w-[180px] text-[13px]"
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
      data-testid={`inline-edit-${colKey}-${reportId}`}
      title={displayLabel ? value : "Click to edit"}
    >
      {displayLabel || value || "—"}
    </span>
  );
}

function InlineSelectCell({ reportId, colKey, value, options }: { reportId: number; colKey: ColumnKey; value: string; options: string[] }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { [colKey]: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticCvUpdate(reportId, colKey, newValue);
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  return (
    <Select
      value={value || ""}
      onValueChange={(val) => {
        if (val !== value) {
          updateMutation.mutate(val === "__clear__" ? "" : val);
        }
      }}
    >
      <SelectTrigger
        className="h-6 text-xs px-2 py-0 min-w-[100px] border-dashed"
        data-testid={`select-${colKey}-${reportId}`}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__">
          <span className="text-muted-foreground">Clear</span>
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineMultiSelectCell({ reportId, colKey, value, options }: { reportId: number; colKey: ColumnKey; value: string; options: string[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const selected = value ? value.split(", ").filter(Boolean) : [];

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { [colKey]: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticCvUpdate(reportId, colKey, newValue);
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  const toggleOption = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    updateMutation.mutate(next.join(", "));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-6 text-xs px-2 py-0 min-w-[100px] border border-dashed rounded-md flex items-center gap-1 hover:bg-muted/50 transition-colors cursor-pointer"
          data-testid={`multiselect-${colKey}-${reportId}`}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : selected.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex items-center gap-0.5 flex-wrap">
              {selected.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggleOption(opt)}
              data-testid={`multiselect-option-${opt}`}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors cursor-pointer"
            >
              <Checkbox checked={selected.includes(opt)} className="pointer-events-none" />
              <span>{opt}</span>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => updateMutation.mutate("")}
            className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer"
            data-testid="multiselect-clear"
          >
            Clear all
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

const CHANNEL_ID = "C09KBS41YHH";
const WORKSPACE_ID = "T07H8FUDT96";

interface SlackMsg {
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
  reply_count: number;
  reactions: { name: string; count: number; users: string[] }[];
  attachments: { title: string; text: string; title_link: string; color: string; service_name: string }[];
}

interface SlackUser {
  name: string;
  real_name: string;
  avatar: string;
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    .replace(/<@([A-Z0-9]+)>/g, (_m, userId) => {
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
  return safe.replace(/\n/g, "<br/>");
}

function SlackMessageDialog({ link, caseId }: { link: string; caseId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const { data: slackUsers } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/users"],
  });

  const { data: messages, isLoading } = useQuery<SlackMsg[]>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "search", caseId, link],
    queryFn: async () => {
      const queries: string[] = [];
      if (caseId && caseId !== "ID") queries.push(caseId);
      const uuidMatch = link.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) queries.push(uuidMatch[1]);
      if (queries.length === 0) return [];
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/search?q=${encodeURIComponent(queries.join("|"))}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: open && !!(caseId || link),
  });

  const snapshotChannelCache = () => {
    const cache = queryClient.getQueriesData<unknown>({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    return cache.map(([key, data]) => ({ key, data }));
  };
  const restoreChannelCache = (snapshot: { key: any; data: unknown }[]) => {
    snapshot.forEach(({ key, data }) => queryClient.setQueryData(key, data));
  };

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text }: { threadTs: string; text: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/reply`, { thread_ts: threadTs, text });
    },
    onMutate: ({ threadTs }) => {
      const snapshot = snapshotChannelCache();
      const prevReplyText = replyText;
      setReplyText("");
      setReplyingTo(null);
      const updateCount = (old: SlackMsg[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === threadTs ? { ...m, reply_count: m.reply_count + 1 } : m);
      };
      queryClient.setQueriesData<SlackMsg[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, updateCount);
      return { snapshot, prevReplyText };
    },
    onSuccess: () => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        restoreChannelCache(context.snapshot);
        setReplyText(context.prevReplyText);
      }
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/react`, { timestamp, name: "white_check_mark" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotChannelCache();
      const updateMessages = (old: SlackMsg[] | undefined) => {
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
      queryClient.setQueriesData<SlackMsg[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark added" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreChannelCache(context.snapshot);
      toast({ title: "Failed to add reaction", description: err.message, variant: "destructive" });
    },
  });

  function getUserName(userId: string) {
    return slackUsers?.[userId]?.real_name || slackUsers?.[userId]?.name || userId;
  }

  function getUserAvatar(userId: string) {
    return slackUsers?.[userId]?.avatar || "";
  }

  if (!caseId && !link) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid={`button-slack-${caseId}`}>
          <Hash className="h-3 w-3" />
          Slack
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Slack Messages for {caseId}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No Slack messages found for this case</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const checked = msg.reactions.some((r) => r.name === "white_check_mark");
              const threadTs = msg.thread_ts || msg.ts;
              const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${CHANNEL_ID}/p${msg.ts.replace(".", "")}`;
              const isReplying = replyingTo === msg.ts;

              return (
                <div
                  key={msg.ts}
                  className={`border rounded-lg p-3 space-y-2 ${checked ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" : ""}`}
                  data-testid={`slack-msg-${msg.ts}`}
                >
                  <div className="flex items-start gap-2.5">
                    {getUserAvatar(msg.user) ? (
                      <img src={getUserAvatar(msg.user)} alt="" className="h-8 w-8 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-medium">
                        {getUserName(msg.user).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{getUserName(msg.user)}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(Number(msg.ts) * 1000).toLocaleString()}
                        </span>
                        {checked && (
                          <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckSquare className="h-3 w-3" /> Done
                          </Badge>
                        )}
                      </div>
                      <div
                        className="text-sm mt-1 break-words"
                        dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, slackUsers) }}
                      />
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    {!checked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => reactMutation.mutate({ timestamp: msg.ts })}
                        disabled={reactMutation.isPending}
                        data-testid={`button-slack-check-${msg.ts}`}
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Mark Done
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setReplyingTo(isReplying ? null : msg.ts)}
                      data-testid={`button-slack-reply-${msg.ts}`}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Reply
                    </Button>
                    {msg.reply_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                      </span>
                    )}
                    <a
                      href={slackLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                    >
                      Open in Slack <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {isReplying && (
                    <div className="flex gap-2 pt-1">
                      <Textarea
                        placeholder="Type your reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                            e.preventDefault();
                            replyMutation.mutate({ threadTs: threadTs, text: replyText.trim() });
                          }
                        }}
                        rows={2}
                        className="text-sm resize-none flex-1"
                        data-testid={`input-slack-reply-${msg.ts}`}
                      />
                      <Button
                        size="sm"
                        className="h-auto"
                        onClick={() => replyMutation.mutate({ threadTs: threadTs, text: replyText })}
                        disabled={!replyText.trim() || replyMutation.isPending}
                        data-testid={`button-slack-send-${msg.ts}`}
                      >
                        {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CvReportPage() {
  const { toast } = useToast();
  const { can, isEditor } = usePermissions();
  const { data: slackStatusRtSettings } = useQuery<string[]>({
    queryKey: ["/api/cv-settings", "slack_status_rt_options"],
    queryFn: async () => {
      const res = await fetch("/api/cv-settings/slack_status_rt_options", { credentials: "include" });
      if (!res.ok) return SLACK_STATUS_RT_FALLBACK;
      const data = await res.json();
      return data.options?.length > 0 ? data.options : SLACK_STATUS_RT_FALLBACK;
    },
  });
  const SLACK_STATUS_RT_OPTIONS = slackStatusRtSettings ?? SLACK_STATUS_RT_FALLBACK;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<ColumnKey, string>>({ ...emptyForm });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    try { const v = localStorage.getItem("cv-report-pageSize"); return v ? Number(v) : 20; } catch { return 20; }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return localStorage.getItem("cv-report-searchQuery") || ""; } catch { return ""; }
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortOrder, setSortOrder] = useState<"last-first" | "first-last">(() => {
    try { const v = localStorage.getItem("cv-report-sortOrder"); return v === "first-last" ? "first-last" : "last-first"; } catch { return "last-first"; }
  });
  const [filterStatuses, setFilterStatuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("cv-report-filterStatuses");
      if (saved) return JSON.parse(saved);
      const old = localStorage.getItem("cv-report-filterStatus");
      if (old && old !== "all") return [old];
      return [];
    } catch { return []; }
  });
  const [filterCheckingStatus, setFilterCheckingStatus] = useState<string>(() => {
    try { return localStorage.getItem("cv-report-filterCheckingStatus") || "all"; } catch { return "all"; }
  });
  const [filterSlackStatusRt, setFilterSlackStatusRt] = useState<string>(() => {
    try { return localStorage.getItem("cv-report-filterSlackStatusRt") || "all"; } catch { return "all"; }
  });
  const [fetchingCaseData, setFetchingCaseData] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeProgress, setReanalyzeProgress] = useState({ done: 0, total: 0 });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [taskProgress, setTaskProgress] = useState<{ current: number; total: number; stage: string }>({ current: 0, total: 0, stage: "" });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filterBrokenLinks, setFilterBrokenLinks] = useState(() => {
    try { return localStorage.getItem("cv-report-filterBrokenLinks") === "true"; } catch { return false; }
  });
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [cvTokenInput, setCvTokenInput] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>(() => {
    if (isEditor && user?.username) return user.username;
    try { return localStorage.getItem("cv-report-filterAssignedTo") || "all"; } catch { return "all"; }
  });
  const [filterDate, setFilterDate] = useState<string>("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(() => {
    try {
      const saved = localStorage.getItem("cv-report-hidden-columns");
      if (saved) return new Set(JSON.parse(saved) as ColumnKey[]);
    } catch {}
    return new Set<ColumnKey>();
  });

  const toggleColumnVisibility = (key: ColumnKey) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem("cv-report-hidden-columns", JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => { localStorage.setItem("cv-report-pageSize", String(pageSize)); }, [pageSize]);
  useEffect(() => { localStorage.setItem("cv-report-searchQuery", searchQuery); }, [searchQuery]);
  useEffect(() => { localStorage.setItem("cv-report-sortOrder", sortOrder); }, [sortOrder]);
  useEffect(() => { localStorage.setItem("cv-report-filterStatuses", JSON.stringify(filterStatuses)); }, [filterStatuses]);
  useEffect(() => { localStorage.setItem("cv-report-filterCheckingStatus", filterCheckingStatus); }, [filterCheckingStatus]);
  useEffect(() => { localStorage.setItem("cv-report-filterBrokenLinks", String(filterBrokenLinks)); }, [filterBrokenLinks]);
  useEffect(() => { localStorage.setItem("cv-report-filterAssignedTo", filterAssignedTo); }, [filterAssignedTo]);
  useEffect(() => { localStorage.setItem("cv-report-filterSlackStatusRt", filterSlackStatusRt); }, [filterSlackStatusRt]);

  useEffect(() => {
    if (!activeTaskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/cv-reports/progress/${activeTaskId}`);
        const data = await res.json();
        setTaskProgress(data);
        if (data.total > 0 && data.current >= data.total) {
          clearInterval(interval);
        }
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, [activeTaskId]);

  const visibleColumns = COLUMNS.filter((col) => !hiddenColumns.has(col.key));

  const { data: reports, isLoading, error } = useQuery<CvReport[]>({
    queryKey: ["/api/cv-reports"],
  });

  const { data: tokenStatus } = useQuery<{ hasToken: boolean }>({
    queryKey: ["/api/carevalidate/token-status"],
  });

  const { data: crmUsers } = useQuery<{ id: string; username: string }[]>({
    queryKey: ["/api/users"],
  });

  const cvSaveMutation = useMutation({
    mutationFn: async (token: string) => {
      await apiRequest("POST", "/api/carevalidate/token", { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carevalidate/token-status"] });
      toast({ title: "CareValidate token saved" });
    },
    onError: (err: Error) => toast({ title: "Failed to save token", description: err.message, variant: "destructive" }),
  });

  const cvClearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/carevalidate/token");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carevalidate/token-status"] });
      toast({ title: "CareValidate token cleared" });
    },
    onError: (err: Error) => toast({ title: "Failed to clear token", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ ids, assignedTo }: { ids: number[]; assignedTo: string }) => {
      const res = await apiRequest("POST", "/api/cv-reports/assign", { ids, assignedTo });
      return await res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: vars.assignedTo ? `Assigned ${vars.ids.length} report(s) to ${vars.assignedTo}` : `Unassigned ${vars.ids.length} report(s)` });
      setSelectedIds(new Set());
    },
    onError: (err: Error) => {
      toast({ title: "Assign failed", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<ColumnKey, string>) => {
      const res = await apiRequest("POST", "/api/cv-reports", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: "Report added" });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<ColumnKey, string> }) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${id}`, data);
      return await res.json();
    },
    onMutate: ({ id, data }) => {
      queryClient.cancelQueries({ queryKey: ["/api/cv-reports"] });
      const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
      if (prev) {
        queryClient.setQueryData<CvReport[]>(["/api/cv-reports"],
          prev.map((r) => r.id === id ? { ...r, ...data } : r)
        );
      }
      return { prev };
    },
    onSuccess: () => {
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cv-reports/${id}`);
    },
    onMutate: (id: number) => {
      queryClient.cancelQueries({ queryKey: ["/api/cv-reports"] });
      const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
      if (prev) {
        queryClient.setQueryData<CvReport[]>(["/api/cv-reports"], prev.filter((r) => r.id !== id));
      }
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cv-reports");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      setSelectedIds(new Set());
      setDeleteAllConfirmOpen(false);
      setDeleteAllConfirmText("");
      toast({ title: "All reports deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete all", description: err.message, variant: "destructive" });
    },
  });

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importErrors, setImportErrors] = useState<Record<number, string>>({});
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importDragging, setImportDragging] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const IMPORT_COLUMNS = [
    "caseId", "status", "link", "duplicated", "customerEmail", "date", "name",
    "notesTrimrx", "productType", "clientThreat", "reason", "subReason",
    "desiredAction", "checkingStatus",
    "submittedBy", "assignedTo",
  ];

  const IMPORT_LABELS: Record<string, string> = {};
  COLUMNS.forEach((c) => { IMPORT_LABELS[c.key] = c.label; });

  const handleExport = async () => {
    try {
      const res = await fetch("/api/cv-reports/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exported ${reports?.length || 0} reports` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const parseCsv = (text: string): Record<string, string>[] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        currentRow.push(currentVal);
        currentVal = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        currentRow.push(currentVal);
        if (currentRow.some((v) => v.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentVal = "";
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else {
        currentVal += ch;
      }
    }
    currentRow.push(currentVal);
    if (currentRow.some((v) => v.length > 0)) rows.push(currentRow);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
      return obj;
    }).filter((row) => Object.values(row).some((v) => v.length > 0));
  };

  const validateImportRows = (rows: Record<string, string>[]) => {
    const errors: Record<number, string> = {};
    rows.forEach((row, i) => {
      const issues: string[] = [];
      if (!row.link && !row.caseId && !row.notesTrimrx) issues.push("Missing link, caseId, and notes");
      if (issues.length > 0) errors[i] = issues.join("; ");
    });
    return errors;
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Please select a CSV file", variant: "destructive" });
      return;
    }
    setImportFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "No valid rows found in CSV", variant: "destructive" });
        return;
      }
      setImportRows(rows);
      setImportErrors(validateImportRows(rows));
    } catch {
      toast({ title: "Failed to read file", variant: "destructive" });
    }
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    setImportProgress({ current: 0, total: importRows.length });
    try {
      const CHUNK = 50;
      let totalImported = 0;
      let totalSkipped = 0;
      for (let i = 0; i < importRows.length; i += CHUNK) {
        const chunk = importRows.slice(i, i + CHUNK);
        const res = await apiRequest("POST", "/api/cv-reports/import", { rows: chunk });
        const data = await res.json();
        totalImported += data.imported;
        totalSkipped += data.skipped;
        setImportProgress({ current: Math.min(i + CHUNK, importRows.length), total: importRows.length });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: `Imported ${totalImported} reports${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ""}` });
      setImportDialogOpen(false);
      setImportRows([]);
      setImportErrors({});
      setImportFileName("");
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const gsheetsConfig = useQuery<{ hasCredentials: boolean; spreadsheetId: string; columnMapping: Record<string, string> }>({
    queryKey: ["/api/gsheets/config"],
  });

  const pushMutation = useMutation({
    mutationFn: async (reportIds: number[]) => {
      const res = await apiRequest("POST", "/api/gsheets/push", { reportIds, sortOrder });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Pushed ${data.pushed} report(s) to Google Sheets` });
      setSelectedIds(new Set());
    },
    onError: (err: Error) => {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    },
  });

  const undoPushMutation = useMutation({
    mutationFn: async (reportIds: number[]) => {
      const res = await apiRequest("POST", "/api/gsheets/undo-push", { reportIds });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: `Undo successful for ${data.undone} report(s)` });
      setSelectedIds(new Set());
    },
    onError: (err: Error) => {
      toast({ title: "Undo failed", description: err.message, variant: "destructive" });
    },
  });

  const isGSheetsReady = gsheetsConfig.data?.hasCredentials && gsheetsConfig.data?.spreadsheetId && Object.keys(gsheetsConfig.data?.columnMapping || {}).length > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(pageReportIds: number[]) {
    const allSelected = pageReportIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageReportIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageReportIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  function openEdit(report: CvReport) {
    setEditingId(report.id);
    const newForm: Record<ColumnKey, string> = { ...emptyForm };
    for (const col of COLUMNS) {
      const val = (report as any)[col.key];
      newForm[col.key] = col.key === "checkingStatus" ? (val || "Need Check") : (val || "");
    }
    setForm(newForm);
    setDialogOpen(true);
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const submitData = { ...form };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  function renderCellContent(report: CvReport, col: typeof COLUMNS[number]) {
    const value = (report as any)[col.key] || "";
    const canEdit = can("cv-report", "edit");
    const canAllEdit = can("cv-report", "all-edit-access");
    const isInlineEditable = INLINE_EDITABLE_KEYS.includes(col.key);

    if (isInlineEditable) {
      return canEdit ? <InlineEditCell reportId={report.id} colKey={col.key} value={value} /> : <span>{value}</span>;
    }

    if (col.key === "assignedTo") {
      if (!value) return <span className="text-muted-foreground">—</span>;
      return <Badge variant="outline" className="text-[11px] font-medium">{value}</Badge>;
    }

    if (col.key === "productType") {
      return canAllEdit ? <InlineMultiSelectCell reportId={report.id} colKey={col.key} value={value} options={PRODUCT_TYPE_OPTIONS} /> : (
        value ? (
          <div className="flex items-center gap-1 flex-wrap">
            {value.split(", ").filter(Boolean).map((s) => (
              <Badge key={s} variant="secondary" className="text-[11px] px-1.5 py-0 h-5">{s}</Badge>
            ))}
          </div>
        ) : <span>—</span>
      );
    }

    if (col.key === "reason") {
      return canAllEdit ? <InlineSelectCell reportId={report.id} colKey={col.key} value={value} options={ALL_REASONS} /> : <span>{value}</span>;
    }

    if (col.key === "subReason") {
      const reason = (report as any).reason || "";
      const opts = reason && REASON_SUBREASON_MAP[reason] ? REASON_SUBREASON_MAP[reason] : ALL_SUB_REASONS;
      return canAllEdit ? <InlineSelectCell reportId={report.id} colKey={col.key} value={value} options={opts} /> : <span>{value}</span>;
    }

    if (col.key === "desiredAction") {
      return canAllEdit ? <InlineSelectCell reportId={report.id} colKey={col.key} value={value} options={DESIRED_ACTION_OPTIONS} /> : <span>{value}</span>;
    }

    if (col.key === "slackStatusRt") {
      return canAllEdit ? <InlineSelectCell reportId={report.id} colKey={col.key} value={value} options={SLACK_STATUS_RT_OPTIONS} /> : <span>{value || "—"}</span>;
    }

    if (col.key === "clientThreat") {
      return canAllEdit ? <InlineSelectCell reportId={report.id} colKey={col.key} value={value} options={CLIENT_THREAT_OPTIONS} /> : <span>{value}</span>;
    }

    if (col.key === "link" && value) {
      const isBroken = /\[\u2026\]|\.\.\.|…/.test(value);
      const displayUrl = value.includes("|") ? value.split("|")[0].trim() : value;
      const shortLabel = (() => {
        try {
          const u = new URL(displayUrl);
          return u.hostname.replace("www.", "") + "/acc...";
        } catch {
          return displayUrl.slice(0, 30) + "...";
        }
      })();
      if (isBroken) {
        return (
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" data-testid={`icon-broken-link-${report.id}`} />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px]">
                <p className="text-destructive font-medium">Broken link — click to fix</p>
              </TooltipContent>
            </Tooltip>
            {canEdit ? <InlineEditCell reportId={report.id} colKey="link" value={value} displayLabel={shortLabel} /> : <span className="text-destructive text-sm">{shortLabel}</span>}
          </div>
        );
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline text-sm whitespace-nowrap"
              data-testid={`link-report-${report.id}`}
            >
              {shortLabel}
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[400px] break-all">
            <p>{displayUrl}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (col.key === "checkingStatus") {
      const isReady = (value || "Need Check") === "Ready";
      if (!canAllEdit) return <span>{value || "Need Check"}</span>;
      return (
        <Button
          variant={isReady ? "default" : "outline"}
          size="sm"
          className={`h-6 text-[11px] px-2 ${isReady ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"}`}
          data-testid={`toggle-checking-${report.id}`}
          onClick={() => {
            const newVal = isReady ? "Need Check" : "Ready";
            optimisticCvUpdate(report.id, "checkingStatus", newVal);
            apiRequest("PATCH", `/api/cv-reports/${report.id}`, { checkingStatus: newVal })
              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] }))
              .catch(() => {
                queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
                toast({ title: "Failed to update", variant: "destructive" });
              });
          }}
        >
          {isReady ? (
            <><CheckCircle2 className="h-3 w-3 mr-1" /> Ready</>
          ) : (
            <><CircleDot className="h-3 w-3 mr-1" /> Need Check</>
          )}
        </Button>
      );
    }

    if (col.key === "sentToSheet") {
      if (report.sentToSheet === "yes") {
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded whitespace-nowrap" data-testid={`sheet-status-${report.id}`}>
              <CheckCircle2 className="h-3 w-3" />
              Added to RT
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => undoPushMutation.mutate([report.id])}
              disabled={undoPushMutation.isPending}
              title="Undo — remove from tracker"
              data-testid={`button-undo-sheet-${report.id}`}
            >
              <Undo2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    }

    if (!value) return <span className="text-muted-foreground">—</span>;

    if (col.key === "notesTrimrx") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block max-w-[200px] cursor-default" data-testid={`notes-expand-${report.id}`}>{value || "—"}</span>
          </TooltipTrigger>
          {value && (
            <TooltipContent side="bottom" align="start" className="max-w-[350px] whitespace-pre-wrap text-xs leading-relaxed bg-amber-50 text-amber-950 border border-amber-300 shadow-md p-3 rounded-md dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700">
              <p>{value}</p>
            </TooltipContent>
          )}
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="truncate block max-w-[200px]">{value}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[400px] break-words">
          <p>{value}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">CV Report</h2>
            <p className="text-xs text-muted-foreground mt-0.5">TrimRX cancellation and retention tracking</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`flex items-center gap-2 border rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 ${tokenStatus?.hasToken ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30"}`}
                  data-testid="button-cv-token-indicator"
                >
                  <Shield className={`h-3.5 w-3.5 ${tokenStatus?.hasToken ? "text-green-600" : "text-amber-500"}`} />
                  <span className="font-medium">CareValidate</span>
                  {tokenStatus?.hasToken ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] px-1.5 py-0" data-testid="badge-cv-token-active">
                      Token Set
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0" data-testid="badge-cv-token-missing">
                      No Token
                    </Badge>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">CareValidate Bearer Token</p>
                    <p className="text-xs text-muted-foreground">Required for fetching case data. Tokens expire hourly.</p>
                  </div>
                  {tokenStatus?.hasToken && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                      <p className="text-xs text-green-600 flex items-center gap-1 flex-1">
                        <CheckCircle2 className="h-3 w-3" /> Token configured
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => cvClearMutation.mutate()}
                        disabled={cvClearMutation.isPending}
                        data-testid="button-cv-clear-token"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste bearer token..."
                      value={cvTokenInput}
                      onChange={(e) => setCvTokenInput(e.target.value)}
                      className="text-xs h-8"
                      data-testid="input-cv-token"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        cvSaveMutation.mutate(cvTokenInput);
                        setCvTokenInput("");
                      }}
                      disabled={!cvTokenInput.trim() || cvSaveMutation.isPending}
                      data-testid="button-cv-save-token"
                    >
                      {cvSaveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {tokenStatus?.hasToken ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5 border rounded-md px-2 py-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                data-testid="button-fetch-case-data"
                disabled={fetchingCaseData || checkingDuplicates || !tokenStatus?.hasToken || !reports || reports.length === 0}
                onClick={async () => {
                  setFetchingCaseData(true);
                  setActiveTaskId("fetch-case-data");
                  setTaskProgress({ current: 0, total: 0, stage: "Starting..." });
                  try {
                    const res = await apiRequest("POST", "/api/carevalidate/fetch-all");
                    const data = await res.json();
                    if (res.status === 401) {
                      toast({ title: "Token expired", description: "Please update your CareValidate token in Integrations.", variant: "destructive" });
                    } else {
                      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
                      toast({ title: `Fetched: ${data.successCount} updated, ${data.skipCount} skipped, ${data.errorCount} errors` });
                    }
                  } catch (err: any) {
                    toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
                  } finally {
                    setFetchingCaseData(false);
                    setActiveTaskId(null);
                    setTaskProgress({ current: 0, total: 0, stage: "" });
                  }
                }}
              >
                {fetchingCaseData ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                Fetch Case Data
              </Button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`h-7 text-xs min-w-[150px] justify-between ${filterStatuses.length > 0 ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300" : ""}`} data-testid="select-filter-status">
                  {filterStatuses.length === 0 ? "All Statuses" : filterStatuses.length === 1 ? filterStatuses[0] : `${filterStatuses.length} Statuses`}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {filterStatuses.length > 0 && (
                    <button
                      onClick={() => { setFilterStatuses([]); setCurrentPage(1); }}
                      className="w-full text-left text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                      data-testid="button-clear-status-filter"
                    >
                      Clear All
                    </button>
                  )}
                  {Array.from(new Set((reports || []).map((r) => r.status).filter(Boolean))).sort().map((s) => (
                    <label key={s} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-accent rounded">
                      <Checkbox
                        checked={filterStatuses.includes(s!)}
                        onCheckedChange={(checked) => {
                          setFilterStatuses((prev) => {
                            const next = checked ? [...prev, s!] : prev.filter((x) => x !== s);
                            return next;
                          });
                          setCurrentPage(1);
                        }}
                        data-testid={`checkbox-status-${s}`}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Select
              value={filterCheckingStatus}
              onValueChange={(val) => {
                setFilterCheckingStatus(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className={`h-7 w-[150px] text-xs ${filterCheckingStatus !== "all" ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300" : ""}`} data-testid="select-filter-checking-status">
                <SelectValue placeholder="Checking Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Checking</SelectItem>
                {CHECKING_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterSlackStatusRt}
              onValueChange={(val) => {
                setFilterSlackStatusRt(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className={`h-7 w-[170px] text-xs ${filterSlackStatusRt !== "all" ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300" : ""}`} data-testid="select-filter-slack-status-rt">
                <SelectValue placeholder="Slack Status (RT)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Slack Status (RT)</SelectItem>
                <SelectItem value="__empty__">Not Set</SelectItem>
                {SLACK_STATUS_RT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditor ? (
              <div className="h-7 px-3 flex items-center text-xs border rounded-md bg-muted/50 text-muted-foreground" data-testid="badge-editor-filter">
                {user?.username || "My Reports"}
              </div>
            ) : (
              <Select
                value={filterAssignedTo}
                onValueChange={(val) => {
                  setFilterAssignedTo(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className={`h-7 w-[150px] text-xs ${filterAssignedTo !== "all" ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300" : ""}`} data-testid="select-filter-assigned-to">
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(crmUsers || []).map((u) => (
                    <SelectItem key={u.id} value={u.username}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className={`h-7 w-[150px] text-xs ${filterDate ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300" : ""}`}
                data-testid="input-filter-date"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 w-[220px] h-9"
                data-testid="input-search-reports"
              />
            </div>
            {selectedIds.size > 0 && user?.role === "admin" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="button-assign-reports">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign {selectedIds.size}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">Assign to user</p>
                    {(crmUsers || []).map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                        data-testid={`button-assign-${u.username}`}
                        onClick={() => assignMutation.mutate({ ids: Array.from(selectedIds), assignedTo: u.username })}
                      >
                        {u.username}
                      </button>
                    ))}
                    <button
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                      data-testid="button-unassign"
                      onClick={() => assignMutation.mutate({ ids: Array.from(selectedIds), assignedTo: "" })}
                    >
                      Unassign
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" data-testid="button-settings-menu">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Actions</p>
                  <button
                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    data-testid="button-filter-broken-links"
                    onClick={() => { setFilterBrokenLinks(!filterBrokenLinks); setCurrentPage(1); }}
                  >
                    <AlertTriangle className={`h-4 w-4 ${filterBrokenLinks ? "text-destructive" : ""}`} />
                    {filterBrokenLinks ? "Show All Links" : "Broken Links"}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    data-testid="button-reanalyze-all"
                    disabled={reanalyzing || !reports?.length}
                    onClick={async () => {
                      const toAnalyze = (reports || []).filter((r) => (r.confidence === 0 || !r.confidence) && r.notesTrimrx?.trim());
                      if (toAnalyze.length === 0) {
                        toast({ title: "Nothing to re-analyze", description: "All reports already have confidence scores or no notes." });
                        return;
                      }
                      setReanalyzing(true);
                      setReanalyzeProgress({ done: 0, total: toAnalyze.length });
                      for (let i = 0; i < toAnalyze.length; i++) {
                        try {
                          await apiRequest("POST", `/api/cv-reports/reanalyze/${toAnalyze[i].id}`);
                        } catch {}
                        setReanalyzeProgress({ done: i + 1, total: toAnalyze.length });
                      }
                      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
                      setReanalyzing(false);
                      toast({ title: "Re-analysis complete", description: `Analyzed ${toAnalyze.length} reports.` });
                    }}
                  >
                    {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {reanalyzing ? `Re-analyzing ${reanalyzeProgress.done}/${reanalyzeProgress.total}` : "Re-analyze"}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    data-testid="button-check-duplicates"
                    disabled={checkingDuplicates || fetchingCaseData || !reports || reports.length === 0}
                    onClick={async () => {
                      setCheckingDuplicates(true);
                      setActiveTaskId("check-duplicates");
                      setTaskProgress({ current: 0, total: 0, stage: "Starting..." });
                      try {
                        const res = await apiRequest("POST", "/api/cv-reports/check-duplicates");
                        const data = await res.json();
                        queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
                        toast({ title: `Duplicates: ${data.duplicatesFound} found, ${data.emailsFound} emails fetched from PT Finder` });
                      } catch (err: any) {
                        toast({ title: "Check failed", description: err.message, variant: "destructive" });
                      } finally {
                        setCheckingDuplicates(false);
                        setActiveTaskId(null);
                        setTaskProgress({ current: 0, total: 0, stage: "" });
                      }
                    }}
                  >
                    {checkingDuplicates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    {checkingDuplicates ? "Checking..." : "Check Duplicate"}
                  </button>
                  {can("cv-report", "push-sheets") && isGSheetsReady && (
                    <>
                      <button
                        className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        data-testid="button-push-gsheets"
                        disabled={pushMutation.isPending || (reports || []).length === 0}
                        onClick={() => {
                          const ids = selectedIds.size > 0
                            ? Array.from(selectedIds)
                            : (reports || []).map((r) => r.id);
                          pushMutation.mutate(ids);
                        }}
                      >
                        {pushMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {selectedIds.size > 0 ? `Push ${selectedIds.size} to Sheets` : "Push All to Sheets"}
                      </button>
                      {selectedIds.size > 0 && (() => {
                        const sentIds = Array.from(selectedIds).filter((id) => {
                          const r = (reports || []).find((rr) => rr.id === id);
                          return r?.sentToSheet === "yes";
                        });
                        return sentIds.length > 0 ? (
                          <button
                            className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                            data-testid="button-undo-push-gsheets"
                            disabled={undoPushMutation.isPending}
                            onClick={() => undoPushMutation.mutate(sentIds)}
                          >
                            {undoPushMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                            Undo {sentIds.length} from Sheets
                          </button>
                        ) : null;
                      })()}
                    </>
                  )}
                  <div className="border-t my-1" />
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Data</p>
                  <button
                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    data-testid="button-export-csv"
                    disabled={!reports || reports.length === 0}
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  <button
                    className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    data-testid="button-import-csv"
                    onClick={() => { setImportDialogOpen(true); setImportRows([]); setImportErrors({}); setImportFileName(""); }}
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </button>
                  {can("cv-report", "delete") && (
                    <>
                      <div className="border-t my-1" />
                      <button
                        className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors text-destructive"
                        data-testid="button-delete-all"
                        onClick={() => { setDeleteAllConfirmOpen(true); setDeleteAllConfirmText(""); }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete All
                      </button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          <Dialog open={deleteAllConfirmOpen} onOpenChange={(open) => { setDeleteAllConfirmOpen(open); if (!open) setDeleteAllConfirmText(""); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete All Reports</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>ALL</strong> CV reports. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">Type <strong>DELETE ALL</strong> to confirm:</p>
                <Input
                  data-testid="input-delete-all-confirm"
                  value={deleteAllConfirmText}
                  onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                  placeholder="Type DELETE ALL"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteAllConfirmOpen(false); setDeleteAllConfirmText(""); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  data-testid="button-confirm-delete-all"
                  disabled={deleteAllConfirmText !== "DELETE ALL" || deleteAllMutation.isPending}
                  onClick={() => deleteAllMutation.mutate()}
                >
                  {deleteAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Delete All Reports
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {can("cv-report", "add") && (
              <DialogTrigger asChild>
                <Button data-testid="button-add-report" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Report
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{editingId !== null ? "Edit Report" : "Add New Report"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                {COLUMNS.filter((col) => col.key !== "sentToSheet").map((col) => (
                  <div key={col.key} className="space-y-1">
                    <Label htmlFor={col.key}>{col.label}</Label>
                    {col.key === "productType" ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {(form[col.key] || "").split(", ").filter(Boolean).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs px-2 py-0.5 flex items-center gap-1">
                              {s}
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => {
                                  const current = (form[col.key] || "").split(", ").filter(Boolean);
                                  setForm((f) => ({ ...f, [col.key]: current.filter((v) => v !== s).join(", ") }));
                                }}
                              />
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded-md p-2">
                          {PRODUCT_TYPE_OPTIONS.map((opt) => {
                            const current = (form[col.key] || "").split(", ").filter(Boolean);
                            const isSelected = current.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const next = isSelected
                                    ? current.filter((v) => v !== opt)
                                    : [...current, opt];
                                  setForm((f) => ({ ...f, [col.key]: next.join(", ") }));
                                }}
                                data-testid={`form-product-${opt}`}
                                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                              >
                                <Checkbox checked={isSelected} className="pointer-events-none" />
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : col.key === "reason" ? (
                      <Select
                        value={form[col.key] || ""}
                        onValueChange={(val) => setForm((f) => ({ ...f, [col.key]: val === "__clear__" ? "" : val, subReason: val === "__clear__" ? f.subReason : f.subReason }))}
                      >
                        <SelectTrigger id={col.key} data-testid={`input-${col.key}`}>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__clear__">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {ALL_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.key === "subReason" ? (
                      <Select
                        value={form[col.key] || ""}
                        onValueChange={(val) => setForm((f) => ({ ...f, [col.key]: val === "__clear__" ? "" : val }))}
                      >
                        <SelectTrigger id={col.key} data-testid={`input-${col.key}`}>
                          <SelectValue placeholder="Select sub-reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__clear__">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {(form.reason && REASON_SUBREASON_MAP[form.reason]
                            ? REASON_SUBREASON_MAP[form.reason]
                            : ALL_SUB_REASONS
                          ).map((sr) => (
                            <SelectItem key={sr} value={sr}>{sr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.key === "desiredAction" ? (
                      <Select
                        value={form[col.key] || ""}
                        onValueChange={(val) => setForm((f) => ({ ...f, [col.key]: val === "__clear__" ? "" : val }))}
                      >
                        <SelectTrigger id={col.key} data-testid={`input-${col.key}`}>
                          <SelectValue placeholder="Select desired action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__clear__">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {DESIRED_ACTION_OPTIONS.map((a) => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.key === "clientThreat" ? (
                      <Select
                        value={form[col.key] || ""}
                        onValueChange={(val) => setForm((f) => ({ ...f, [col.key]: val === "__clear__" ? "" : val }))}
                      >
                        <SelectTrigger id={col.key} data-testid={`input-${col.key}`}>
                          <SelectValue placeholder="Select client threat" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__clear__">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {CLIENT_THREAT_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.key === "checkingStatus" ? (
                      <Select
                        value={form[col.key] || "Need Check"}
                        onValueChange={(val) => setForm((f) => ({ ...f, [col.key]: val }))}
                      >
                        <SelectTrigger id={col.key} data-testid={`input-${col.key}`}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKING_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={col.key}
                        data-testid={`input-${col.key}`}
                        value={form[col.key]}
                        onChange={(e) => setForm((f) => ({ ...f, [col.key]: e.target.value }))}
                        placeholder={col.label}
                      />
                    )}
                  </div>
                ))}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                  data-testid="button-submit-report"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingId !== null ? "Update Report" : "Add Report"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {(fetchingCaseData || checkingDuplicates) && taskProgress.total > 0 && (
          <div className="mb-3 p-3 bg-card border rounded-lg" data-testid="progress-bar-container">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{taskProgress.stage}</span>
              <span className="text-xs font-medium">{Math.round((taskProgress.current / taskProgress.total) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((taskProgress.current / taskProgress.total) * 100)}%` }}
                data-testid="progress-bar-fill"
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{taskProgress.current} / {taskProgress.total}</div>
          </div>
        )}

        <Card>
          <CardHeader className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5 text-muted-foreground font-medium">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Reports
              </CardTitle>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-column-settings"
                      className="text-xs"
                    >
                      <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                      Columns
                      {hiddenColumns.size > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                          {hiddenColumns.size} hidden
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">Toggle Columns</p>
                      {hiddenColumns.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          data-testid="button-show-all-columns"
                          onClick={() => {
                            setHiddenColumns(new Set());
                            localStorage.removeItem("cv-report-hidden-columns");
                          }}
                        >
                          Show All
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          onClick={() => toggleColumnVisibility(col.key)}
                          data-testid={`toggle-column-${col.key}`}
                          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors cursor-pointer"
                        >
                          {hiddenColumns.has(col.key) ? (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className={hiddenColumns.has(col.key) ? "text-muted-foreground" : ""}>
                            {col.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder((prev) => prev === "last-first" ? "first-last" : "last-first")}
                  data-testid="button-sort-order"
                  className="text-xs"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                  {sortOrder === "last-first" ? "Last to First" : "First to Last"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive text-center py-8" data-testid="text-reports-error">
                Failed to load reports
              </p>
            ) : (reports || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No reports yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Click "Add Report" to create your first CV report entry.
                </p>
              </div>
            ) : (() => {
              const filteredReports = (reports || []).filter((report) => {
                if (filterBrokenLinks) {
                  const link = report.link || "";
                  const isBroken = !link || !link.startsWith("http") || /\[\u2026\]|\.\.\.|…/.test(link);
                  if (!isBroken) return false;
                }
                if (filterStatuses.length > 0 && !filterStatuses.includes(report.status || "")) return false;
                if (filterCheckingStatus !== "all" && (report.checkingStatus || "Need Check") !== filterCheckingStatus) return false;
                if (filterSlackStatusRt !== "all") {
                  const val = (report as any).slackStatusRt || "";
                  if (filterSlackStatusRt === "__empty__") { if (val) return false; }
                  else if (val !== filterSlackStatusRt) return false;
                }
                if (filterAssignedTo === "unassigned" && report.assignedTo) return false;
                if (filterAssignedTo !== "all" && filterAssignedTo !== "unassigned" && report.assignedTo !== filterAssignedTo) return false;
                if (filterDate) {
                  const reportDate = (report.date || "").trim();
                  if (!reportDate) return false;
                  const parts = reportDate.replace(/\//g, "-").split("-");
                  let reportYmd = "";
                  if (parts.length === 3) {
                    if (parts[0].length === 4) {
                      reportYmd = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                    } else {
                      let year = parts[2];
                      if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
                      reportYmd = `${year}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
                    }
                  }
                  if (reportYmd !== filterDate) return false;
                }
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return COLUMNS.some((col) => {
                  const val = (report as any)[col.key];
                  return val && String(val).toLowerCase().includes(query);
                }) || String(report.id).includes(query);
              });
              const allReports = sortOrder === "first-last"
                ? [...filteredReports].sort((a, b) => a.id - b.id)
                : [...filteredReports].sort((a, b) => b.id - a.id);
              const totalPages = Math.max(1, Math.ceil(allReports.length / pageSize));
              const safePage = Math.min(currentPage, totalPages);
              const startIdx = (safePage - 1) * pageSize;
              const pageReports = allReports.slice(startIdx, startIdx + pageSize);

              return (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(isGSheetsReady || user?.role === "admin") && (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={pageReports.length > 0 && pageReports.every((r) => selectedIds.has(r.id))}
                                onCheckedChange={() => toggleSelectAll(pageReports.map((r) => r.id))}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                          )}
                          {visibleColumns.map((col) => (
                            <TableHead key={col.key} className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">
                              {col.label}
                            </TableHead>
                          ))}
                          <TableHead className="w-20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageReports.map((report) => {
                          const checkStatus = report.checkingStatus || "Need Check";
                          const rowBg = selectedIds.has(report.id)
                            ? "bg-muted/50"
                            : checkStatus === "Ready"
                              ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                              : "bg-amber-50/40 dark:bg-amber-950/10";
                          return (
                          <TableRow key={report.id} data-testid={`row-report-${report.id}`} className={`${rowBg} transition-colors`}>
                            {(isGSheetsReady || user?.role === "admin") && (
                              <TableCell className="w-10 py-1.5">
                                <Checkbox
                                  checked={selectedIds.has(report.id)}
                                  onCheckedChange={() => toggleSelect(report.id)}
                                  data-testid={`checkbox-select-${report.id}`}
                                />
                              </TableCell>
                            )}
                            {visibleColumns.map((col) => (
                              <TableCell key={col.key} className="text-[13px] whitespace-nowrap py-1.5">
                                {renderCellContent(report, col)}
                              </TableCell>
                            ))}
                            {(can("cv-report", "edit") || can("cv-report", "delete")) && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {can("cv-report", "edit") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdit(report)}
                                      data-testid={`button-edit-${report.id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {can("cv-report", "delete") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteMutation.mutate(report.id)}
                                      disabled={deleteMutation.isPending}
                                      data-testid={`button-delete-${report.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Rows per page</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(val) => {
                          setPageSize(Number(val));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[70px] h-8" data-testid="select-page-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="ml-2">
                        {startIdx + 1}–{Math.min(startIdx + pageSize, allReports.length)} of {allReports.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage(1)}
                        data-testid="button-first-page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        Page {safePage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        data-testid="button-last-page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open && !importing) setImportDialogOpen(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import CV Reports
            </DialogTitle>
          </DialogHeader>

          {importRows.length === 0 ? (
            <div
              data-testid="import-drop-zone"
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${importDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
              onDragLeave={() => setImportDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImportDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelect(file);
              }}
              onClick={() => importFileRef.current?.click()}
            >
              <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-1">Drag & drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
              <Button variant="outline" size="sm" data-testid="button-browse-file">
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); if (importFileRef.current) importFileRef.current.value = ""; }}
                data-testid="input-import-file"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-import-filename">{importFileName}</span>
                  <Badge variant="secondary" data-testid="text-import-row-count">{importRows.length} rows</Badge>
                  {Object.keys(importErrors).length > 0 && (
                    <Badge variant="destructive" data-testid="text-import-error-count">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {Object.keys(importErrors).length} warnings
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setImportRows([]); setImportErrors({}); setImportFileName(""); }}
                  disabled={importing}
                  data-testid="button-clear-import"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>

              {importing && importProgress.total > 0 && (
                <div className="p-3 bg-card border rounded-lg" data-testid="import-progress-container">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Importing...</span>
                    <span className="text-xs font-medium">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                      data-testid="import-progress-fill"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{importProgress.current} / {importProgress.total} rows</div>
                </div>
              )}

              <div className="flex-1 overflow-auto border rounded-lg max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-xs">#</TableHead>
                      <TableHead className="w-10 text-xs"></TableHead>
                      {IMPORT_COLUMNS.map((col) => (
                        <TableHead key={col} className="text-xs whitespace-nowrap">{IMPORT_LABELS[col] || col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((row, idx) => (
                      <TableRow key={idx} className={importErrors[idx] ? "bg-red-50 dark:bg-red-950/20" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs">
                          {importErrors[idx] ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent side="right"><p className="text-xs max-w-[200px]">{importErrors[idx]}</p></TooltipContent>
                            </Tooltip>
                          ) : (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          )}
                        </TableCell>
                        {IMPORT_COLUMNS.map((col) => (
                          <TableCell key={col} className="text-xs max-w-[150px] truncate" title={row[col] || ""}>
                            {row[col] || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {importRows.length > 0 && (
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {Object.keys(importErrors).length > 0
                  ? `${importRows.length - Object.keys(importErrors).length} valid rows will be imported, ${Object.keys(importErrors).length} rows have warnings and may be skipped`
                  : `${importRows.length} rows ready to import`}
              </p>
              <Button
                onClick={handleImportSubmit}
                disabled={importing}
                data-testid="button-submit-import"
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? "Importing..." : `Import ${importRows.length} Rows`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>


    </TooltipProvider>
  );
}
