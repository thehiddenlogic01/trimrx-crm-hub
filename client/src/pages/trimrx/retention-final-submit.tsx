import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_REASONS, REASON_SUBREASON_MAP, ALL_SUB_REASONS, DESIRED_ACTION_OPTIONS, CLIENT_THREAT_OPTIONS, getReasonForSubReason } from "@shared/classification";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SendHorizonal, Search, Loader2, ExternalLink, FileSpreadsheet,
  Eye, EyeOff, CheckCircle2, MessageSquare, CheckSquare, XCircle,
  Send, MessageCircle, ChevronUp, ChevronDown, CreditCard, DollarSign,
  AlertCircle, FileText, CornerDownRight, Undo2, Trash2, Check, X,
  ChevronLeft, ChevronRight, Pencil, Clock, AlertTriangle, RefreshCw,
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
  { key: "sendToSheet", label: "" },
  { key: "slackAction", label: "Slack Action" },
  { key: "caseId", label: "Case ID" },
  { key: "status", label: "Case Status" },
  { key: "link", label: "Link" },
  { key: "duplicated", label: "Duplicated" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "notesTrimrx", label: "Notes TrimRX" },
  { key: "slackUpdate", label: "Slack Update" },
  { key: "productType", label: "Product Type" },
  { key: "slackStatusRt", label: "Slack Status (RT)" },
  { key: "clientThreat", label: "Client Threat" },
  { key: "reason", label: "Reason" },
  { key: "subReason", label: "Sub-reason" },
  { key: "desiredAction", label: "Desired Action" },
] as const;

type ColumnKey = typeof COLUMNS[number]["key"];

const PRODUCT_TYPE_OPTIONS = ["1M", "3M Bundle", "6M Bundle", "12M Bundle", "Supplement", "Upsell", "NAD+", "Zofran", "Sermorelin", "Semaglutide", "Tirzepatide"];
const SLACK_STATUS_RT_FALLBACK = ["Send", "Managed by K/E"];

const TEXT_EDITABLE_KEYS: ColumnKey[] = ["customerEmail", "name", "notesTrimrx"];

function optimisticUpdate(reportId: number, colKey: ColumnKey, newValue: string) {
  const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
  if (prev) {
    queryClient.setQueryData<CvReport[]>(["/api/cv-reports"],
      prev.map((r) => r.id === reportId ? { ...r, [colKey]: newValue } : r)
    );
  }
  return prev;
}

function InlineTextCell({ reportId, colKey, value }: { reportId: number; colKey: ColumnKey; value: string }) {
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
      const prev = optimisticUpdate(reportId, colKey, newValue);
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

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
          className="h-6 text-xs px-2 py-0"
          disabled={updateMutation.isPending}
          data-testid={`inline-input-${colKey}-${reportId}`}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSave} disabled={updateMutation.isPending} data-testid={`inline-save-${colKey}-${reportId}`}>
          {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCancel} disabled={updateMutation.isPending} data-testid={`inline-cancel-${colKey}-${reportId}`}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  const displaySpan = (
    <span
      className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors inline-block truncate max-w-[180px] text-[13px]"
      onClick={() => { setEditValue(value); setEditing(true); }}
      data-testid={`inline-edit-${colKey}-${reportId}`}
    >
      {value || "—"}
    </span>
  );

  if (colKey === "notesTrimrx" && value) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{displaySpan}</TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-[350px] whitespace-pre-wrap text-xs leading-relaxed bg-amber-50 text-amber-950 border border-amber-300 shadow-md p-3 rounded-md dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700">
          <p>{value}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return displaySpan;
}

