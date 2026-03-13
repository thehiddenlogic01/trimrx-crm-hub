import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { StripeStatusBadge } from "@/lib/stripe-status";
import checkColorfulImg from "@assets/image_1773174563337.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Filter,
  FileSpreadsheet,
  FileText,
  CornerDownRight,
  XCircle,
  Trash2,
  Database,
  CheckCircle,
  CheckCircle2,
  XOctagon,
  CreditCard,
  DollarSign,
  ClipboardList,
  Clock,
  AlertTriangle,
  HelpCircle,
  ListChecks,
} from "lucide-react";

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
  display_name?: string;
  avatar: string;
}

interface ThreadReply {
  ts: string;
  user: string;
  text: string;
  bot_id?: string | null;
  reactions: { name: string; count: number; users: string[] }[];
}

function formatTs(ts: string) {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString("en-US", { timeZone: "America/Guatemala" });
}

function hasCheckmark(reactions: { name: string }[]) {
  return reactions.some((r) => r.name === "check_colorful");
}

const SLACK_EMOJI: Record<string, string> = {
  check_colorful: "✔️",
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

const CUSTOM_EMOJI_IMAGES: Record<string, string> = {
  check_colorful: checkColorfulImg,
};

function emojiFromName(name: string): string {
  return SLACK_EMOJI[name] || `:${name}:`;
}

function EmojiDisplay({ name, className }: { name: string; className?: string }) {
  if (CUSTOM_EMOJI_IMAGES[name]) {
    return <img src={CUSTOM_EMOJI_IMAGES[name]} alt={`:${name}:`} className={className || "w-4 h-4 inline-block"} />;
  }
  return <span className={className || "text-sm"}>{emojiFromName(name)}</span>;
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
      const u = users?.[userId];
      const name = u?.real_name || u?.display_name || u?.name || userId;
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
      if (CUSTOM_EMOJI_IMAGES[name]) {
        const ph = `__LINK${i++}__`;
        links.push({ placeholder: ph, html: `<img src="${CUSTOM_EMOJI_IMAGES[name]}" alt=":${name}:" class="w-5 h-5 inline-block align-text-bottom" />` });
        return ph;
      }
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

function cleanExtractedText(text: string): string {
  let c = text;
  c = c.replace(/\(edited\)\s*/gi, "");
  c = c.replace(/:[a-z0-9_+-]+:/g, "");
  c = c.replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1");
  c = c.replace(/<https?:\/\/[^>]+>/g, "");
  c = c.replace(/<http:\/\/\|>/g, "");
  c = c.replace(/<@[A-Z0-9]+(?:\|[^>]*)?>/g, "");
  c = c.replace(/\s*(?:careglp|accommodations)\.carevalidate\.com\s*\n?\s*Case\s*Management\s*\n?\s*Case\s*Management\s*by\s*CareValidate\s*/gi, "");
  c = c.replace(/\s*(?:careglp|accommodations)\.carevalidate\.com\s*\n?\s*Case\s*Management\s*/gi, "");
  c = c.replace(/\s*(?:careglp|accommodations)\.carevalidate\.com\s*/gi, "");
  c = c.replace(/Case\s*Management\s*by\s*CareValidate/gi, "");
  c = c.replace(/Case\s*Management\s*\n?\s*Case\s*Management/gi, "");
  c = c.replace(/&amp;/g, "&");
  c = c.replace(/&lt;/g, "<");
  c = c.replace(/&gt;/g, ">");
  c = c.replace(/\n\s*\n\s*\n/g, "\n");
  c = c.replace(/^[\s:•\-–—]+/, "");
  return c.trim();
}

interface ExtractedCase {
  caseId: string;
  link: string;
  concern: string;
  msgTs: string;
}

function getTrackerField(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    for (const key of Object.keys(record)) {
      if (key.trim().toLowerCase() === name.trim().toLowerCase()) {
        return record[key] || "";
      }
    }
  }
  return "";
}

function extractCaseFromSlackMsg(text: string): ExtractedCase | null {
  let caseId = "";
  let link = "";
  let concern = "";

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
  if (linkMatch) {
    link = cleanSlackUrl(linkMatch[1]);
  }
  if (!link) {
    const urlMatch = text.match(/(https?:\/\/(?:careglp|accommodations)\.carevalidate\.com\/accommodations\/(?:cases|requests)\/\S+)/i);
    if (urlMatch) {
      link = cleanSlackUrl(urlMatch[1]);
    }
  }
  if (!link) {
    const anyUrlMatch = text.match(/(https?:\/\/\S*carevalidate\.com\/accommodations\/\S+)/i);
    if (anyUrlMatch) {
      link = cleanSlackUrl(anyUrlMatch[1]);
    }
  }

  if (!caseId && !link) return null;

  const concernMatch = text.match(/Concern\/Request\s*:?\s*\*?\s*([\s\S]*)/i);
  if (concernMatch) {
    let c = concernMatch[1];
    c = cleanExtractedText(c);
    concern = c.trim();
  }

  if (!concern) {
    const actionMatch = text.match(/Action\s*(?:needed|Needed)\s*:?\s*\*?\s*([\s\S]*)/i);
    if (actionMatch) {
      let c = actionMatch[1];
      c = cleanExtractedText(c);
      concern = c.trim();
    }
  }

  if (!concern) {
    let plainText = text
      .replace(/<@[A-Z0-9]+(?:\|[^>]*)?>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\*/g, "")
      .replace(/\(edited\)/gi, "")
      .replace(/Hello\s*/gi, "")
      .replace(/&amp;/g, "&")
      .trim();
    plainText = plainText
      .replace(/•?\s*Case\s*(?:Link|link|ID|Id|id)\s*:?\s*\S*/gi, "")
      .replace(/•?\s*(?:Action\s*needed|Concern\/Request)\s*:?\s*/gi, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/Case\s*Management\s*(?:by\s*CareValidate)?/gi, "")
      .replace(/(?:careglp|accommodations)\.carevalidate\.com/gi, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();
    plainText = cleanExtractedText(plainText);
    if (plainText.length > 10) {
      concern = plainText;
    }
  }

  return { caseId, link, concern, msgTs: "" };
}

const BATCH_SIZE = 5;
const BATCH_ANALYZE_SIZE = 10;
const PARALLEL_CONCURRENCY = 2;

function SendToCvReportDialog({ messages, dateFilter }: { messages: SlackMessage[]; dateFilter: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentPart, setCurrentPart] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showExtractable, setShowExtractable] = useState(false);
  const [excludedTs, setExcludedTs] = useState<Set<string>>(new Set());
  const [sendMode, setSendMode] = useState<"full" | "extract-only" | "without-reason">("full");

  const allExtracted = messages.map((msg) => {
    const extracted = extractCaseFromSlackMsg(msg.text);
    if (extracted) extracted.msgTs = msg.ts;
    return { msg, extracted };
  });

  const skippedMessages = allExtracted.filter((e) => !e.extracted || (!e.extracted.link && !e.extracted.concern));
  const extractableCases = allExtracted
    .filter((e) => e.extracted && (!!e.extracted.link || !!e.extracted.concern))
    .map((e) => e.extracted!)
    .filter((c) => !excludedTs.has(c.msgTs));

  const totalParts = Math.ceil(extractableCases.length / BATCH_SIZE);

  async function sendBatch(batch: ExtractedCase[], partLabel: string) {
    setSending(true);
    setTotal(batch.length);
    setSent(0);
    setFailed(0);
    const modeLabel = sendMode === "extract-only" ? " [Only Extract]" : sendMode === "without-reason" ? " [Without Reason]" : "";
    setLog([`Starting ${partLabel}${modeLabel} (${batch.length} cases)...`]);

    const needsAnalysis = sendMode !== "extract-only";

    const analysisMap = new Map<number, { reason: string; subReason: string; desiredAction: string; clientThreat: string; confidence: number }>();

    if (needsAnalysis) {
      const casesWithConcerns = batch.map((c, i) => ({ idx: i, concern: c.concern || "" })).filter(c => c.concern.trim());

      for (let batchStart = 0; batchStart < casesWithConcerns.length; batchStart += BATCH_ANALYZE_SIZE * PARALLEL_CONCURRENCY) {
        const parallelBatches: typeof casesWithConcerns[] = [];
        for (let p = 0; p < PARALLEL_CONCURRENCY; p++) {
          const start = batchStart + p * BATCH_ANALYZE_SIZE;
          const chunk = casesWithConcerns.slice(start, start + BATCH_ANALYZE_SIZE);
          if (chunk.length > 0) parallelBatches.push(chunk);
        }

        const batchResults = await Promise.allSettled(
          parallelBatches.map(async (chunk) => {
            const analyzeRes = await apiRequest("POST", "/api/custom-gpt/analyze-batch", {
              cases: chunk.map(c => ({ id: c.idx, concern: c.concern }))
            });
            const data = await analyzeRes.json();
            return { chunk, results: data.results || [] };
          })
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            const { chunk, results } = result.value;
            for (let j = 0; j < chunk.length; j++) {
              const analysis = results[j] || {};
              analysisMap.set(chunk[j].idx, {
                reason: sendMode === "without-reason" ? "" : (analysis.reason || ""),
                subReason: analysis.subReason || "",
                desiredAction: analysis.desiredAction || "",
                clientThreat: analysis.clientThreat || "",
                confidence: analysis.confidence || 0,
              });
            }
            setLog((prev) => [...prev, `🔍 Analyzed ${chunk.length} cases via batch GPT`]);
          } else {
            const err = (result as PromiseRejectedResult).reason;
            setLog((prev) => [...prev, `⚠ Batch GPT failed: ${err?.message || "Unknown"}, those cases will have no classification`]);
          }
        }
      }
    }

    for (let chunkStart = 0; chunkStart < batch.length; chunkStart += PARALLEL_CONCURRENCY) {
      const chunk = batch.slice(chunkStart, chunkStart + PARALLEL_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (c, j) => {
          const idx = chunkStart + j;
          const analysis = analysisMap.get(idx);
          let reason = analysis?.reason || "";
          let subReason = analysis?.subReason || "";
          let desiredAction = analysis?.desiredAction || "";
          let clientThreat = analysis?.clientThreat || "";
          let confidence = analysis?.confidence || 0;

          if (sendMode !== "extract-only" && sendMode !== "without-reason" && !reason) {
            reason = "Uncategorized";
            subReason = "Other";
            desiredAction = "Cancel";
            confidence = 0;
          }

          await apiRequest("POST", "/api/cv-reports", {
            caseId: c.caseId || "",
            link: c.link || "",
            notesTrimrx: c.concern || "",
            reason,
            subReason,
            desiredAction,
            confidence,
            status: "",
            duplicated: "",
            customerEmail: "",
            date: dateFilter ? (() => { const d = new Date(dateFilter + "T12:00:00"); return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`; })() : "",
            name: "",
            productType: "",
            clientThreat,
            submittedBy: user?.username || "",
            assignedTo: user?.username || "",
          });
          setSent((prev) => prev + 1);
          const modeInfo = sendMode === "extract-only" ? " (extract only)" : sendMode === "without-reason" ? ` (${desiredAction || "no action"})` : ` (${reason || "?"})`;
          setLog((prev) => [...prev, `✅ ${c.caseId || c.link.slice(-20) || `Case ${idx + 1}`} — sent${modeInfo}`]);
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "rejected") {
          const c = chunk[j];
          const err = (results[j] as PromiseRejectedResult).reason;
          setFailed((prev) => prev + 1);
          setLog((prev) => [...prev, `❌ ${c.caseId || `Case ${chunkStart + j + 1}`} — failed: ${err?.message || "Unknown error"}`]);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    setSending(false);
    setLog((prev) => [...prev, `Done! ${partLabel} complete.`]);
  }

  function handleSendPart(partIndex: number) {
    const start = partIndex * BATCH_SIZE;
    const batch = extractableCases.slice(start, start + BATCH_SIZE);
    setCurrentPart(partIndex);
    sendBatch(batch, `Part ${partIndex + 1}`);
  }

  function handleSendAll() {
    setCurrentPart(null);
    sendBatch(extractableCases, "Send All");
  }

  function toggleExclude(ts: string) {
    setExcludedTs((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  }

  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) { setOpen(v); if (!v) { setShowSkipped(false); setShowExtractable(false); } } }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" data-testid="button-send-cv-report">
          <FileSpreadsheet className="h-4 w-4 mr-1.5" />
          Send to CV Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to CV Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold" data-testid="text-total-messages">{messages.length}</p>
              <p className="text-xs text-muted-foreground">Total Messages</p>
            </div>
            <button
              className="bg-muted rounded-lg p-3 text-center hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => { setShowExtractable(!showExtractable); setShowSkipped(false); }}
              data-testid="button-show-extractable"
            >
              <p className="text-2xl font-bold text-green-600" data-testid="text-extractable-cases">{extractableCases.length}</p>
              <p className="text-xs text-muted-foreground">Extractable Cases</p>
              {excludedTs.size > 0 && <p className="text-xs text-orange-500 mt-0.5">{excludedTs.size} excluded</p>}
            </button>
            <button
              className="bg-muted rounded-lg p-3 text-center hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => { setShowSkipped(!showSkipped); setShowExtractable(false); }}
              data-testid="button-show-skipped"
            >
              <p className="text-2xl font-bold text-orange-500" data-testid="text-skipped-count">{skippedMessages.length}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </button>
          </div>

          {showSkipped && skippedMessages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Skipped Messages ({skippedMessages.length})</p>
              <p className="text-xs text-muted-foreground">These messages don't contain Case ID, Case link, or Concern/Request</p>
              <div className="bg-muted rounded-lg max-h-60 overflow-y-auto divide-y divide-border">
                {skippedMessages.map((s, i) => (
                  <div key={i} className="p-2 text-xs">
                    <span className="text-muted-foreground">{formatTs(s.msg.ts)}</span>
                    <p className="mt-0.5 line-clamp-2">{s.msg.text.replace(/<[^>]+>/g, "").slice(0, 200)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showExtractable && extractableCases.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Extractable Cases ({extractableCases.length})</p>
              <p className="text-xs text-muted-foreground">Click the X to exclude a case from sending</p>
              <div className="bg-muted rounded-lg max-h-60 overflow-y-auto divide-y divide-border">
                {allExtracted
                  .filter((e) => e.extracted && (!!e.extracted.link || !!e.extracted.concern))
                  .map((e, i) => {
                    const c = e.extracted!;
                    const isExcluded = excludedTs.has(c.msgTs);
                    return (
                      <div key={i} className={`p-2 text-xs flex items-start gap-2 ${isExcluded ? "opacity-40" : ""}`}>
                        <button
                          onClick={() => toggleExclude(c.msgTs)}
                          className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-xs font-bold ${isExcluded ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300" : "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"}`}
                          data-testid={`button-exclude-${i}`}
                        >
                          {isExcluded ? "+" : "×"}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{c.caseId || "No Case ID"}</span>
                          {c.concern && <p className="mt-0.5 line-clamp-1 text-muted-foreground">{c.concern.slice(0, 150)}</p>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {extractableCases.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No cases to send. {excludedTs.size > 0 ? "All cases have been excluded." : "Make sure messages contain Case ID, Case link, or Concern/Request."}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Send Mode:</p>
                <div className="flex gap-2">
                  <Button
                    variant={sendMode === "full" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendMode("full")}
                    disabled={sending}
                    data-testid="button-mode-full"
                  >
                    Full Analysis
                  </Button>
                  <Button
                    variant={sendMode === "extract-only" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendMode("extract-only")}
                    disabled={sending}
                    data-testid="button-mode-extract-only"
                  >
                    Only Extract
                  </Button>
                  <Button
                    variant={sendMode === "without-reason" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendMode("without-reason")}
                    disabled={sending}
                    data-testid="button-mode-without-reason"
                  >
                    Without Reason
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {sendMode === "full" && "Runs GPT analysis for Reason, Sub-Reason, Desired Action, Client Threat, and Confidence."}
                  {sendMode === "extract-only" && "Skips GPT entirely — just extracts Case ID, link, and concern text and sends immediately."}
                  {sendMode === "without-reason" && "Runs GPT for Sub-Reason, Desired Action, Client Threat, and Confidence but leaves Reason empty."}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Send in parts ({BATCH_SIZE} cases each):</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: totalParts }, (_, i) => {
                    const start = i * BATCH_SIZE;
                    const end = Math.min(start + BATCH_SIZE, extractableCases.length);
                    return (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        disabled={sending}
                        onClick={() => handleSendPart(i)}
                        data-testid={`button-send-part-${i + 1}`}
                        className={currentPart === i && !sending ? "border-green-500" : ""}
                      >
                        Part {i + 1} ({start + 1}–{end})
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={sending}
                onClick={handleSendAll}
                data-testid="button-send-all"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Sending... ({sent + failed}/{total})
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    Send All ({extractableCases.length} cases)
                  </>
                )}
              </Button>
            </>
          )}

          {(sending || log.length > 0) && (
            <div className="space-y-2">
              {sending && <Progress value={progress} className="h-2" />}
              {(sent > 0 || failed > 0) && (
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-medium">✅ {sent} sent</span>
                  {failed > 0 && <span className="text-red-600 font-medium">❌ {failed} failed</span>}
                </div>
              )}
              <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                {log.map((entry, i) => (
                  <p key={i} className="text-xs font-mono">{entry}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PIActivityIcon({ icon, type }: { icon: string; type: string }) {
  const size = "h-3.5 w-3.5";
  if (type === "succeeded") return <CheckCircle2 className={`${size} text-green-600`} />;
  if (type === "failed" || type === "error") return <XCircle className={`${size} text-red-500`} />;
  if (type === "canceled") return <XCircle className={`${size} text-muted-foreground`} />;
  if (icon === "alert" || type === "requires_action") return <AlertTriangle className={`${size} text-yellow-500`} />;
  if (type === "refunded") return <RefreshCw className={`${size} text-blue-500`} />;
  if (type === "disputed") return <AlertCircle className={`${size} text-amber-500`} />;
  return <Clock className={`${size} text-muted-foreground`} />;
}

function PIActivityInline({ piId }: { piId: string }) {
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
    <div className="px-3 py-2" data-testid={`pi-activity-${piId}`}>
      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recent Activity</h5>
      <div className="relative pl-5 space-y-1.5">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        {data.activity.map((item: any, idx: number) => (
          <div key={idx} className="relative flex items-start gap-2">
            <div className="absolute -left-5 top-0.5 bg-background p-0.5">
              <PIActivityIcon icon={item.icon} type={item.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground leading-tight">{item.title}</p>
              {item.description && <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{item.description}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(item.timestamp).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedHelpButton({ msg, getUserName }: { msg: any; getUserName: (id: string) => string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");

  const caseIdMatch = msg.text?.match(/Case\s*ID[:\s]*\*?([A-Z0-9-]+)\*?/i);
  const caseId = caseIdMatch ? caseIdMatch[1] : null;
  const linkMatch = msg.text?.match(/(https?:\/\/[^\s>]+)/);
  const caseLink = linkMatch ? linkMatch[1] : null;

  const sendHelp = useMutation({
    mutationFn: async () => {
      const msgText = (msg.text || "").replace(/<[^>]*>/g, "");
      await apiRequest("POST", "/api/audit-alerts/send-custom", {
        message: helpMsg.trim(),
        slackContext: {
          user: getUserName(msg.user),
          caseId: caseId || undefined,
          caseLink: caseLink || undefined,
          messagePreview: msgText,
        },
      });
    },
    onSuccess: () => {
      toast({ title: "Help message sent to Telegram!" });
      setHelpMsg("");
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setHelpMsg(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900" data-testid={`button-need-help-${msg.ts}`}>
          <HelpCircle className="h-3.5 w-3.5" />
          Need Help
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <HelpCircle className="h-5 w-5" />
            Need Help
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Message Info</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground font-medium">From:</span>
              <span>{getUserName(msg.user)}</span>
              {caseId && (
                <>
                  <span className="text-muted-foreground font-medium">Case ID:</span>
                  <span className="font-mono text-xs">{caseId}</span>
                </>
              )}
              {caseLink && (
                <>
                  <span className="text-muted-foreground font-medium">Link:</span>
                  <a href={caseLink} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 text-xs truncate hover:underline">{caseLink}</a>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Note</label>
            <Textarea
              placeholder="Describe what you need help with..."
              value={helpMsg}
              onChange={(e) => setHelpMsg(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="input-help-message"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid="button-help-cancel">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => sendHelp.mutate()}
              disabled={sendHelp.isPending || !helpMsg.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-help-send"
            >
              {sendHelp.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send to Telegram
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SlackMessagesPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [expandAllReplies, setExpandAllReplies] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBroadcast, setReplyBroadcast] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [mentionFilter, setMentionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideReplies, setHideReplies] = useState(false);
  const [cvStatusMap, setCvStatusMap] = useState<Record<string, { status: string; caseId: string; id: number }>>({});
  const [cvStatusLoading, setCvStatusLoading] = useState(false);
  const [cvFilter, setCvFilter] = useState("all");
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [dataSyncOpen, setDataSyncOpen] = useState(false);
  const [replyFilters, setReplyFilters] = useState<string[]>([]);
  const [replyFilterLoading, setReplyFilterLoading] = useState(false);
  const [replyFilterMatchedMap, setReplyFilterMatchedMap] = useState<Record<string, Record<string, { matchedBy: string }>>>({});
  const loadFromSession = <T,>(key: string, fallback: T): T => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch { return fallback; }
  };
  const saveToSession = (key: string, val: any) => {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
  };

  const [trackerMatchMap, _setTrackerMatchMap] = useState<Record<string, Record<string, string> | null>>(() => loadFromSession("sba_trackerMatchMap", {}));
  const setTrackerMatchMap: typeof _setTrackerMatchMap = (v) => {
    _setTrackerMatchMap((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      saveToSession("sba_trackerMatchMap", next);
      return next;
    });
  };
  const [trackerMatchLoading, setTrackerMatchLoading] = useState(false);
  const [trackerFilter, setTrackerFilter] = useState("all");
  const [expandedPopupPiId, setExpandedPopupPiId] = useState<string | null>(null);
  const [paymentsMap, _setPaymentsMap] = useState<Record<string, { email?: string; paymentIntents?: any[]; subscriptions?: any[]; customers?: any[]; found?: boolean; message?: string; error?: string }>>(() => loadFromSession("sba_paymentsMap", {}));
  const setPaymentsMap: typeof _setPaymentsMap = (v) => {
    _setPaymentsMap((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      saveToSession("sba_paymentsMap", next);
      return next;
    });
  };
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsProgress, setPaymentsProgress] = useState({ done: 0, total: 0 });
  const [cvDataMap, _setCvDataMap] = useState<Record<string, { name?: string; email?: string; status?: string; found?: boolean; error?: string }>>(() => loadFromSession("sba_cvDataMap", {}));
  const setCvDataMap: typeof _setCvDataMap = (v) => {
    _setCvDataMap((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      saveToSession("sba_cvDataMap", next);
      return next;
    });
  };
  const [refundDataMap, _setRefundDataMap] = useState<Record<string, { found?: boolean; record?: Record<string, string>; headers?: string[]; message?: string; statusFromP?: string; reason?: string } | null>>(() => loadFromSession("sba_refundDataMap", {}));
  const setRefundDataMap: typeof _setRefundDataMap = (v) => {
    _setRefundDataMap((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      saveToSession("sba_refundDataMap", next);
      return next;
    });
  };
  const [cvSyncLoading, setCvSyncLoading] = useState(false);
  const [cvSyncProgress, setCvSyncProgress] = useState({ done: 0, total: 0 });
  const [lastPulledTime, _setLastPulledTime] = useState<Date | null>(() => {
    const raw = sessionStorage.getItem("sba_lastPulledTime");
    return raw ? new Date(raw) : null;
  });
  const setLastPulledTime = (d: Date | null) => {
    _setLastPulledTime(d);
    if (d) sessionStorage.setItem("sba_lastPulledTime", d.toISOString());
    else sessionStorage.removeItem("sba_lastPulledTime");
  };
  const [lastPulledPerMsg, _setLastPulledPerMsg] = useState<Record<string, Date>>(() => {
    try {
      const raw = sessionStorage.getItem("sba_lastPulledPerMsg");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const result: Record<string, Date> = {};
      for (const [k, v] of Object.entries(parsed)) result[k] = new Date(v as string);
      return result;
    } catch { return {}; }
  });
  const setLastPulledPerMsg: typeof _setLastPulledPerMsg = (v) => {
    _setLastPulledPerMsg((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      const serializable: Record<string, string> = {};
      for (const [k, d] of Object.entries(next)) serializable[k] = d.toISOString();
      saveToSession("sba_lastPulledPerMsg", serializable);
      return next;
    });
  };

  const { data: slackStatus } = useQuery<{ connected: boolean; team?: string; socketModeActive?: boolean }>({
    queryKey: ["/api/slack/status"],
    refetchInterval: 30000,
  });

  const forceRefreshRef = useRef(false);

  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "messages", dateFilter],
    queryFn: async () => {
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      let url: string;
      if (dateFilter) {
        url = `/api/slack/channels/${CHANNEL_ID}/messages?date=${dateFilter}${force ? "&force=1" : ""}`;
      } else {
        url = `/api/slack/channels/${CHANNEL_ID}/messages`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: slackStatus?.connected === true,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const es = new EventSource("/api/slack/events");
    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data);
        if (event.type === "connected") return;
        if (event.channelId !== CHANNEL_ID) return;
        if (event.type === "react" || event.type === "unreact" || event.type === "delete" || event.type === "new_message") {
          queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "messages"] });
        }
        if (event.type === "reply" && event.threadTs) {
          queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", event.threadTs] });
          queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "messages"] });
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (replyFilters.length > 0) {
      setReplyFilters([]);
      setReplyFilterMatchedMap({});
    }
  }, [dateFilter, debouncedSearch]);

  const { data: searchResults, isLoading: loadingSearch } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", CHANNEL_ID, "search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: slackStatus?.connected === true && debouncedSearch.length > 0,
  });

  const { data: users } = useQuery<Record<string, SlackUser>>({
    queryKey: ["/api/slack/users"],
    enabled: slackStatus?.connected === true,
  });

  const resolvedUsersRef = useRef<Set<string>>(new Set());

  const snapshotChannelCache = () => {
    const cache = queryClient.getQueriesData<unknown>({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    return cache.map(([key, data]) => ({ key, data }));
  };
  const restoreChannelCache = (snapshot: { key: any; data: unknown }[]) => {
    snapshot.forEach(({ key, data }) => queryClient.setQueryData(key, data));
  };

  const convertMentionsToIds = useCallback((text: string) => {
    if (!users) return text;
    return text.replace(/(?<![<@\w])@([A-Za-z][A-Za-z0-9 _.-]*[A-Za-z0-9])(?![>@])/g, (full, rawName, offset) => {
      if (offset > 0 && text[offset - 1] === '<') return full;
      const nameLower = rawName.toLowerCase().trim();
      if (nameLower.length < 2) return full;
      const matched = Object.entries(users).find(([, u]) => {
        const rn = (u.real_name || "").toLowerCase();
        const dn = (u.name || "").toLowerCase();
        const displayName = (u.display_name || "").toLowerCase();
        return (rn.length > 0 && rn === nameLower)
          || (dn.length > 0 && dn === nameLower)
          || (displayName.length > 0 && displayName === nameLower);
      });
      if (matched) return `<@${matched[0]}>`;
      return full;
    });
  }, [users]);

  const replyMutation = useMutation({
    mutationFn: async ({ threadTs, text, broadcast }: { threadTs: string; text: string; broadcast?: boolean }) => {
      const converted = convertMentionsToIds(text);
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/reply`, { thread_ts: threadTs, text: converted, reply_broadcast: broadcast || undefined }, { "x-audit-source": "Slack Backlog All" });
    },
    onMutate: ({ threadTs, text }) => {
      const snapshot = snapshotChannelCache();
      const prevReplyText = replyText[threadTs] || "";
      setReplyText((prev) => ({ ...prev, [threadTs]: "" }));
      setReplyingTo(null);
      setReplyBroadcast(false);
      const newReply: ThreadReply = {
        ts: String(Date.now() / 1000),
        user: "me",
        text,
        reactions: [],
      };
      queryClient.setQueriesData<ThreadReply[]>(
        { queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", threadTs] },
        (old) => old ? [...old, newReply] : [newReply]
      );
      const updateCount = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((m) => m.ts === threadTs ? { ...m, reply_count: m.reply_count + 1 } : m);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, updateCount);
      return { snapshot, prevReplyText, threadTs };
    },
    onSuccess: (_data, vars) => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", vars.threadTs] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        restoreChannelCache(context.snapshot);
        setReplyText((prev) => ({ ...prev, [context.threadTs]: context.prevReplyText }));
      }
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/react`, { timestamp, name: "check_colorful" }, { "x-audit-source": "Slack Backlog All" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotChannelCache();
      const updateMessages = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.ts !== timestamp) return msg;
          const existing = msg.reactions.find((r) => r.name === "check_colorful");
          if (existing) {
            return { ...msg, reactions: msg.reactions.map((r) => r.name === "check_colorful" ? { ...r, count: r.count + 1, users: [...r.users, "me"] } : r) };
          }
          return { ...msg, reactions: [...msg.reactions, { name: "check_colorful", count: 1, users: ["me"] }] };
        });
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark added" });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreChannelCache(context.snapshot);
      toast({ title: "Failed to add reaction", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    },
  });

  const unreactMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/unreact`, { timestamp, name: "check_colorful" }, { "x-audit-source": "Slack Backlog All" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotChannelCache();
      const updateMessages = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.ts !== timestamp) return msg;
          const existing = msg.reactions.find((r) => r.name === "check_colorful");
          if (existing && existing.count <= 1) {
            return { ...msg, reactions: msg.reactions.filter((r) => r.name !== "check_colorful") };
          }
          if (existing) {
            return { ...msg, reactions: msg.reactions.map((r) => r.name === "check_colorful" ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== "me") } : r) };
          }
          return msg;
        });
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, updateMessages);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Checkmark removed" });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreChannelCache(context.snapshot);
      toast({ title: "Failed to remove checkmark", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ timestamp }: { timestamp: string }) => {
      await apiRequest("DELETE", `/api/slack/channels/${CHANNEL_ID}/messages/${timestamp}`, undefined, { "x-audit-source": "Slack Backlog All" });
    },
    onMutate: ({ timestamp }) => {
      const snapshot = snapshotChannelCache();
      const removeMsg = (old: SlackMessage[] | undefined) => {
        if (!old) return old;
        return old.filter((m) => m.ts !== timestamp);
      };
      queryClient.setQueriesData<SlackMessage[]>({ queryKey: ["/api/slack/channels", CHANNEL_ID] }, removeMsg);
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    },
    onError: (err: Error, _vars, context) => {
      if (context) restoreChannelCache(context.snapshot);
      toast({ title: "Failed to delete message", description: err.message, variant: "destructive" });
    },
  });

  const checkCvStatus = async () => {
    const msgs = messages || [];
    const caseIds: string[] = [];
    const caseIdToTs: Record<string, string[]> = {};
    const caseLinks: { msgTs: string; link: string }[] = [];
    for (const msg of msgs) {
      const extracted = extractCaseFromSlackMsg(msg.text);
      if (extracted?.caseId) {
        caseIds.push(extracted.caseId);
        if (!caseIdToTs[extracted.caseId]) caseIdToTs[extracted.caseId] = [];
        caseIdToTs[extracted.caseId].push(msg.ts);
      }
      if (extracted?.link) {
        caseLinks.push({ msgTs: msg.ts, link: extracted.link });
      }
    }
    if (caseIds.length === 0 && caseLinks.length === 0) {
      toast({ title: "No case IDs or links found in current messages" });
      return;
    }
    setCvStatusLoading(true);
    try {
      const res = await apiRequest("POST", "/api/cv-reports/match", { caseIds: [...new Set(caseIds)], caseLinks });
      const matched: Record<string, { status: string; caseId: string; id: number }> = await res.json();
      const tsMapped: Record<string, { status: string; caseId: string; id: number }> = {};
      for (const [key, info] of Object.entries(matched)) {
        if (key.startsWith("link:")) {
          const ts = key.replace("link:", "");
          if (!tsMapped[ts]) tsMapped[ts] = info;
        } else {
          const tsList = caseIdToTs[key] || [];
          for (const ts of tsList) {
            tsMapped[ts] = info;
          }
        }
      }
      setCvStatusMap(tsMapped);
      const uniqueMatches = new Set(Object.values(tsMapped).map((m) => m.id));
      const closedCount = Object.values(tsMapped).filter((m) => m.status.toLowerCase().startsWith("closed")).length;
      const rejectedCount = Object.values(tsMapped).filter((m) => m.status.toUpperCase() === "REJECTED").length;
      const parts = [`${uniqueMatches.size} matched`];
      if (closedCount > 0) parts.push(`${closedCount} closed`);
      if (rejectedCount > 0) parts.push(`${rejectedCount} rejected`);
      toast({ title: `CV Status checked: ${parts.join(", ")}` });
    } catch (err: any) {
      toast({ title: "Failed to check CV status", description: err.message, variant: "destructive" });
    } finally {
      setCvStatusLoading(false);
    }
  };

  const toggleSelectMessage = (ts: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  };

  const toggleSelectAll = (msgs: SlackMessage[]) => {
    const allSelected = msgs.every((m) => selectedMessages.has(m.ts));
    if (allSelected) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(msgs.map((m) => m.ts)));
    }
  };

  const bulkOptionDone = async (msgs: SlackMessage[]) => {
    const selected = msgs.filter((m) => selectedMessages.has(m.ts));
    if (selected.length === 0) return;
    const withCvStatus = selected.filter((m) => cvStatusMap[m.ts]?.status);
    const skippedCount = selected.length - withCvStatus.length;
    if (withCvStatus.length === 0) {
      toast({ title: "No selected messages have a CV status to reply with", variant: "destructive" });
      return;
    }
    setBulkProcessing(true);
    setBulkProgress({ done: 0, total: withCvStatus.length });
    let successCount = 0;
    let failCount = 0;
    for (const msg of withCvStatus) {
      try {
        const threadTs = msg.thread_ts || msg.ts;
        const cvInfo = cvStatusMap[msg.ts];
        await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/reply`, {
          thread_ts: threadTs,
          text: cvInfo.status,
        }, { "x-audit-source": "Slack Backlog All" });
        const hasCheck = msg.reactions.some((r) => r.name === "check_colorful");
        if (!hasCheck) {
          await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/react`, {
            timestamp: msg.ts,
            name: "check_colorful",
          }, { "x-audit-source": "Slack Backlog All" });
        }
        successCount++;
      } catch {
        failCount++;
      }
      setBulkProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }
    setBulkProcessing(false);
    setSelectedMessages(new Set());
    queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", CHANNEL_ID] });
    toast({
      title: `Bulk action complete: ${successCount} done${failCount > 0 ? `, ${failCount} failed` : ""}${skippedCount > 0 ? `, ${skippedCount} skipped (no CV status)` : ""}`,
    });
  };

  const [replyScanProgress, setReplyScanProgress] = useState({ scanned: 0, total: 0 });

  const mentionUserIds = users ? Object.entries(users).reduce<Record<string, string[]>>((acc, [id, u]) => {
    const name = (u.real_name || u.name || "").toLowerCase();
    if (name.includes("olia") && name.includes("orlowska")) {
      acc["olia"] = [...(acc["olia"] || []), id];
    }
    if (name.includes("karla") && name.includes("garibay")) {
      acc["karla"] = [...(acc["karla"] || []), id];
    }
    return acc;
  }, {}) : {};

  function textHasMention(text: string, userId: string): boolean {
    return text.includes(`<@${userId}>`) || text.includes(`<@${userId}|`);
  }

  const isSearchMode = debouncedSearch.length > 0;
  const baseMessages = isSearchMode ? (searchResults || []) : (messages || []);

  useEffect(() => {
    if (!users || !baseMessages || baseMessages.length === 0) return;
    const unknownIds = new Set<string>();
    const userIdPattern = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
    for (const msg of baseMessages) {
      let match;
      while ((match = userIdPattern.exec(msg.text)) !== null) {
        if (!users[match[1]] && !resolvedUsersRef.current.has(match[1])) unknownIds.add(match[1]);
      }
      if (msg.user && !users[msg.user] && !resolvedUsersRef.current.has(msg.user)) unknownIds.add(msg.user);
    }
    if (unknownIds.size === 0) return;
    const ids = Array.from(unknownIds).slice(0, 50);
    ids.forEach((id) => resolvedUsersRef.current.add(id));
    apiRequest("POST", "/api/slack/users/resolve", { userIds: ids })
      .then((res) => res.json())
      .then((resolved) => {
        if (resolved && Object.keys(resolved).length > 0) {
          queryClient.setQueryData<Record<string, SlackUser>>(["/api/slack/users"], (old) => ({ ...old, ...resolved }));
        }
      })
      .catch(() => {});
  }, [users, baseMessages]);

  const passesBaseFilters = useCallback((msg: SlackMessage) => {
    if (mentionFilter !== "all") {
      const text = msg.text || "";
      if (mentionFilter === "olia") {
        if (!(mentionUserIds["olia"] || []).some((id) => textHasMention(text, id))) return false;
      } else if (mentionFilter === "karla") {
        if (!(mentionUserIds["karla"] || []).some((id) => textHasMention(text, id))) return false;
      } else if (mentionFilter === "both") {
        const oliaIds = mentionUserIds["olia"] || [];
        const karlaIds = mentionUserIds["karla"] || [];
        if (!oliaIds.some((id) => textHasMention(text, id)) && !karlaIds.some((id) => textHasMention(text, id))) return false;
      }
    }
    if (statusFilter !== "all") {
      const hasCheck = msg.reactions.some((r) => r.name === "check_colorful");
      if (statusFilter === "done" && !hasCheck) return false;
      if (statusFilter === "pending" && hasCheck) return false;
    }
    if (hideReplies && msg.thread_ts && msg.thread_ts !== msg.ts) return false;
    if (cvFilter !== "all") {
      const cvInfo = cvStatusMap[msg.ts];
      const statusLower = cvInfo ? cvInfo.status.toLowerCase() : "";
      const isClosedStatus = statusLower.startsWith("closed");
      const isRejectedStatus = statusLower === "rejected" || cvInfo?.status.toUpperCase() === "REJECTED";
      const isClosedOrRejected = isClosedStatus || isRejectedStatus;
      if (cvFilter === "closed") {
        if (!cvInfo || !isClosedStatus) return false;
      } else if (cvFilter === "rejected") {
        if (!cvInfo || !isRejectedStatus) return false;
      } else if (cvFilter === "open") {
        if (cvInfo && isClosedOrRejected) return false;
      } else if (cvFilter === "no-match") {
        if (cvInfo) return false;
      }
    }
    if (trackerFilter !== "all" && Object.keys(trackerMatchMap).length > 0) {
      if (!(msg.ts in trackerMatchMap)) return false;
      const trackerInfo = trackerMatchMap[msg.ts];
      if (trackerFilter === "in-tracker") {
        if (trackerInfo === null) return false;
      } else if (trackerFilter === "not-in-tracker") {
        if (trackerInfo !== null) return false;
      }
    }
    return true;
  }, [mentionFilter, mentionUserIds, statusFilter, hideReplies, cvFilter, cvStatusMap, trackerFilter, trackerMatchMap]);

  const scanRepliesForFilters = async (filterTypes: string[]) => {
    const scanFilters = filterTypes.filter((f) => f !== "no-reply");
    const msgs = baseMessages;
    if (msgs.length === 0) {
      toast({ title: "No messages to scan" });
      return;
    }
    if (scanFilters.length === 0) return;
    setReplyFilterLoading(true);
    try {
      const visibleMsgs = msgs.filter((m) => passesBaseFilters(m));
      const timestamps = visibleMsgs.filter((m) => m.reply_count > 0).map((m) => m.ts);
      if (timestamps.length === 0) {
        const newMap: Record<string, Record<string, { matchedBy: string }>> = {};
        for (const f of scanFilters) newMap[f] = {};
        setReplyFilterMatchedMap((prev) => ({ ...prev, ...newMap }));
        toast({ title: "No messages with replies to scan" });
        setReplyFilterLoading(false);
        return;
      }
      setReplyScanProgress({ scanned: 0, total: timestamps.length * scanFilters.length });
      const newMap: Record<string, Record<string, { matchedBy: string }>> = {};
      for (const f of scanFilters) newMap[f] = {};
      let totalScanned = 0;
      for (const filterType of scanFilters) {
        const allMatched: Record<string, { matchedBy: string }> = {};
        const chunkSize = 60;
        for (let i = 0; i < timestamps.length; i += chunkSize) {
          const chunk = timestamps.slice(i, i + chunkSize);
          const res = await apiRequest("POST", `/api/slack/channels/${CHANNEL_ID}/scan-replies`, {
            messageTimestamps: chunk,
            filter: filterType,
          });
          const data = await res.json();
          Object.assign(allMatched, data.matched || {});
          totalScanned += chunk.length;
          setReplyScanProgress({ scanned: totalScanned, total: timestamps.length * scanFilters.length });
        }
        newMap[filterType] = allMatched;
      }
      setReplyFilterMatchedMap((prev) => ({ ...prev, ...newMap }));
      const summaries = scanFilters.map((f) => `${f}: ${Object.keys(newMap[f]).length}`);
      toast({ title: `Reply scan done — ${summaries.join(", ")}` });
    } catch (err: any) {
      toast({ title: "Failed to scan replies", description: err.message, variant: "destructive" });
    } finally {
      setReplyFilterLoading(false);
    }
  };

  const matchTrackerData = async () => {
    const msgs = messages || [];
    const linkQueries: { msgTs: string; query: string }[] = [];
    for (const msg of msgs) {
      const extracted = extractCaseFromSlackMsg(msg.text);
      if (extracted?.link) {
        linkQueries.push({ msgTs: msg.ts, query: extracted.link });
      } else if (extracted?.caseId) {
        linkQueries.push({ msgTs: msg.ts, query: extracted.caseId });
      }
    }
    if (linkQueries.length === 0) {
      toast({ title: "No case links or IDs found in current messages" });
      return;
    }
    setTrackerMatchLoading(true);
    try {
      const queries = linkQueries.map((lq) => lq.query);
      const res = await apiRequest("POST", "/api/pt-finder/batch-search", { queries });
      const data = await res.json();
      const resultMap: Record<string, Record<string, string> | null> = {};
      for (const lq of linkQueries) {
        resultMap[lq.msgTs] = data.results?.[lq.query] || null;
      }
      setTrackerMatchMap((prev) => ({ ...prev, ...resultMap }));
      const now = new Date();
      setLastPulledTime(now);
      setLastPulledPerMsg((prev) => {
        const updated = { ...prev };
        for (const lq of linkQueries) updated[lq.msgTs] = now;
        return updated;
      });
      const foundCount = Object.values(resultMap).filter((v) => v !== null).length;
      const notFoundCount = Object.values(resultMap).filter((v) => v === null).length;
      toast({ title: `Match Data: ${foundCount} in tracker, ${notFoundCount} not found` });
    } catch (err: any) {
      toast({ title: "Failed to match tracker data", description: err.message, variant: "destructive" });
    } finally {
      setTrackerMatchLoading(false);
    }
  };

  const REPLY_FILTER_OPTIONS = [
    { value: "no-reply", label: "No Replied Yet" },
    { value: "managed-karla-emi", label: "Managed by Karla-Emi" },
    { value: "not-managed-karla-emi", label: "Not Managed by Karla-Emi" },
    { value: "with-close-case", label: "With Close Case" },
    { value: "without-close-case", label: "Without Close Case" },
    { value: "active-payment", label: "Active Payment" },
  ];

  const handleReplyFilterToggle = (value: string) => {
    const isSelected = replyFilters.includes(value);
    let newFilters: string[];
    if (isSelected) {
      newFilters = replyFilters.filter((f) => f !== value);
    } else {
      if (value === "no-reply") {
        newFilters = ["no-reply"];
      } else {
        newFilters = [...replyFilters.filter((f) => f !== "no-reply"), value];
      }
    }
    setReplyFilters(newFilters);
    if (isSelected) {
      setReplyFilterMatchedMap((prev) => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
    } else {
      const toScan = [value].filter((f) => f !== "no-reply" && !replyFilterMatchedMap[f]);
      if (toScan.length > 0) {
        scanRepliesForFilters(toScan);
      }
    }
  };

  const clearReplyFilters = () => {
    setReplyFilters([]);
    setReplyFilterMatchedMap({});
  };

  const handlePullSingle = async (msg: SlackMessage) => {
    const extracted = extractCaseFromSlackMsg(msg.text);

    const cvPromise = (async () => {
      if (!extracted?.link) return { found: false, error: "No case link found" };
      try {
        const res = await apiRequest("POST", "/api/carevalidate/lookup-case", { link: extracted.link });
        return await res.json();
      } catch (err: any) {
        return { found: false, error: err.message || "Lookup failed" };
      }
    })();

    const paymentPromise = (async () => {
      if (!extracted || (!extracted.link && !extracted.caseId)) return { found: false, message: "No case link or ID found" };
      try {
        const res = await apiRequest("POST", "/api/stripe-payments/lookup-by-case", {
          caseLink: extracted.link || undefined,
          caseId: extracted.caseId || undefined,
        });
        return await res.json();
      } catch (err: any) {
        return { found: false, error: err.message || "Lookup failed" };
      }
    })();

    const trackerPromise = (async () => {
      const query = extracted?.link || extracted?.caseId;
      if (!query) return null;
      try {
        const res = await apiRequest("POST", "/api/pt-finder/batch-search", { queries: [query] });
        const data = await res.json();
        return data.results?.[query] || null;
      } catch {
        return null;
      }
    })();

    const refundPromise = (async () => {
      const queries: string[] = [];
      if (extracted?.link) queries.push(extracted.link);
      if (extracted?.caseId) queries.push(extracted.caseId);
      if (queries.length === 0) return { found: false, reason: "no-query" };
      try {
        const res = await apiRequest("POST", "/api/pt-finder/refund-search", { queries });
        return await res.json();
      } catch {
        return { found: false, reason: "error" };
      }
    })();

    const [cvResult, paymentResult, trackerResult, refundResult] = await Promise.all([cvPromise, paymentPromise, trackerPromise, refundPromise]);

    setCvDataMap((prev) => ({ ...prev, [msg.ts]: cvResult }));
    setPaymentsMap((prev) => ({ ...prev, [msg.ts]: paymentResult }));
    setTrackerMatchMap((prev) => ({ ...prev, [msg.ts]: trackerResult }));
    setRefundDataMap((prev) => ({ ...prev, [msg.ts]: refundResult }));
    const now = new Date();
    setLastPulledTime(now);
    setLastPulledPerMsg((prev) => ({ ...prev, [msg.ts]: now }));
  };

  const handleCheckAllPayments = async () => {
    if (!baseMessages || baseMessages.length === 0) return;
    const msgsToCheck = baseMessages.filter((msg) => passesBaseFilters(msg));
    if (msgsToCheck.length === 0) {
      toast({ title: "No messages to check", variant: "destructive" });
      return;
    }
    setPaymentsLoading(true);
    setPaymentsProgress({ done: 0, total: msgsToCheck.length });
    const newMap: typeof paymentsMap = {};
    const CONCURRENCY = 3;

    for (let i = 0; i < msgsToCheck.length; i += CONCURRENCY) {
      const batch = msgsToCheck.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          const extracted = extractCaseFromSlackMsg(msg.text);
          if (!extracted || (!extracted.link && !extracted.caseId)) {
            return { ts: msg.ts, data: { found: false, message: "No case link or ID found" } };
          }
          try {
            const res = await apiRequest("POST", "/api/stripe-payments/lookup-by-case", {
              caseLink: extracted.link || undefined,
              caseId: extracted.caseId || undefined,
            });
            const result = await res.json();
            return { ts: msg.ts, data: result };
          } catch (err: any) {
            return { ts: msg.ts, data: { found: false, error: err.message || "Lookup failed" } };
          }
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          newMap[r.value.ts] = r.value.data;
        }
      }
      setPaymentsProgress((prev) => ({ ...prev, done: Math.min(prev.done + batch.length, msgsToCheck.length) }));
    }
    setPaymentsMap((prev) => ({ ...prev, ...newMap }));
    setPaymentsLoading(false);
    const now2 = new Date();
    setLastPulledTime(now2);
    setLastPulledPerMsg((prev) => {
      const updated = { ...prev };
      for (const m of msgsToCheck) updated[m.ts] = now2;
      return updated;
    });
    toast({ title: `Payment check complete (${msgsToCheck.length} messages)` });
  };

  const handleSyncDataCv = async () => {
    if (!baseMessages || baseMessages.length === 0) return;
    const msgsToSync = baseMessages.filter((msg) => passesBaseFilters(msg));
    if (msgsToSync.length === 0) {
      toast({ title: "No messages to sync", variant: "destructive" });
      return;
    }
    setCvSyncLoading(true);
    setCvSyncProgress({ done: 0, total: msgsToSync.length });
    const newMap: typeof cvDataMap = {};
    const CONCURRENCY = 3;

    for (let i = 0; i < msgsToSync.length; i += CONCURRENCY) {
      const batch = msgsToSync.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          const extracted = extractCaseFromSlackMsg(msg.text);
          if (!extracted || !extracted.link) {
            return { ts: msg.ts, data: { found: false, error: "No case link found" } as typeof cvDataMap[string] };
          }
          try {
            const res = await apiRequest("POST", "/api/carevalidate/lookup-case", {
              link: extracted.link,
            });
            const result = await res.json();
            return { ts: msg.ts, data: result as typeof cvDataMap[string] };
          } catch (err: any) {
            const msg401 = err.message?.includes("401") || err.message?.includes("expired");
            return { ts: msg.ts, data: { found: false, error: msg401 ? "Token expired" : (err.message || "Lookup failed") } as typeof cvDataMap[string] };
          }
        })
      );
      let tokenExpired = false;
      for (const r of results) {
        if (r.status === "fulfilled") {
          newMap[r.value.ts] = r.value.data;
          if (r.value.data.error === "Token expired") tokenExpired = true;
        }
      }
      setCvSyncProgress((prev) => ({ ...prev, done: Math.min(prev.done + batch.length, msgsToSync.length) }));
      if (tokenExpired) {
        toast({ title: "CareValidate token expired. Please update it in CV Report.", variant: "destructive" });
        break;
      }
    }
    setCvDataMap((prev) => ({ ...prev, ...newMap }));
    setCvSyncLoading(false);
    const now3 = new Date();
    setLastPulledTime(now3);
    setLastPulledPerMsg((prev) => {
      const updated = { ...prev };
      for (const m of msgsToSync) updated[m.ts] = now3;
      return updated;
    });
    const successCount = Object.values(newMap).filter(d => d.found).length;
    toast({ title: `CV sync complete — ${successCount}/${msgsToSync.length} found` });
  };

  const filteredMessages = baseMessages.filter((msg) => {
    if (!passesBaseFilters(msg)) return false;
    if (replyFilters.length > 0) {
      for (const rf of replyFilters) {
        if (rf === "no-reply") {
          if (msg.reply_count > 0) return false;
        } else {
          const matched = replyFilterMatchedMap[rf];
          if (!matched) return false;
          if (!matched[msg.ts]) return false;
        }
      }
    }
    return true;
  });

  const prefetchTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const filteredTsKey = filteredMessages.map((m) => m.ts).join(",");
  useEffect(() => {
    prefetchTimeoutsRef.current.forEach(clearTimeout);
    prefetchTimeoutsRef.current = [];

    const candidates = filteredMessages.filter(
      (msg) =>
        msg.reply_count > 0 &&
        !queryClient.getQueryData(["/api/slack/channels", CHANNEL_ID, "replies", msg.ts])
    );

    const limit = dateFilter ? candidates.length : 15;
    const stagger = dateFilter ? 1200 : 2000;
    const toFetch = candidates.slice(0, limit);

    toFetch.forEach((msg, idx) => {
      const t = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: ["/api/slack/channels", CHANNEL_ID, "replies", msg.ts],
          queryFn: async () => {
            const res = await fetch(`/api/slack/channels/${CHANNEL_ID}/replies/${msg.ts}`);
            if (!res.ok) throw new Error("Failed to prefetch replies");
            return res.json() as Promise<ThreadReply[]>;
          },
          staleTime: 5 * 60 * 1000,
        });
      }, idx * stagger);
      prefetchTimeoutsRef.current.push(t);
    });

    return () => {
      prefetchTimeoutsRef.current.forEach(clearTimeout);
    };
  }, [dateFilter, filteredTsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function getUserName(userId: string) {
    if (!users || !users[userId]) return userId;
    const u = users[userId];
    return u.display_name || u.real_name || u.name || userId;
  }

  function getUserAvatar(userId: string) {
    if (!users || !users[userId]) return "";
    return users[userId].avatar;
  }

  if (!slackStatus?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Slack Backlog All</h2>
          <p className="text-sm text-muted-foreground mt-1">View and manage cases from #trimrx--cv--support</p>
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Slack Backlog All</h2>
          <p className="text-sm text-muted-foreground mt-1">#trimrx--cv--support</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by Case ID, link, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-[260px] pr-8"
              data-testid="input-search-messages"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="done">Done ✅</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mentionFilter} onValueChange={setMentionFilter}>
            <SelectTrigger className="h-9 w-[200px]" data-testid="select-mention-filter">
              <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter by mention" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="both">Olia or Karla</SelectItem>
              <SelectItem value="olia">@Olia Orlowska</SelectItem>
              <SelectItem value="karla">@Karla Garibay</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={hideReplies ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setHideReplies(!hideReplies)}
            data-testid="button-hide-replies"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            {hideReplies ? "Replies Hidden" : "Hide Replies"}
          </Button>
          {can("slack-backlog-all", "reply-filter") && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-[220px] justify-between text-sm font-normal" disabled={replyFilterLoading} data-testid="select-reply-filter">
                {replyFilterLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    <span className="text-xs">Scanning {replyScanProgress.scanned}/{replyScanProgress.total}...</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 truncate">
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      {replyFilters.length === 0 ? "All Replies" : `${replyFilters.length} filter${replyFilters.length > 1 ? "s" : ""}`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-2" align="start">
              <div className="flex flex-col gap-1">
                {REPLY_FILTER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                    data-testid={`reply-filter-${opt.value}`}
                  >
                    <Checkbox
                      checked={replyFilters.includes(opt.value)}
                      onCheckedChange={() => handleReplyFilterToggle(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
                {replyFilters.length > 0 && (
                  <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={clearReplyFilters}>
                    <X className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          )}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-9 pr-8 h-9 w-[180px]"
                data-testid="input-date-filter"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-date"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {dateFilter && slackStatus?.socketModeActive && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium" title="Receiving live updates via Socket Mode">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              forceRefreshRef.current = true;
              setReplyFilters([]);
              setReplyFilterMatchedMap({});
              try { await fetch("/api/slack/clear-scan-cache", { method: "POST" }); } catch {}
              refetchMessages();
            }}
            disabled={loadingMessages}
            data-testid="button-refresh-messages"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingMessages ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {Object.keys(cvStatusMap).length > 0 && (
            <>
              <Select value={cvFilter} onValueChange={setCvFilter}>
                <SelectTrigger className="h-9 w-[180px]" data-testid="select-cv-filter">
                  <SelectValue placeholder="CV Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CV Status</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="open">Open / Active</SelectItem>
                  <SelectItem value="no-match">No CV Match</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCvStatusMap({}); setCvFilter("all"); }}
                data-testid="button-clear-cv-status"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </>
          )}
          {Object.keys(trackerMatchMap).length > 0 && (
            <>
              <Select value={trackerFilter} onValueChange={setTrackerFilter}>
                <SelectTrigger className="h-9 w-[200px]" data-testid="select-tracker-filter">
                  <SelectValue placeholder="Tracker Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tracker Status</SelectItem>
                  <SelectItem value="in-tracker">Already in Tracker</SelectItem>
                  <SelectItem value="not-in-tracker">Not Found on Tracker</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setTrackerMatchMap({}); setTrackerFilter("all"); }}
                data-testid="button-clear-tracker"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </>
          )}
          <Button
            variant={expandAllReplies ? "default" : "outline"}
            size="sm"
            onClick={() => setExpandAllReplies((prev) => !prev)}
            data-testid="button-expand-all-replies"
          >
            {expandAllReplies ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
            {expandAllReplies ? "Collapse All" : "Expand All"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <SendToCvReportDialog messages={filteredMessages} dateFilter={dateFilter} />
          <Popover open={dataSyncOpen} onOpenChange={setDataSyncOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-data-sync">
                <Database className="h-4 w-4" />
                Data &amp; Sync
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1" data-testid="popover-data-sync">
              <div className="space-y-0.5">
                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data &amp; Sync</p>
                {can("slack-backlog-all", "check-cv-status") && (
                  <button
                    onClick={() => { checkCvStatus(); setDataSyncOpen(false); }}
                    disabled={cvStatusLoading || !messages || messages.length === 0}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
                    data-testid="button-check-cv-status"
                  >
                    {cvStatusLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileSpreadsheet className="h-4 w-4 shrink-0" />}
                    <span>Check CV Status</span>
                    {Object.keys(cvStatusMap).length > 0 && <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">Active</Badge>}
                  </button>
                )}
                <button
                  onClick={() => { matchTrackerData(); setDataSyncOpen(false); }}
                  disabled={trackerMatchLoading || !messages || messages.length === 0}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
                  data-testid="button-match-data"
                >
                  {trackerMatchLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Database className="h-4 w-4 shrink-0" />}
                  <span>Match Data</span>
                  {Object.keys(trackerMatchMap).length > 0 && <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">Active</Badge>}
                </button>
                {can("slack-backlog-all", "top-toolbar-tools") && (
                  <>
                    <button
                      onClick={() => { handleCheckAllPayments(); setDataSyncOpen(false); }}
                      disabled={paymentsLoading}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
                      data-testid="button-check-all-payments"
                    >
                      {paymentsLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span>Checking... ({paymentsProgress.done}/{paymentsProgress.total})</span></>
                      ) : (
                        <><CreditCard className="h-4 w-4 shrink-0" /><span>Check all Payments</span></>
                      )}
                    </button>
                    <button
                      onClick={() => { handleSyncDataCv(); setDataSyncOpen(false); }}
                      disabled={cvSyncLoading}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
                      data-testid="button-sync-data-cv"
                    >
                      {cvSyncLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span>Syncing... ({cvSyncProgress.done}/{cvSyncProgress.total})</span></>
                      ) : (
                        <><Database className="h-4 w-4 shrink-0" /><span>Sync Data CV</span></>
                      )}
                    </button>
                    <button
                      onClick={() => { matchTrackerData(); setDataSyncOpen(false); }}
                      disabled={trackerMatchLoading}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
                      data-testid="button-tracker-data-sync"
                    >
                      {trackerMatchLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span>Syncing...</span></>
                      ) : (
                        <><FileSpreadsheet className="h-4 w-4 shrink-0" /><span>Tracker Data Sync</span></>
                      )}
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={bulkActionsOpen} onOpenChange={setBulkActionsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-bulk-actions">
                <ListChecks className="h-4 w-4" />
                Bulk Actions
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1" data-testid="popover-bulk-actions">
              <div className="space-y-0.5">
                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bulk Operations</p>
                <button
                  onClick={() => { setBulkActionsOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent transition-colors"
                  data-testid="button-mark-done-no-comments"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                  <span>Mark As Done no comments</span>
                </button>
                <button
                  onClick={() => { setBulkActionsOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent transition-colors"
                  data-testid="button-mark-done-close-case"
                >
                  <XCircle className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>Mark Done Close Case</span>
                </button>
                <button
                  onClick={() => { setBulkActionsOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left hover:bg-accent transition-colors"
                  data-testid="button-mark-done-refund-requested"
                >
                  <DollarSign className="h-4 w-4 shrink-0 text-orange-500" />
                  <span>Mark Done Refund Requested</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isSearchMode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {loadingSearch ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</>
          ) : (
            <span data-testid="text-search-count">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""} found for "{debouncedSearch}"
            </span>
          )}
        </div>
      )}

      {(loadingMessages && !messages) || (isSearchMode && loadingSearch) ? (
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
          {filteredMessages.map((msg, idx) => (
            <MessageCard
              key={msg.ts}
              msg={msg}
              expandIndex={idx}
              getUserName={getUserName}
              getUserAvatar={getUserAvatar}
              users={users}
              expandedThreads={expandedThreads}
              setExpandedThreads={setExpandedThreads}
              expandAllReplies={expandAllReplies}
              replyText={replyText}
              setReplyText={setReplyText}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyBroadcast={replyBroadcast}
              setReplyBroadcast={setReplyBroadcast}
              replyMutation={replyMutation}
              reactMutation={reactMutation}
              unreactMutation={unreactMutation}
              deleteMessageMutation={deleteMessageMutation}
              channelId={CHANNEL_ID}
              cvStatus={cvStatusMap[msg.ts]}
              trackerMatch={Object.keys(trackerMatchMap).length > 0 ? trackerMatchMap[msg.ts] : undefined}
              showTrackerStatus={Object.keys(trackerMatchMap).length > 0}
              showCheckbox={Object.keys(cvStatusMap).length > 0}
              isSelected={selectedMessages.has(msg.ts)}
              onToggleSelect={() => toggleSelectMessage(msg.ts)}
              paymentData={paymentsMap[msg.ts]}
              cvData={cvDataMap[msg.ts]}
              refundData={refundDataMap[msg.ts]}
              lastPulledTime={lastPulledPerMsg[msg.ts] || lastPulledTime}
              onPullSingle={handlePullSingle}
              socketModeActive={slackStatus?.socketModeActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ReplyTemplate = { id: string; subject: string; text: string };

function ReplyWithTemplates({
  msgTs,
  threadTs,
  replyText,
  setReplyText,
  replyMutation,
  agentNotes,
  replyBroadcast,
  setReplyBroadcast,
}: {
  msgTs: string;
  threadTs: string;
  replyText: Record<string, string>;
  setReplyText: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  replyMutation: any;
  agentNotes?: string;
  replyBroadcast?: boolean;
  setReplyBroadcast?: (v: boolean) => void;
}) {
  const { data: templates } = useQuery<ReplyTemplate[]>({
    queryKey: ["/api/slack/reply-templates"],
  });

  const selectTemplate = (template: ReplyTemplate) => {
    setReplyText((prev) => ({ ...prev, [msgTs]: template.text }));
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-1.5 flex-wrap" data-testid={`templates-bar-${msgTs}`}>
        {agentNotes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setReplyText((prev) => ({ ...prev, [msgTs]: agentNotes }))}
                data-testid={`button-reply-agent-notes-${msgTs}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200 hover:border-yellow-400 transition-all cursor-pointer dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700 dark:hover:bg-yellow-900/50"
              >
                <ClipboardList className="h-3 w-3" />
                Reply Agent Notes
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {agentNotes.length > 150 ? agentNotes.slice(0, 150) + "..." : agentNotes}
            </TooltipContent>
          </Tooltip>
        )}
        {templates && templates.length > 0 && templates.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => selectTemplate(t)}
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
      <div className="flex gap-2">
        <Textarea
          placeholder="Type your reply..."
          value={replyText[msgTs] || ""}
          onChange={(e) => setReplyText((prev) => ({ ...prev, [msgTs]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && (replyText[msgTs] || "").trim()) {
              e.preventDefault();
              replyMutation.mutate({ threadTs, text: (replyText[msgTs] || "").trim(), broadcast: replyBroadcast });
            }
          }}
          rows={2}
          className="text-sm resize-none flex-1"
          data-testid={`input-reply-${msgTs}`}
        />
        <Button
          size="sm"
          onClick={() => replyMutation.mutate({ threadTs, text: replyText[msgTs] || "", broadcast: replyBroadcast })}
          disabled={!replyText[msgTs]?.trim() || replyMutation.isPending}
          data-testid={`button-send-reply-${msgTs}`}
        >
          {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {setReplyBroadcast && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none mt-1" data-testid={`checkbox-broadcast-${msgTs}`}>
          <input
            type="checkbox"
            checked={replyBroadcast || false}
            onChange={(e) => setReplyBroadcast(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          Also send to <span className="font-medium text-foreground">#trimrx--cv--support</span>
        </label>
      )}
    </div>
  );
}

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
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
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

                  {data.customers?.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <p>No Stripe customer found for this email</p>
                    </div>
                  )}

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
                              <StripeStatusBadge status={sub.status} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(sub.created).toLocaleDateString()}
                              </span>
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
                            {data.paymentIntents.map((pi: any) => {
                              const displayStatus = pi.lastError && pi.status !== "succeeded" ? "failed" : pi.status;
                              const isExpanded = expandedPopupPiId === pi.id;
                              return (
                                <Fragment key={pi.id}>
                                  <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedPopupPiId(isExpanded ? null : pi.id)}>
                                    <td className="p-2 text-xs whitespace-nowrap">
                                      {new Date(pi.created).toLocaleString("en-US", { timeZone: "America/New_York" })}
                                    </td>
                                    <td className="p-2 whitespace-nowrap font-medium">
                                      ${pi.amount.toFixed(2)} {pi.currency}
                                    </td>
                                    <td className="p-2">
                                      <StripeStatusBadge status={displayStatus} />
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
                                        <PIActivityInline piId={pi.id} />
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
                    <div className="text-center py-6 text-muted-foreground">
                      <p>No payment intents found</p>
                    </div>
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

function MessageCard({
  msg,
  getUserName,
  getUserAvatar,
  users,
  expandedThreads,
  setExpandedThreads,
  expandAllReplies,
  replyText,
  setReplyText,
  replyingTo,
  setReplyingTo,
  replyBroadcast,
  setReplyBroadcast,
  replyMutation,
  reactMutation,
  unreactMutation,
  deleteMessageMutation,
  channelId,
  cvStatus,
  trackerMatch,
  showTrackerStatus,
  showCheckbox,
  isSelected,
  onToggleSelect,
  paymentData,
  cvData,
  refundData,
  lastPulledTime,
  onPullSingle,
  expandIndex = 0,
  socketModeActive,
}: {
  msg: SlackMessage;
  getUserName: (id: string) => string;
  getUserAvatar: (id: string) => string;
  users?: Record<string, SlackUser>;
  expandedThreads: Set<string>;
  setExpandedThreads: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandAllReplies?: boolean;
  expandIndex?: number;
  replyText: Record<string, string>;
  setReplyText: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  replyingTo: string | null;
  setReplyingTo: (ts: string | null) => void;
  replyBroadcast?: boolean;
  setReplyBroadcast?: (v: boolean) => void;
  replyMutation: any;
  reactMutation: any;
  unreactMutation: any;
  deleteMessageMutation: any;
  channelId: string;
  cvStatus?: { status: string; caseId: string; id: number };
  trackerMatch?: Record<string, string> | null;
  showTrackerStatus?: boolean;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  paymentData?: { email?: string; paymentIntents?: any[]; subscriptions?: any[]; customers?: any[]; found?: boolean; message?: string; error?: string };
  cvData?: { name?: string; email?: string; status?: string; found?: boolean; error?: string };
  refundData?: { found?: boolean; record?: Record<string, string>; headers?: string[]; message?: string; statusFromP?: string; reason?: string } | null;
  lastPulledTime?: Date | null;
  onPullSingle?: (msg: SlackMessage) => Promise<void>;
  socketModeActive?: boolean;
}) {
  const { can } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const threadTs = msg.thread_ts || msg.ts;
  const isExpanded = expandAllReplies || expandedThreads.has(msg.ts);
  const isReplying = replyingTo === msg.ts;
  const checked = hasCheckmark(msg.reactions);
  const slackLink = `https://app.slack.com/client/${WORKSPACE_ID}/${channelId}/p${msg.ts.replace(".", "")}`;
  const [sendingCv, setSendingCv] = useState(false);
  const [cvSent, setCvSent] = useState(false);
  const [pullingSingle, setPullingSingle] = useState(false);
  const [expandedSidebarPiId, setExpandedSidebarPiId] = useState<string | null>(null);

  const [expandReady, setExpandReady] = useState(!expandAllReplies);
  useEffect(() => {
    if (expandAllReplies && isExpanded && msg.reply_count > 0) {
      const delay = Math.floor(expandIndex / 3) * 3000;
      const timer = setTimeout(() => setExpandReady(true), delay);
      return () => clearTimeout(timer);
    } else if (!expandAllReplies) {
      setExpandReady(true);
    }
  }, [expandAllReplies, isExpanded, expandIndex, msg.reply_count]);

  const sendSingleToCv = async () => {
    const extracted = extractCaseFromSlackMsg(msg.text);
    if (!extracted || (!extracted.link && !extracted.caseId)) {
      toast({ title: "Cannot extract case data from this message", variant: "destructive" });
      return;
    }
    setSendingCv(true);
    try {
      let reason = "";
      let subReason = "";
      let desiredAction = "";
      let clientThreat = "";
      let confidence = 0;

      if (extracted.concern) {
        try {
          const analyzeRes = await apiRequest("POST", "/api/custom-gpt/analyze", { concern: extracted.concern });
          const analysis = await analyzeRes.json();
          reason = analysis.reason || "";
          subReason = analysis.subReason || "";
          desiredAction = analysis.desiredAction || "";
          clientThreat = analysis.clientThreat || "";
          confidence = analysis.confidence || 0;
        } catch {
          reason = "Uncategorized";
          subReason = "Other";
          desiredAction = "Cancel";
          confidence = 0;
        }
      } else {
        reason = "Uncategorized";
        subReason = "Other";
        desiredAction = "Cancel";
        confidence = 0;
      }

      const msgDate = new Date(parseFloat(msg.ts) * 1000);
      const slackParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Guatemala", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(msgDate);
      const slackMonth = slackParts.find(p => p.type === "month")!.value;
      const slackDay = slackParts.find(p => p.type === "day")!.value;
      const slackYear = slackParts.find(p => p.type === "year")!.value.slice(-2);
      const formattedDate = `${slackMonth}/${slackDay}/${slackYear}`;

      await apiRequest("POST", "/api/cv-reports", {
        caseId: extracted.caseId || "",
        link: extracted.link || "",
        notesTrimrx: extracted.concern || "",
        reason,
        subReason,
        desiredAction,
        confidence,
        status: "",
        duplicated: "",
        customerEmail: "",
        date: formattedDate,
        name: "",
        productType: "",
        clientThreat,
        submittedBy: user?.username || "",
        assignedTo: user?.username || "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      setCvSent(true);
      toast({ title: `Sent to CV Report — ${reason} / ${subReason}` });
    } catch (err: any) {
      toast({ title: "Failed to send to CV Report", description: err.message, variant: "destructive" });
    } finally {
      setSendingCv(false);
    }
  };

  const { data: threadReplies, isLoading: loadingReplies } = useQuery<ThreadReply[]>({
    queryKey: ["/api/slack/channels", channelId, "replies", msg.ts],
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      if (signal) signal.addEventListener("abort", () => controller.abort());
      try {
        const res = await fetch(`/api/slack/channels/${channelId}/replies/${msg.ts}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch replies");
        return res.json();
      } finally {
        clearTimeout(timeout);
      }
    },
    enabled: isExpanded && expandReady && msg.reply_count > 0,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchInterval: isExpanded ? 30000 : false,
  });

  const replyResolvedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!threadReplies || !users) return;
    const unknownIds = new Set<string>();
    const userIdPattern = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
    for (const reply of threadReplies) {
      if (reply.user && !users[reply.user] && !replyResolvedRef.current.has(reply.user)) unknownIds.add(reply.user);
      let match;
      while ((match = userIdPattern.exec(reply.text)) !== null) {
        if (!users[match[1]] && !replyResolvedRef.current.has(match[1])) unknownIds.add(match[1]);
      }
    }
    if (unknownIds.size === 0) return;
    const ids = Array.from(unknownIds).slice(0, 50);
    ids.forEach((id) => replyResolvedRef.current.add(id));
    apiRequest("POST", "/api/slack/users/resolve", { userIds: ids })
      .then((res) => res.json())
      .then((resolved) => {
        if (resolved && Object.keys(resolved).length > 0) {
          queryClient.setQueryData<Record<string, SlackUser>>(["/api/slack/users"], (old) => ({ ...old, ...resolved }));
        }
      })
      .catch(() => {});
  }, [threadReplies, users]);

  const isReply = msg.thread_ts && msg.thread_ts !== msg.ts;
  const parentPreview = msg.parent_text
    ? msg.parent_text.replace(/<@[A-Z0-9]+>/g, "").replace(/<[^>]+>/g, "").replace(/\*/g, "").trim().slice(0, 120)
    : "";

  return (
    <Card className={`border-l-4 ${checked ? "border-l-green-400 border-green-300 bg-green-50/30 dark:border-l-green-600 dark:border-green-800 dark:bg-green-950/20" : "border-l-blue-400 dark:border-l-blue-600"} ${isSelected ? "border-primary ring-1 ring-primary/30" : ""}`} data-testid={`msg-${msg.ts}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-3">
        {isReply && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-xs" data-testid={`reply-indicator-${msg.ts}`}>
            <CornerDownRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-medium text-blue-600 dark:text-blue-400">Replying to {msg.parent_user ? getUserName(msg.parent_user) : "a message"}</span>
              {parentPreview && <p className="text-muted-foreground mt-0.5 line-clamp-2">{parentPreview}</p>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 mt-2 rounded border-border accent-primary cursor-pointer flex-shrink-0"
              data-testid={`checkbox-msg-${msg.ts}`}
            />
          )}
          {getUserAvatar(msg.user) ? (
            <img src={getUserAvatar(msg.user)} alt="" className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
              {getUserName(msg.user).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 relative">
            <div className="absolute top-0 right-0 flex items-center gap-1.5">
              {can("slack-backlog-all", "send-to-cv") && !cvSent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendSingleToCv}
                  disabled={sendingCv}
                  className="h-8 text-xs gap-1"
                  data-testid={`button-send-single-cv-${msg.ts}`}
                >
                  {sendingCv ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  {sendingCv ? "Sending..." : "Send to CV"}
                </Button>
              )}
              {cvSent && (
                <Badge
                  variant="secondary"
                  className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  data-testid={`badge-cv-sent-${msg.ts}`}
                >
                  <CheckCircle className="h-3 w-3" />
                  Sent to CV
                </Badge>
              )}
              <NeedHelpButton msg={msg} getUserName={getUserName} />
            </div>
            <div className="flex items-center gap-2 flex-wrap pr-48">
              <span className="font-semibold text-sm" data-testid={`text-user-${msg.ts}`}>{getUserName(msg.user)}</span>
              <span className="text-xs text-muted-foreground">{formatTs(msg.ts)}</span>
              {isReply && <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"><CornerDownRight className="h-3 w-3" /> Reply</Badge>}
              {checked && <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"><CheckSquare className="h-3 w-3" /> Done</Badge>}
              {cvStatus && cvStatus.status && (
                <Badge
                  variant="secondary"
                  className={`text-xs gap-1 ${
                    cvStatus.status.toLowerCase().startsWith("closed") || cvStatus.status.toUpperCase() === "REJECTED"
                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      : cvStatus.status.toLowerCase().includes("approved")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}
                  data-testid={`badge-cv-status-${msg.ts}`}
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  {cvStatus.status}
                </Badge>
              )}
              {cvStatus && !cvStatus.status && (
                <Badge variant="outline" className="text-xs gap-1" data-testid={`badge-cv-no-status-${msg.ts}`}>
                  <FileSpreadsheet className="h-3 w-3" />
                  In CV (no status)
                </Badge>
              )}
              {showTrackerStatus && trackerMatch !== undefined && (
                trackerMatch !== null ? (
                  <Badge
                    variant="secondary"
                    className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    data-testid={`badge-tracker-found-${msg.ts}`}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Already in Tracker
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-xs gap-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    data-testid={`badge-tracker-not-found-${msg.ts}`}
                  >
                    <XOctagon className="h-3 w-3" />
                    Not Found on Tracker
                  </Badge>
                )
              )}
            </div>
            <div
              className="text-sm mt-1 break-words"
              dangerouslySetInnerHTML={{ __html: formatSlackText(msg.text, users) }}
              data-testid={`text-msg-${msg.ts}`}
            />
            {msg.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.attachments.map((att, i) => (
                  <div key={i} className="border-l-2 pl-3 py-1.5 text-xs text-muted-foreground bg-muted/30 rounded-r-md" style={{ borderColor: att.color ? `#${att.color}` : 'hsl(var(--border))' }}>
                    {att.title && <p className="font-medium text-muted-foreground/80">{att.title}</p>}
                    {att.text && <p className="opacity-70">{att.text}</p>}
                    {att.service_name && <p className="text-[11px] opacity-50">{att.service_name}</p>}
                  </div>
                ))}
              </div>
            )}
            {cvStatus && (
              <div className="mt-2 flex items-center gap-2 bg-muted/50 rounded px-2.5 py-1.5 text-xs" data-testid={`cv-info-${msg.ts}`}>
                <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">CV Report #{cvStatus.id}</span>
                <span className="text-muted-foreground">•</span>
                <span>{cvStatus.caseId}</span>
                {cvStatus.status && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className={`font-medium ${
                      cvStatus.status.toLowerCase().startsWith("closed") || cvStatus.status.toUpperCase() === "REJECTED"
                        ? "text-red-600 dark:text-red-400"
                        : cvStatus.status.toLowerCase().includes("approved")
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-yellow-600 dark:text-yellow-400"
                    }`}>{cvStatus.status}</span>
                  </>
                )}
                <span className="text-muted-foreground">•</span>
                <span>{msg.reply_count} {msg.reply_count === 1 ? "comment" : "comments"}</span>
              </div>
            )}
            {showTrackerStatus && trackerMatch && (
              <div className="mt-2 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2.5 py-1.5 text-xs flex-wrap" data-testid={`tracker-info-${msg.ts}`}>
                <Database className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                {getTrackerField(trackerMatch, "Customer Email", "Customer Email.", "Email", "email") && (
                  <span><strong>Email:</strong> {getTrackerField(trackerMatch, "Customer Email", "Customer Email.", "Email", "email")}</span>
                )}
                {getTrackerField(trackerMatch, "Agent Assigned", "agent_assigned") && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span><strong>Agent:</strong> {getTrackerField(trackerMatch, "Agent Assigned", "agent_assigned")}</span>
                  </>
                )}
                {getTrackerField(trackerMatch, "Request Status", "Status", "status") && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span><strong>Status:</strong> {getTrackerField(trackerMatch, "Request Status", "Status", "status")}</span>
                  </>
                )}
                {getTrackerField(trackerMatch, "OUTCOME", "Outcome", "outcome") && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span><strong>Outcome:</strong> {getTrackerField(trackerMatch, "OUTCOME", "Outcome", "outcome")}</span>
                  </>
                )}
                {getTrackerField(trackerMatch, "TICKET COMPLETION DATE", "Completion Date") && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span><strong>Completed:</strong> {getTrackerField(trackerMatch, "TICKET COMPLETION DATE", "Completion Date")}</span>
                  </>
                )}
              </div>
            )}
            {showTrackerStatus && trackerMatch === null && (
              <div className="mt-2 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded px-2.5 py-1.5 text-xs" data-testid={`tracker-not-found-${msg.ts}`}>
                <XOctagon className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-300 font-medium">Not found on tracker</span>
              </div>
            )}
            {msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {msg.reactions.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    <EmojiDisplay name={r.name} />
                    <span className="font-medium">{r.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        {can("slack-backlog-all", "right-panel") && (
        <div className="w-[280px] flex-shrink-0 border-l pl-3 space-y-3">
          {lastPulledTime && (
            <div className="flex items-center justify-between gap-1 pb-1 border-b">
              <span className="text-[10px] text-muted-foreground" data-testid={`last-pulled-${msg.ts}`}>
                Last pulled: {lastPulledTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} {lastPulledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={async () => {
                  if (onPullSingle) {
                    setPullingSingle(true);
                    await onPullSingle(msg);
                    setPullingSingle(false);
                  }
                }}
                disabled={pullingSingle}
                data-testid={`button-pull-again-${msg.ts}`}
              >
                {pullingSingle ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                <span className="ml-0.5">Pull again</span>
              </Button>
            </div>
          )}
          <div data-testid={`panel-cv-${msg.ts}`}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">CV</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground truncate max-w-[160px]" title={cvData?.name || ""} data-testid={`cv-name-${msg.ts}`}>{cvData?.found ? (cvData.name || "—") : "—"}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground truncate max-w-[160px]" title={cvData?.email || ""} data-testid={`cv-email-${msg.ts}`}>{cvData?.found ? (cvData.email || "—") : "—"}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium truncate max-w-[160px] ${cvData?.found && cvData.status ? (cvData.status.toLowerCase().includes("approved") ? "text-green-600 dark:text-green-400" : cvData.status.toLowerCase().includes("closed") || cvData.status.toLowerCase().includes("denied") ? "text-red-600 dark:text-red-400" : "text-foreground") : "text-foreground"}`} data-testid={`cv-status-${msg.ts}`}>{cvData?.found ? (cvData.status || "—") : cvData?.error ? <span className="text-red-500 text-[10px]">{cvData.error}</span> : "—"}</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-2" data-testid={`panel-payments-${msg.ts}`}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payments</h4>
            {paymentData ? (
              <div className="space-y-1.5 text-xs">
                {paymentData.email && (
                  <div className="flex justify-between gap-1">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground truncate max-w-[160px]" title={paymentData.email} data-testid={`payments-email-${msg.ts}`}>{paymentData.email}</span>
                  </div>
                )}
                {paymentData.found && paymentData.paymentIntents && paymentData.paymentIntents.length > 0 ? (
                  <div className="space-y-1" data-testid={`payments-intents-${msg.ts}`}>
                    {paymentData.paymentIntents.map((pi: any, idx: number) => {
                      const displayStatus = pi.lastError && pi.status !== "succeeded" ? "failed" : pi.status;
                      const isSidebarExpanded = expandedSidebarPiId === pi.id;
                      return (
                      <div key={pi.id || idx} className="border rounded px-2 py-1 bg-muted/30 cursor-pointer" onClick={() => setExpandedSidebarPiId(isSidebarExpanded ? null : pi.id)}>
                        <div className="flex justify-between items-center gap-1">
                          <span className="font-medium">${pi.amount?.toFixed(2)} {pi.currency}</span>
                          <div className="flex items-center gap-1">
                            <StripeStatusBadge status={displayStatus} size="xs" />
                            {isSidebarExpanded ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(pi.created).toLocaleDateString("en-US", { timeZone: "America/New_York" })} — {pi.description || "—"}
                        </div>
                        {isSidebarExpanded && (
                          <div className="mt-1 border-t pt-1" onClick={(e) => e.stopPropagation()}>
                            <PIActivityInline piId={pi.id} />
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : paymentData.found && paymentData.customers && paymentData.customers.length > 0 ? (
                  <span className="text-muted-foreground italic" data-testid={`payments-info-${msg.ts}`}>No payment intents</span>
                ) : paymentData.error ? (
                  <span className="text-red-500" data-testid={`payments-info-${msg.ts}`}>{paymentData.error}</span>
                ) : (
                  <span className="text-muted-foreground italic" data-testid={`payments-info-${msg.ts}`}>{paymentData.message || "No data"}</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                <span data-testid={`payments-info-${msg.ts}`}>—</span>
              </div>
            )}
          </div>
          <div className="border-t pt-2" data-testid={`panel-tracker-${msg.ts}`}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tracker</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Agent Assigned</span>
                <span className="font-medium text-foreground truncate max-w-[160px]" title={trackerMatch ? getTrackerField(trackerMatch, "Agent Assigned", "agent_assigned") : ""} data-testid={`tracker-agent-${msg.ts}`}>{trackerMatch ? (getTrackerField(trackerMatch, "Agent Assigned", "agent_assigned") || "—") : "—"}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Outcome</span>
                <span className="font-medium text-foreground truncate max-w-[160px]" title={trackerMatch ? getTrackerField(trackerMatch, "OUTCOME", "Outcome", "outcome") : ""} data-testid={`tracker-outcome-${msg.ts}`}>{trackerMatch ? (getTrackerField(trackerMatch, "OUTCOME", "Outcome", "outcome") || "—") : "—"}</span>
              </div>
              <div className="flex justify-between gap-2 relative group/notes">
                <span className="text-muted-foreground whitespace-nowrap">TrimRx Agent Notes</span>
                <span className="font-medium text-foreground text-right truncate max-w-[140px] cursor-default" data-testid={`tracker-notes-${msg.ts}`}>{trackerMatch ? (getTrackerField(trackerMatch, "TrimRx Agent Notes", "trimrx_agent_notes") || "—") : "—"}</span>
                {trackerMatch && getTrackerField(trackerMatch, "TrimRx Agent Notes", "trimrx_agent_notes") && (
                  <div className="hidden group-hover/notes:block absolute right-0 top-full mt-1 z-50 w-[300px] p-3 rounded-lg shadow-lg bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-sm text-foreground whitespace-pre-wrap break-words">
                    {getTrackerField(trackerMatch, "TrimRx Agent Notes", "trimrx_agent_notes")}
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-1 items-start">
                <span className="text-muted-foreground whitespace-nowrap">Refund Status</span>
                <span className="font-medium text-right truncate max-w-[180px]" data-testid={`tracker-refund-${msg.ts}`}>
                  {refundData === undefined ? (
                    <span className="text-foreground">—</span>
                  ) : refundData === null || (!refundData.found && !refundData.reason) ? (
                    <span className="text-foreground">—</span>
                  ) : refundData.found ? (
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-blue-600 dark:text-blue-400">Refund case found</span>
                      {refundData.statusFromP ? (
                        <span className="text-[10px] text-muted-foreground">{refundData.statusFromP}</span>
                      ) : (
                        <span className="text-[10px] text-amber-500 italic">not updated yet</span>
                      )}
                    </span>
                  ) : (
                    <span className="font-bold text-red-600 dark:text-red-400">Refund not submitted</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}
        </div>

        <div className="flex items-center gap-2 pt-1 border-t">
          {can("slack-backlog-all", "mark-done") && (
            !checked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactMutation.mutate({ timestamp: msg.ts })}
                disabled={reactMutation.isPending}
                data-testid={`button-check-${msg.ts}`}
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
                data-testid={`button-uncheck-${msg.ts}`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Remove ✅
              </Button>
            )
          )}
          {can("slack-backlog-all", "reply") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyingTo(isReplying ? null : msg.ts)}
              data-testid={`button-reply-${msg.ts}`}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
          )}
          <PaymentIntentsButton msg={msg} />
          {msg.reply_count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedThreads(prev => {
                const next = new Set(prev);
                if (next.has(msg.ts)) next.delete(msg.ts); else next.add(msg.ts);
                return next;
              })}
              data-testid={`button-thread-${msg.ts}`}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
              {isExpanded && socketModeActive && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse ml-1" title="Updating live" />
              )}
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )}
          <a
            href={slackLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            data-testid={`link-slack-${msg.ts}`}
          >
            Open in Slack <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {isReplying && (
          <ReplyWithTemplates
            msgTs={msg.ts}
            threadTs={threadTs}
            replyText={replyText}
            setReplyText={setReplyText}
            replyMutation={replyMutation}
            agentNotes={trackerMatch ? getTrackerField(trackerMatch, "TrimRx Agent Notes", "trimrx_agent_notes") : undefined}
            replyBroadcast={replyBroadcast}
            setReplyBroadcast={setReplyBroadcast}
          />
        )}

        {isExpanded && (
          <div className="ml-4 pl-4 space-y-0 pt-2 border-l-2 border-border">
            {socketModeActive && (
              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live — new replies appear automatically
              </div>
            )}
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
                  {can("slack-backlog-all", "delete-message") && reply.bot_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => { if (confirm("Delete this reply?")) deleteMessageMutation.mutate({ timestamp: reply.ts }); }}
                      disabled={deleteMessageMutation.isPending}
                      data-testid={`button-delete-reply-${reply.ts}`}
                    >
                      <Trash2 className="h-3 w-3" />
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