function InlineDropdownCell({ reportId, colKey, value, options }: { reportId: number; colKey: ColumnKey; value: string; options: string[] }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { [colKey]: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticUpdate(reportId, colKey, newValue);
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

function InlineSubReasonDropdownCell({ reportId, value }: { reportId: number; value: string }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newSubReason: string) => {
      const parentReason = newSubReason ? getReasonForSubReason(newSubReason) : null;
      const body: Record<string, string> = { subReason: newSubReason };
      if (parentReason) body.reason = parentReason;
      if (!newSubReason) body.reason = "";
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, body);
      return await res.json();
    },
    onMutate: (newSubReason: string) => {
      queryClient.cancelQueries({ queryKey: ["/api/cv-reports"] });
      const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
      if (prev) {
        const parentReason = newSubReason ? getReasonForSubReason(newSubReason) : null;
        queryClient.setQueryData<CvReport[]>(["/api/cv-reports"],
          prev.map((r) => r.id === reportId ? { ...r, subReason: newSubReason, ...(parentReason ? { reason: parentReason } : newSubReason ? {} : { reason: "" }) } : r)
        );
      }
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
        const newVal = val === "__clear__" ? "" : val;
        if (newVal !== value) {
          updateMutation.mutate(newVal);
        }
      }}
    >
      <SelectTrigger
        className="h-6 text-xs px-2 py-0 min-w-[100px] border-dashed"
        data-testid={`select-subReason-${reportId}`}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__">
          <span className="text-muted-foreground">Clear</span>
        </SelectItem>
        {Object.entries(REASON_SUBREASON_MAP).map(([reason, subs]) => (
          <div key={reason}>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{reason}</div>
            {subs.map((sub) => (
              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

function SheetNotesEditor({ reportId, value, onUpdated }: { reportId: number; value: string; onUpdated: (v: string) => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => { setEditValue(value); }, [value]);

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { notesTrimrx: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticUpdate(reportId, "notesTrimrx", newValue);
      onUpdated(newValue);
      setEditing(false);
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update notes", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  if (editing) {
    return (
      <div className="space-y-2" data-testid="sheet-notes-editor">
        <label className="text-xs font-medium text-muted-foreground">Notes TrimRX</label>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="text-xs min-h-[80px] resize-y"
          data-testid="input-sheet-notes"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => updateMutation.mutate(editValue)}
            disabled={updateMutation.isPending}
            data-testid="button-save-sheet-notes"
          >
            {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setEditValue(value); setEditing(false); }}
            disabled={updateMutation.isPending}
            data-testid="button-cancel-sheet-notes"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer rounded-md border border-transparent hover:border-border p-2 -m-2 transition-colors"
      onClick={() => setEditing(true)}
      data-testid="display-sheet-notes"
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-medium text-muted-foreground">Notes TrimRX</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground">
        {value || <span className="text-muted-foreground italic">No notes — click to add</span>}
      </p>
    </div>
  );
}

function SheetSlackStatusEditor({ reportId, value, options, onUpdated }: { reportId: number; value: string; options: string[]; onUpdated: (v: string) => void }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { slackStatusRt: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticUpdate(reportId, "slackStatusRt", newValue);
      onUpdated(newValue);
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  return (
    <div className="flex items-center gap-2" data-testid="sheet-slack-status-editor">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Slack Status</span>
      <Select
        value={value || ""}
        onValueChange={(val) => {
          const newVal = val === "__clear__" ? "" : val;
          if (newVal !== value) updateMutation.mutate(newVal);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-[160px]" data-testid="select-sheet-slack-status">
          <SelectValue placeholder="— Select —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__"><span className="text-muted-foreground">Clear</span></SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

function SheetSubReasonEditor({ reportId, value, onUpdated }: { reportId: number; value: string; onUpdated: (v: string, reason: string) => void }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newSubReason: string) => {
      const parentReason = newSubReason ? getReasonForSubReason(newSubReason) : null;
      const body: Record<string, string> = { subReason: newSubReason };
      if (parentReason) body.reason = parentReason;
      if (!newSubReason) body.reason = "";
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, body);
      return await res.json();
    },
    onMutate: (newSubReason: string) => {
      const parentReason = newSubReason ? getReasonForSubReason(newSubReason) : null;
      const prev = queryClient.getQueryData<CvReport[]>(["/api/cv-reports"]);
      if (prev) {
        queryClient.setQueryData<CvReport[]>(["/api/cv-reports"],
          prev.map((r) => r.id === reportId ? { ...r, subReason: newSubReason, ...(parentReason ? { reason: parentReason } : newSubReason ? {} : { reason: "" }) } : r)
        );
      }
      onUpdated(newSubReason, parentReason || (newSubReason ? "" : ""));
      return { prev };
    },
    onError: (err: Error, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/cv-reports"], context.prev);
      toast({ title: "Failed to update sub-reason", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    },
  });

  return (
    <div className="flex items-center gap-2" data-testid="sheet-sub-reason-editor">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Sub-Reason</span>
      <Select
        value={value || ""}
        onValueChange={(val) => {
          const newVal = val === "__clear__" ? "" : val;
          if (newVal !== value) updateMutation.mutate(newVal);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-[200px]" data-testid="select-sheet-sub-reason">
          <SelectValue placeholder="— Select —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__"><span className="text-muted-foreground">Clear</span></SelectItem>
          {Object.entries(REASON_SUBREASON_MAP).map(([reason, subs]) => (
            <div key={reason}>
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{reason}</div>
              {subs.map((sub) => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

function InlineMultiDropdownCell({ reportId, colKey, value, options }: { reportId: number; colKey: ColumnKey; value: string; options: string[] }) {
  const { toast } = useToast();
  const selected = useMemo(() => value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [], [value]);

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await apiRequest("PATCH", `/api/cv-reports/${reportId}`, { [colKey]: newValue });
      return await res.json();
    },
    onMutate: (newValue: string) => {
      const prev = optimisticUpdate(reportId, colKey, newValue);
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

  function toggle(opt: string) {
    const newSelected = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    updateMutation.mutate(newSelected.join(", "));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-xs px-2 py-0 min-w-[100px] border-dashed justify-start font-normal" data-testid={`multi-select-${colKey}-${reportId}`}>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-0.5">
              {selected.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] px-1 py-0 h-4">{s}</Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="h-3.5 w-3.5" />
              {opt}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PIActivityIconRet({ icon, type }: { icon: string; type: string }) {
  const size = "h-3.5 w-3.5";
  if (type === "succeeded") return <CheckCircle2 className={`${size} text-green-600`} />;
  if (type === "failed" || type === "error") return <XCircle className={`${size} text-red-500`} />;
  if (type === "canceled") return <XCircle className={`${size} text-muted-foreground`} />;
  if (icon === "alert" || type === "requires_action") return <AlertTriangle className={`${size} text-yellow-500`} />;
  if (type === "refunded") return <RefreshCw className={`${size} text-blue-500`} />;
  if (type === "disputed") return <AlertCircle className={`${size} text-amber-500`} />;
  return <Clock className={`${size} text-muted-foreground`} />;
}

function PIActivityInlineRet({ piId }: { piId: string }) {
  const { data, isLoading, error } = useQuery<{ activity: any[] }>({
    queryKey: ["/api/stripe-payments/pi-activity", piId],
    queryFn: async () => {
      const res = await fetch(`/api/stripe-payments/pi-activity/${piId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
  });
  if (isLoading) return <div className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading activity...</div>;
  if (error || !data?.activity?.length) return <div className="py-1 px-3 text-[10px] text-muted-foreground italic">No recent activity</div>;
  return (
    <div className="px-3 py-2">
      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recent Activity</h5>
      <div className="relative pl-5 space-y-1.5">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        {data.activity.map((item: any, idx: number) => (
          <div key={idx} className="relative flex items-start gap-2">
            <div className="absolute -left-5 top-0.5 bg-background p-0.5">
              <PIActivityIconRet icon={item.icon} type={item.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground leading-tight">{item.title}</p>
              {item.description && <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{item.description}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(item.timestamp).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Guatemala" })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentIntentsButton({ msg }: { msg: SlackMessage }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [expandedPopupPiId, setExpandedPopupPiId] = useState<string | null>(null);
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
    if (s === "succeeded" || s === "active") return "text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300";
    if (s === "canceled" || s === "failed" || s === "incomplete_expired") return "text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300";
    if (s === "past_due" || s === "unpaid" || s === "requires_payment_method" || s === "requires_action") return "text-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300";
    if (s === "trialing") return "text-blue-700 bg-blue-100 dark:bg-blue-900 dark:text-blue-300";
    if (s === "paused") return "text-orange-700 bg-orange-100 dark:bg-orange-900 dark:text-orange-300";
    return "text-foreground bg-muted";
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
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

                  {/* Current Subscription Status — prominent summary */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 border-b flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Current Subscription Status</span>
                    </div>
                    {data.subscriptions?.length > 0 ? (
                      <div className="divide-y">
                        {data.subscriptions.map((sub: any) => (
                          <div key={sub.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`text-xs font-semibold ${statusColor(sub.status)}`}>
                                  {sub.status.toUpperCase()}
                                </Badge>
                                {sub.cancelAtPeriodEnd && (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                    Cancels at period end
                                  </Badge>
                                )}
                              </div>
                              {sub.items?.map((item: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground">
                                  {item.productName !== "Unknown" ? item.productName : ""}{" "}
                                  ${item.amount.toFixed(2)} {item.currency}/{item.interval}
                                </div>
                              ))}
                              {sub.currentPeriodEnd && (
                                <div className="text-xs text-muted-foreground">
                                  Period ends: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                              Since {new Date(sub.created).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground italic">No subscriptions found for this customer</div>
                    )}
                  </div>

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
                            {data.paymentIntents.map((pi: any) => {
                              const displayStatus = pi.lastError && pi.status !== "succeeded" ? "failed" : pi.status;
                              const isExpanded = expandedPopupPiId === pi.id;
                              return (
                                <Fragment key={pi.id}>
                                  <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedPopupPiId(isExpanded ? null : pi.id)}>
                                    <td className="p-2 text-xs whitespace-nowrap">{new Date(pi.created).toLocaleString("en-US", { timeZone: "America/Guatemala" })}</td>
                                    <td className="p-2 whitespace-nowrap font-medium">
                                      <div>${pi.amount.toFixed(2)} {pi.currency}</div>
                                      {pi.refunded && pi.amountRefunded > 0 && (
                                        <div className="text-xs text-red-600">−${pi.amountRefunded.toFixed(2)} refunded</div>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      <div className="flex flex-col gap-1">
                                        <Badge variant="outline" className={statusColor(displayStatus)}>
                                          {displayStatus === "succeeded" && "✓ "}{displayStatus}
                                        </Badge>
                                        {pi.refunded && (
                                          <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-300 text-xs">
                                            ↩ Refunded
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">
                                      <div className="flex items-center gap-1">
                                        {pi.description || "—"}
                                        {isExpanded ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={4} className="bg-muted/20 border-t">
                                        <PIActivityInlineRet piId={pi.id} />
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
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

function extractUserIds(text: string): string[] {
  const ids: string[] = [];
  const re = /<@([A-Za-z0-9]+)(?:\|[^>]*)?>/g;
  let m;
  while ((m = re.exec(text)) !== null) ids.push(m[1]);
  return ids;
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
  const [expandedThread, setExpandedThread] = useState<string | null>(msg.reply_count > 0 ? msg.ts : null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [extraUsers, setExtraUsers] = useState<Record<string, SlackUser>>({});

  const enrichedUsers = useMemo(() => ({ ...users, ...extraUsers }), [users, extraUsers]);

  const checked = hasCheckmark(msg.reactions);
  const threadTs = msg.thread_ts || msg.ts;
  const isExpanded = expandedThread === msg.ts;
  const isReplying = replyingTo === msg.ts;
  const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${CHANNEL_ID}/p${msg.ts.replace(".", "")}`;

  const getUserName = useCallback((id: string) => enrichedUsers[id]?.real_name || enrichedUsers[id]?.name || id, [enrichedUsers]);
  const getUserAvatar = useCallback((id: string) => enrichedUsers[id]?.avatar || "", [enrichedUsers]);

  const isReply = msg.thread_ts && msg.thread_ts !== msg.ts;
  const parentPreview = msg.parent_text
    ? msg.parent_text.replace(/<@[A-Z0-9]+>/g, "").replace(/<[^>]+>/g, "").replace(/\*/g, "").trim().slice(0, 120)
    : "";

  const [localChecked, setLocalChecked] = useState(checked);
  const [lastReply, setLastReply] = useState<{ user: string; text: string; ts: string } | null>(null);

  useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  useEffect(() => {
    if (msg.reply_count > 0) {
      setExpandedThread(msg.ts);
    } else {
      setExpandedThread(null);
    }
  }, [msg.reply_count, msg.ts]);

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

  const getUserNameStr = useCallback((id: string) => enrichedUsers[id]?.real_name || enrichedUsers[id]?.name || id, [enrichedUsers]);

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

  const deleteReplyMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("DELETE", `/api/slack/channels/${CHANNEL_ID}/messages/${timestamp}`);
    },
    onSuccess: () => {
      toast({ title: "Reply deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts] });
    },
    onError: (err: any) => toast({ title: "Failed to delete reply", description: err.message, variant: "destructive" }),
  });

  const replyReactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/react`, { timestamp, name: "white_check_mark" });
    },
    onSuccess: (_d, vars) => {
      toast({ title: "Reaction added" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts] });
    },
    onError: (err: any) => toast({ title: "Failed to react", description: err.message, variant: "destructive" }),
  });

  const replyUnreactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/unreact`, { timestamp, name: "white_check_mark" });
    },
    onSuccess: (_d, vars) => {
      toast({ title: "Reaction removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts] });
    },
    onError: (err: any) => toast({ title: "Failed to remove reaction", description: err.message, variant: "destructive" }),
  });

  const { data: threadReplies, isLoading: loadingReplies } = useQuery<ThreadReply[]>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/replies/${msg.ts}?force=1`, { signal });
      if (!res.ok) throw new Error("Failed to fetch replies");
      return res.json();
    },
    enabled: msg.reply_count > 0 || !!lastReply,
    retry: 1,
    staleTime: 30 * 1000,
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

  useEffect(() => {
    const allTexts = [msg.text, ...(threadReplies || []).map((r) => r.text)];
    const allSenders = [msg.user, ...(threadReplies || []).map((r) => r.user)];
    const mentionedIds = allTexts.flatMap(extractUserIds);
    const allIds = [...new Set([...allSenders, ...mentionedIds])];
    const missing = allIds.filter((id) => !enrichedUsers[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetch("/api/slack/users/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: missing }),
    })
      .then((res) => res.ok ? res.json() : {})
      .then((resolved) => {
        if (!cancelled && Object.keys(resolved).length > 0) {
          setExtraUsers((prev) => ({ ...prev, ...resolved }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [msg.text, msg.user, threadReplies, users]);

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
        dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, enrichedUsers) }}
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
            threadReplies.map((reply, idx) => {
              const replyHasCheck = reply.reactions?.some((r) => r.name === "white_check_mark");
              return (
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
                      dangerouslySetInnerHTML={{ __html: formatSlackText(reply.text, enrichedUsers) }}
                    />
                    {reply.reactions && reply.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {reply.reactions.map((r) => (
                          <span key={r.name} className="inline-flex items-center gap-0.5 text-xs bg-muted/60 rounded px-1.5 py-0.5">
                            {SLACK_EMOJI[r.name] || `:${r.name}:`} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {replyHasCheck ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600 hover:text-red-500"
                        onClick={() => replyUnreactMutation.mutate({ timestamp: reply.ts })}
                        disabled={replyUnreactMutation.isPending}
                        data-testid={`button-unreact-reply-${reply.ts}`}
                        title="Remove checkmark"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-green-600"
                        onClick={() => replyReactMutation.mutate({ timestamp: reply.ts })}
                        disabled={replyReactMutation.isPending}
                        data-testid={`button-react-reply-${reply.ts}`}
                        title="Mark as done"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {can("slack-messages", "delete-message") && reply.bot_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm("Delete this reply?")) deleteReplyMutation.mutate({ timestamp: reply.ts }); }}
                        disabled={deleteReplyMutation.isPending}
                        data-testid={`button-delete-reply-${reply.ts}`}
                        title="Delete reply"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">No replies yet</p>
          )}
        </div>
      )}
    </div>
  );
}

const persistentSlackCache: Record<string, SlackMessage[] | null> = {};

const SLACK_ACTIONS_STORAGE_KEY = "retention-slack-actions";
function loadSlackActions(): Record<string, SlackActionInfo> {
  try {
    const saved = localStorage.getItem(SLACK_ACTIONS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}
function saveSlackActions(actions: Record<string, SlackActionInfo>) {
  try {
    localStorage.setItem(SLACK_ACTIONS_STORAGE_KEY, JSON.stringify(actions));
  } catch {}
}
function saveSlackAction(key: string, info: SlackActionInfo) {
  const all = loadSlackActions();
  all[key] = info;
  saveSlackActions(all);
}

export default function RetentionFinalSubmitPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return localStorage.getItem("retention-searchQuery") || ""; } catch { return ""; }
  });
  const [filterDate, setFilterDate] = useState<string>(() => {
    try { return localStorage.getItem("retention-filterDate") || ""; } catch { return ""; }
  });
  const [currentPage, setCurrentPage] = useState(() => {
    try { const v = localStorage.getItem("retention-currentPage"); return v ? Number(v) : 1; } catch { return 1; }
  });
  const [pageSize, setPageSize] = useState(() => {
    try { const v = localStorage.getItem("retention-pageSize"); return v ? Number(v) : 10; } catch { return 10; }
  });
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(() => {
    try {
      const saved = localStorage.getItem("retention-final-hidden-columns");
      if (saved) return new Set(JSON.parse(saved) as ColumnKey[]);
    } catch {}
    return new Set<ColumnKey>();
  });
  const [slackStatusFilter, setSlackStatusFilter] = useState<string>(() => {
    try {
      return localStorage.getItem("retention-slack-status-filter") || "";
    } catch { return ""; }
  });
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>(() => {
    if (!isAdmin && user?.username) return user.username;
    try {
      return localStorage.getItem("retention-filter-assigned-to") || "all";
    } catch { return "all"; }
  });
  useEffect(() => {
    if (user && !isAdmin && user.username) {
      setFilterAssignedTo(user.username);
    }
  }, [user, isAdmin]);
  useEffect(() => { localStorage.setItem("retention-searchQuery", searchQuery); }, [searchQuery]);
  useEffect(() => { localStorage.setItem("retention-filterDate", filterDate); }, [filterDate]);
  useEffect(() => { localStorage.setItem("retention-currentPage", String(currentPage)); }, [currentPage]);
  useEffect(() => { localStorage.setItem("retention-pageSize", String(pageSize)); }, [pageSize]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedReport, setSelectedReport] = useState<CvReport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastOpenedId, setLastOpenedId] = useState<number | null>(null);
  const lastOpenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slackCache, setSlackCache] = useState<Record<string, SlackMessage[] | null>>(persistentSlackCache);
  const [slackLoading, setSlackLoading] = useState<Record<string, boolean>>({});
  const [slackActions, setSlackActions] = useState<Record<string, SlackActionInfo>>(() => loadSlackActions());
  const [sheetSending, setSheetSending] = useState<Record<number, boolean>>({});

  const { data: allReports, isLoading } = useQuery<CvReport[]>({
    queryKey: ["/api/cv-reports"],
  });

  const { data: crmUsers } = useQuery<{ id: string; username: string }[]>({
    queryKey: ["/api/users"],
  });

  const { data: slackUsers } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/users"],
    queryFn: async () => {
      const res = await fetch("/api/slack/users");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const readyReports = (allReports || []).filter((r) => r.checkingStatus === "Ready");

  const filterRelevantMessages = useCallback((messages: SlackMessage[]): SlackMessage[] => {
    if (messages.length <= 1) return messages;
    const users = queryClient.getQueryData<Record<string, SlackUser>>(["/api/slack/users"]) || {};
    const targetIds: string[] = [];
    for (const [id, u] of Object.entries(users)) {
      const allNames = `${(u.real_name || "").toLowerCase()} ${(u.name || "").toLowerCase()}`;
      if ((allNames.includes("karla") && allNames.includes("garibay")) ||
          (allNames.includes("olia") && allNames.includes("orlowska"))) {
        targetIds.push(id);
      }
    }
    if (targetIds.length === 0) return messages;
    const filtered = messages.filter((msg) => {
      const text = msg.text || "";
      return targetIds.some((id) => text.includes(`<@${id}>`)) ||
        text.toLowerCase().includes("karla garibay") ||
        text.toLowerCase().includes("olia orlowska");
    });
    return filtered.length > 0 ? filtered : messages;
  }, []);

  const fetchSlackMessages = useCallback(async (report: CvReport): Promise<SlackMessage[] | null> => {
    const query = buildSearchQuery(report);
    if (!query) return null;
    try {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const messages: SlackMessage[] = Array.isArray(data) ? data : (data.messages || []);
      if (messages.length > 0) return filterRelevantMessages(messages);
      return null;
    } catch {
      return null;
    }
  }, [filterRelevantMessages]);

  const handleSlackClick = async (report: CvReport) => {
    const key = String(report.id);
    setSelectedReport(report);
    setSheetOpen(true);

    if (persistentSlackCache[key] !== undefined && persistentSlackCache[key] !== null) {
      setSlackCache((prev) => ({ ...prev, [key]: persistentSlackCache[key] }));
    }
    const savedActions = loadSlackActions();
    if (savedActions[key]) {
      setSlackActions((prev) => ({ ...prev, [key]: savedActions[key] }));
    }

    setSlackLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const msgs = await fetchSlackMessages(report);
      persistentSlackCache[key] = msgs;
      setSlackCache((prev) => ({ ...prev, [key]: msgs }));

      if (msgs && msgs.length > 0) {
        const firstMsg = msgs[0];
        const isChecked = msgs.some((m) => hasCheckmark(m.reactions));
        let lastReply: { user: string; text: string; ts: string } | null = null;
        if (firstMsg.reply_count && firstMsg.reply_count > 0) {
          try {
            const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/replies/${firstMsg.ts}`);
            if (res.ok) {
              const replies: SlackMessage[] = await res.json();
              const threadReplies = replies.filter((r) => r.ts !== firstMsg.ts);
              if (threadReplies.length > 0) {
                const last = threadReplies[threadReplies.length - 1];
                lastReply = { user: last.user, text: last.text, ts: last.ts };
              }
            }
          } catch {}
        }
        const getUserName = (id: string) => {
          const cached = queryClient.getQueryData<Record<string, SlackUser>>(["/api/slack/users"]);
          return cached?.[id]?.real_name || cached?.[id]?.name || id;
        };
        const actionInfo: SlackActionInfo = {
          checked: isChecked,
          lastReplyUser: lastReply ? getUserName(lastReply.user) : "",
          lastReplyText: lastReply ? lastReply.text : "",
          lastReplyTs: lastReply ? lastReply.ts : "",
        };
        saveSlackAction(key, actionInfo);
        setSlackActions((prev) => ({ ...prev, [key]: actionInfo }));
      } else if (msgs === null) {
        persistentSlackCache[key] = null;
      }
    } catch {
      persistentSlackCache[key] = null;
      setSlackCache((prev) => ({ ...prev, [key]: null }));
    }
    setSlackLoading((prev) => ({ ...prev, [key]: false }));
  };

  const handleSendToSheet = async (report: CvReport) => {
    setSheetSending((prev) => ({ ...prev, [report.id]: true }));
    try {
      await apiRequest("POST", "/api/gsheets/push", {
        reportIds: [report.id],
        sortOrder: "first-last",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: "Added Retention Tracker Successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSheetSending((prev) => ({ ...prev, [report.id]: false }));
    }
  };

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: number[]) {
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  const [undoing, setUndoing] = useState(false);
  const handleUndoPush = async (ids: number[]) => {
    setUndoing(true);
    try {
      await apiRequest("POST", "/api/gsheets/undo-push", { reportIds: ids });
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      setSelectedIds(new Set());
      toast({ title: `Undo successful for ${ids.length} report(s)` });
    } catch (err: any) {
      toast({ title: "Undo failed", description: err.message, variant: "destructive" });
    } finally {
      setUndoing(false);
    }
  };

  const handleBulkSendToSheet = async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const r = readyReports.find((rr) => rr.id === id);
      return r?.sentToSheet !== "yes";
    });
    if (ids.length === 0) return;
    try {
      await apiRequest("POST", "/api/gsheets/push", { reportIds: ids, sortOrder: "first-last" });
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      setSelectedIds(new Set());
      toast({ title: `Added ${ids.length} report(s) to Retention Tracker!` });
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
  };

  const filtered = readyReports.filter((report) => {
    if (slackStatusFilter) {
      if (slackStatusFilter === "__send_pending__") {
        if (report.sentToSheet === "yes") return false;
      } else if (slackStatusFilter === "__added_successfully__") {
        if (report.sentToSheet !== "yes") return false;
      } else {
        const val = (report as any).slackStatusRt || "";
        if (slackStatusFilter === "__empty__") {
          if (val) return false;
        } else if (val !== slackStatusFilter) return false;
      }
    }
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
    const effectiveAssignedTo = (!isAdmin && user?.username) ? user.username : filterAssignedTo;
    if (effectiveAssignedTo !== "all") {
      if (effectiveAssignedTo === "unassigned") {
        if (report.assignedTo) return false;
      } else if (report.assignedTo !== effectiveAssignedTo) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return COLUMNS.some((col) => {
      if (col.key === "slackUpdate" || col.key === "slackAction" || col.key === "sendToSheet") return false;
      const val = (report as any)[col.key];
      return val && String(val).toLowerCase().includes(q);
    });
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDate, slackStatusFilter, filterAssignedTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

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

  const canQuickEdit = can("retention-final-submit", "quick-edit");

  const renderCellContent = (report: CvReport, col: typeof COLUMNS[number]) => {
    if (col.key === "sendToSheet") {
      const sending = sheetSending[report.id];
      const sent = report.sentToSheet === "yes";
      if (sent) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded whitespace-nowrap" data-testid={`sheet-status-${report.id}`}>
              <CheckCircle2 className="h-3 w-3" />
              Added Retention Tracker Successfully!
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => handleUndoPush([report.id])}
              disabled={undoing}
              title="Undo — remove from tracker"
              data-testid={`button-undo-sheet-${report.id}`}
            >
              <Undo2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        );
      }
      return (
        <Button
          variant="default"
          size="sm"
          onClick={() => handleSendToSheet(report)}
          disabled={sending}
          className="h-7 text-xs gap-1 whitespace-nowrap"
          data-testid={`button-send-sheet-${report.id}`}
        >
          {sending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3 w-3" />
          )}
          {sending ? "Sending..." : "Send to Sheet"}
        </Button>
      );
    }
    if (col.key === "slackAction") {
      const key = String(report.id);
      const action = slackActions[key];
      const cached = slackCache[key];

      if (!action && !cached) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      if (!action && cached === null) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      const isChecked = action?.checked ?? (cached ? cached.some((m) => hasCheckmark(m.reactions)) : false);
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

    if (canQuickEdit && TEXT_EDITABLE_KEYS.includes(col.key)) {
      return <InlineTextCell reportId={report.id} colKey={col.key} value={value} />;
    }

    if (col.key === "productType") {
      if (canQuickEdit) return <InlineMultiDropdownCell reportId={report.id} colKey={col.key} value={value} options={PRODUCT_TYPE_OPTIONS} />;
      if (value) {
        const items = value.split(",").map((v: string) => v.trim()).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((item: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{item}</Badge>
            ))}
          </div>
        );
      }
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    if (col.key === "reason") {
      if (canQuickEdit) return <InlineDropdownCell reportId={report.id} colKey={col.key} value={value} options={ALL_REASONS} />;
      return <span className="text-xs">{value || "—"}</span>;
    }

    if (col.key === "subReason") {
      if (canQuickEdit) return <InlineSubReasonDropdownCell reportId={report.id} value={value} />;
      return <span className="text-xs">{value || "—"}</span>;
    }

    if (col.key === "desiredAction") {
      if (canQuickEdit) return <InlineDropdownCell reportId={report.id} colKey={col.key} value={value} options={DESIRED_ACTION_OPTIONS} />;
      return <span className="text-xs">{value || "—"}</span>;
    }

    if (col.key === "slackStatusRt") {
      if (canQuickEdit) return <InlineDropdownCell reportId={report.id} colKey={col.key} value={value} options={SLACK_STATUS_RT_OPTIONS} />;
      return <span className="text-xs">{value || "—"}</span>;
    }

    if (col.key === "clientThreat") {
      if (canQuickEdit) return <InlineDropdownCell reportId={report.id} colKey={col.key} value={value} options={CLIENT_THREAT_OPTIONS} />;
      if (value) {
        const items = value.split(",").map((v: string) => v.trim()).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((item: string, i: number) => (
              <Badge key={i} className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px] px-1.5 py-0">{item}</Badge>
            ))}
          </div>
        );
      }
      return <span className="text-muted-foreground text-xs">—</span>;
    }

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
    if (col.key === "notesTrimrx") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs max-w-[200px] block truncate cursor-default" data-testid={`notes-hover-${report.id}`}>{value || "—"}</span>
          </TooltipTrigger>
          {value && (
            <TooltipContent side="bottom" align="start" className="max-w-[350px] whitespace-pre-wrap text-xs leading-relaxed bg-amber-50 text-amber-950 border border-amber-300 shadow-md p-3 rounded-md dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700">
              <p>{value}</p>
            </TooltipContent>
          )}
        </Tooltip>
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
    if (!value || value === "—") {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    return <span className="text-xs">{value}</span>;
  };

  const selectedKey = selectedReport ? String(selectedReport.id) : "";
  const selectedSlackMsg = selectedKey ? slackCache[selectedKey] : undefined;
  const selectedSlackLoading = selectedKey ? slackLoading[selectedKey] : false;

  return (
    <TooltipProvider delayDuration={300}>
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
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-selected-count">
                    {selectedIds.size} selected
                  </Badge>
                  {(() => {
                    const selectedSent = Array.from(selectedIds).filter((id) => {
                      const r = readyReports.find((rr) => rr.id === id);
                      return r?.sentToSheet === "yes";
                    });
                    const selectedUnsent = Array.from(selectedIds).filter((id) => {
                      const r = readyReports.find((rr) => rr.id === id);
                      return r?.sentToSheet !== "yes";
                    });
                    return (
                      <>
                        {selectedUnsent.length > 0 && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleBulkSendToSheet}
                            data-testid="button-bulk-send-sheet"
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                            Send {selectedUnsent.length} to Sheet
                          </Button>
                        )}
                        {selectedSent.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleUndoPush(selectedSent)}
                            disabled={undoing}
                            data-testid="button-bulk-undo-sheet"
                          >
                            <Undo2 className="h-3 w-3" />
                            Undo {selectedSent.length}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              <Select
                value={slackStatusFilter}
                onValueChange={(val) => {
                  const v = val === "__all__" ? "" : val;
                  setSlackStatusFilter(v);
                  try { localStorage.setItem("retention-slack-status-filter", v); } catch {}
                }}
              >
                <SelectTrigger className={`h-8 text-xs w-[180px] ${slackStatusFilter ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300" : ""}`} data-testid="filter-slack-status-rt">
                  <SelectValue placeholder="All Slack Status (RT)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Slack Status (RT)</SelectItem>
                  <SelectItem value="__send_pending__">Send Pending</SelectItem>
                  <SelectItem value="__added_successfully__">Added Successfully</SelectItem>
                  <SelectItem value="__empty__">Not Set</SelectItem>
                  {SLACK_STATUS_RT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isAdmin ? (
                <div className="h-8 px-3 flex items-center text-xs border rounded-md bg-muted/50 text-muted-foreground" data-testid="badge-user-filter">
                  {user?.username || "My Reports"}
                </div>
              ) : (
                <Select
                  value={filterAssignedTo}
                  onValueChange={(val) => {
                    setFilterAssignedTo(val);
                    setCurrentPage(1);
                    try { localStorage.setItem("retention-filter-assigned-to", val); } catch {}
                  }}
                >
                  <SelectTrigger className={`h-8 text-xs w-[150px] ${filterAssignedTo !== "all" ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300" : ""}`} data-testid="filter-assigned-to">
                    <SelectValue placeholder="All Users" />
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
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`h-8 w-[150px] text-xs ${filterDate ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300" : ""}`}
                data-testid="input-filter-date"
              />
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-8 h-8 w-[220px] text-sm ${searchQuery ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300" : ""}`}
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
                    {COLUMNS.filter((col) => col.label).map((col) => (
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginatedData.length > 0 && paginatedData.every((r) => selectedIds.has(r.id))}
                        onCheckedChange={() => toggleSelectAll(paginatedData.map((r) => r.id))}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
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
                  {paginatedData.map((report) => (
                    <TableRow
                      key={report.id}
                      className={
                        sheetOpen && selectedReport?.id === report.id
                          ? "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800 transition-colors duration-300"
                          : lastOpenedId === report.id
                            ? "bg-orange-100 dark:bg-orange-900/40 ring-1 ring-orange-300 dark:ring-orange-700 transition-colors duration-1000"
                            : selectedIds.has(report.id)
                              ? "bg-muted/50"
                              : ""
                      }
                      data-testid={`row-report-${report.id}`}
                    >
                      <TableCell className="py-2.5">
                        <Checkbox
                          checked={selectedIds.has(report.id)}
                          onCheckedChange={() => toggleSelect(report.id)}
                          data-testid={`checkbox-select-${report.id}`}
                        />
                      </TableCell>
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
          {filtered.length > 0 && (
            <div className="flex items-center justify-between pt-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px] text-xs" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-2">
                  {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filtered.length)} of {filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  data-testid="button-first-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2" data-testid="text-page-info">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  data-testid="button-last-page"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open);
        if (!open && selectedReport) {
          const closedId = selectedReport.id;
          setLastOpenedId(closedId);
          if (lastOpenedTimerRef.current) clearTimeout(lastOpenedTimerRef.current);
          lastOpenedTimerRef.current = setTimeout(() => {
            setLastOpenedId((prev) => prev === closedId ? null : prev);
          }, 5000);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Slack Message
              {selectedReport?.caseId && (
                <Badge variant="secondary" className="text-xs">{selectedReport.caseId}</Badge>
              )}
              {selectedReport?.caseId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs ml-auto"
                  data-testid="button-search-by-case-id"
                  disabled={slackLoading[String(selectedReport.id)]}
                  onClick={async () => {
                    const key = String(selectedReport.id);
                    setSlackLoading((prev) => ({ ...prev, [key]: true }));
                    try {
                      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/search?q=${encodeURIComponent(selectedReport.caseId)}`);
                      if (res.ok) {
                        const data = await res.json();
                        const messages: SlackMessage[] = Array.isArray(data) ? data : (data.messages || []);
                        const filtered = filterRelevantMessages(messages);
                        const result = filtered.length > 0 ? filtered : null;
                        persistentSlackCache[key] = result;
                        setSlackCache((prev) => ({ ...prev, [key]: result }));
                      }
                    } catch {} finally {
                      setSlackLoading((prev) => ({ ...prev, [key]: false }));
                    }
                  }}
                >
                  <Search className="h-3 w-3 mr-1" />
                  Search by Case ID
                </Button>
              )}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="space-y-3 mt-2">
                <SheetNotesEditor
                  reportId={selectedReport?.id ?? 0}
                  value={selectedReport?.notesTrimrx ?? ""}
                  onUpdated={(newVal) => {
                    setSelectedReport(prev => prev ? { ...prev, notesTrimrx: newVal } : prev);
                  }}
                />
                <div className="flex items-center gap-4 flex-wrap">
                  <SheetSlackStatusEditor
                    reportId={selectedReport?.id ?? 0}
                    value={selectedReport?.slackStatusRt ?? ""}
                    options={SLACK_STATUS_RT_OPTIONS}
                    onUpdated={(newVal) => {
                      setSelectedReport(prev => prev ? { ...prev, slackStatusRt: newVal } : prev);
                    }}
                  />
                  <SheetSubReasonEditor
                    reportId={selectedReport?.id ?? 0}
                    value={selectedReport?.subReason ?? ""}
                    onUpdated={(newSubReason, parentReason) => {
                      setSelectedReport(prev => prev ? { ...prev, subReason: newSubReason, ...(parentReason ? { reason: parentReason } : {}) } : prev);
                    }}
                  />
                </div>
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {selectedSlackLoading && !selectedSlackMsg ? (
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
                          saveSlackAction(selectedKey, info);
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
    </TooltipProvider>
  );
}
