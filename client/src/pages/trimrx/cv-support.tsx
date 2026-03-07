import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import type { CvReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  HeadsetIcon,
  Send,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  ClipboardPaste,
  Bot,
  Save,
  Sparkles,
  CalendarIcon,
  ListChecks,
  Trash2,
  AlertCircle,
  Plus,
  X,
  Upload,
  Download,
} from "lucide-react";

interface ParsedCase {
  caseId: string;
  link: string;
  concern: string;
  selected: boolean;
}

function cleanConcernText(raw: string): string {
  let text = raw;
  text = text.replace(/\(edited\)\s*/gi, "");
  text = text.replace(/\s*careglp\.carevalidate\.com\s*\n?\s*Case\s*Management\s*\n?\s*Case\s*Management\s*by\s*CareValidate\s*/gi, "");
  text = text.replace(/\s*careglp\.carevalidate\.com\s*\n?\s*Case\s*Management\s*/gi, "");
  text = text.replace(/\s*careglp\.carevalidate\.com\s*/gi, "");
  text = text.trim();
  return text;
}

function parseText(text: string): { link: string; concern: string } {
  let link = "";
  let concern = "";

  const linkMatch = text.match(/Case\s*link\s*:\s*(https?:\/\/\S+)/i);
  if (linkMatch) {
    link = linkMatch[1].trim();
  }

  const concernMatch = text.match(/Concern\/Request\s*:\s*([\s\S]*)/i);
  if (concernMatch) {
    concern = cleanConcernText(concernMatch[1]);
  }

  return { link, concern };
}

function parseBulkText(text: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  const mentionPattern = /@(?:Olia|Karla)\s*[-–—]\s*TrimR[xX]/gi;

  const blocks: string[] = [];
  const lines = text.split("\n");
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isAgentLine = /^\w+[\w\s]*\(.*\d+[ap]m.*\)\s*\[/i.test(trimmed);
    const isHelloLine = /^Hello\s+@/i.test(trimmed);

    const isNewCaseStart = (isAgentLine || isHelloLine)
      && currentBlock.length > 0
      && currentBlock.some((l) => /Case\s*(ID|link)\s*:/i.test(l) || /Concern\/Request/i.test(l));

    if (isNewCaseStart) {
      blocks.push(currentBlock.join("\n"));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  for (const block of blocks) {
    mentionPattern.lastIndex = 0;
    if (!mentionPattern.test(block)) {
      mentionPattern.lastIndex = 0;
      continue;
    }
    mentionPattern.lastIndex = 0;

    const parsed = extractCaseFromBlock(block);
    if (parsed.link || parsed.concern) {
      cases.push({ ...parsed, selected: true });
    }
  }

  return cases;
}

function isBrokenLink(url: string): boolean {
  return /\[…\]|\.\.\.|…|\[\.\.\.\]/.test(url);
}

function extractCaseFromBlock(block: string): { caseId: string; link: string; concern: string } {
  let caseId = "";
  let link = "";
  let concern = "";

  const caseIdMatch = block.match(/Case\s*(?:ID|Id|id)\s*:\s*(\S+)/i);
  if (caseIdMatch) {
    caseId = caseIdMatch[1].trim();
  }

  const linkMatch = block.match(/Case\s*link\s*:\s*(https?:\/\/\S+)/i);
  if (linkMatch) {
    link = linkMatch[1].trim();
  } else {
    const urlMatch = block.match(/(https?:\/\/careglp\.carevalidate\.com\S*)/i);
    if (urlMatch) {
      link = urlMatch[1].trim();
    }
  }

  const concernMatch = block.match(/Concern\/Request\s*:\s*([\s\S]*)/i);
  if (concernMatch) {
    concern = cleanConcernText(concernMatch[1]);
  }

  return { caseId, link, concern };
}

export default function CvSupportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [pasteText, setPasteText] = useState("");
  const [caseLink, setCaseLink] = useState("");
  const [concern, setConcern] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [parsedCases, setParsedCases] = useState<ParsedCase[]>([]);
  const [showBulkReview, setShowBulkReview] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [gptEnabled, setGptEnabled] = useState(false);
  const [gptInstructions, setGptInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [gptExamples, setGptExamples] = useState<{ concern: string; reason: string; subReason: string; desiredAction: string }[]>([]);
  const [examplesDirty, setExamplesDirty] = useState(false);
  const [newExample, setNewExample] = useState({ concern: "", reason: "", subReason: "", desiredAction: "" });
  const [showAddExample, setShowAddExample] = useState(false);

  const { data: gptSettings } = useQuery<{ enabled: boolean; instructions: string; examples: any[] }>({
    queryKey: ["/api/custom-gpt/settings"],
  });

  useEffect(() => {
    if (gptSettings) {
      setGptEnabled(gptSettings.enabled);
      setGptInstructions(gptSettings.instructions);
      if (gptSettings.examples) setGptExamples(gptSettings.examples);
    }
  }, [gptSettings]);

  const { data: recentReports } = useQuery<CvReport[]>({
    queryKey: ["/api/cv-reports"],
  });

  const saveGptSettings = useMutation({
    mutationFn: async (data: { enabled?: boolean; instructions?: string; examples?: { concern: string; reason: string; subReason: string; desiredAction: string }[] }) => {
      await apiRequest("POST", "/api/custom-gpt/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-gpt/settings"] });
      setInstructionsDirty(false);
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (concernText: string) => {
      const res = await apiRequest("POST", "/api/custom-gpt/analyze", { concern: concernText });
      return await res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: {
      link: string;
      notesTrimrx: string;
      date?: string;
      submittedBy?: string;
      reason?: string;
      subReason?: string;
      desiredAction?: string;
    }) => {
      const res = await apiRequest("POST", "/api/cv-reports", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
      toast({ title: "Submitted successfully", description: "Case has been added to CV Report." });
      setCaseLink("");
      setConcern("");
      setPasteText("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    },
  });

  function handlePasteExtract() {
    if (!pasteText.trim()) {
      toast({ title: "Please paste your text first", variant: "destructive" });
      return;
    }
    const parsed = parseText(pasteText);
    setCaseLink(parsed.link);
    setConcern(parsed.concern);
    if (!parsed.link && !parsed.concern) {
      toast({ title: "Could not find Case link or Concern/Request in the pasted text", variant: "destructive" });
    } else {
      toast({ title: "Extracted successfully", description: "Fields have been filled from pasted text." });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseLink.trim() && !concern.trim()) {
      toast({ title: "Please fill in at least one field", variant: "destructive" });
      return;
    }

    const payload: {
      link: string;
      notesTrimrx: string;
      date?: string;
      submittedBy?: string;
      reason?: string;
      subReason?: string;
      desiredAction?: string;
      clientThreat?: string;
    } = {
      link: caseLink.trim(),
      notesTrimrx: concern.trim(),
      submittedBy: user?.username || "",
    };

    if (selectedDate) {
      payload.date = selectedDate;
    }

    if (gptEnabled && concern.trim()) {
      try {
        const analysis = await analyzeMutation.mutateAsync(concern.trim());
        if (analysis.reason) payload.reason = analysis.reason;
        if (analysis.subReason) payload.subReason = analysis.subReason;
        if (analysis.desiredAction) payload.desiredAction = analysis.desiredAction;
        if (analysis.clientThreat) payload.clientThreat = analysis.clientThreat;
      } catch (err: any) {
        toast({
          title: "GPT analysis failed",
          description: err.message || "Submitting without auto-classification.",
          variant: "destructive",
        });
      }
    }

    submitMutation.mutate(payload);
  }

  function handleBulkParse() {
    if (!bulkText.trim()) {
      toast({ title: "Please paste your bulk text first", variant: "destructive" });
      return;
    }
    const cases = parseBulkText(bulkText);
    if (cases.length === 0) {
      toast({
        title: "No matching cases found",
        description: "Could not find any cases mentioning @Olia - TrimRx or @Karla - TrimRx with Case link or Concern/Request.",
        variant: "destructive",
      });
      return;
    }
    setParsedCases(cases);
    setShowBulkReview(true);
    toast({ title: `Found ${cases.length} case(s)`, description: "Review below and submit." });
  }

  function toggleCaseSelection(index: number) {
    setParsedCases((prev) => prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c));
  }

  function toggleAllCases() {
    const allSelected = parsedCases.every((c) => c.selected);
    setParsedCases((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  }

  async function handleBulkSubmit() {
    const selected = parsedCases.filter((c) => c.selected);
    if (selected.length === 0) {
      toast({ title: "No cases selected", variant: "destructive" });
      return;
    }

    setBulkSubmitting(true);
    setBulkProgress({ done: 0, total: selected.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      try {
        const payload: any = {
          caseId: c.caseId,
          link: c.link,
          notesTrimrx: c.concern,
          submittedBy: user?.username || "",
        };
        if (selectedDate) payload.date = selectedDate;

        if (gptEnabled && c.concern) {
          try {
            const analysis = await analyzeMutation.mutateAsync(c.concern);
            if (analysis.reason) payload.reason = analysis.reason;
            if (analysis.subReason) payload.subReason = analysis.subReason;
            if (analysis.desiredAction) payload.desiredAction = analysis.desiredAction;
            if (analysis.clientThreat) payload.clientThreat = analysis.clientThreat;
          } catch {}
        }

        await apiRequest("POST", "/api/cv-reports", payload);
        successCount++;
      } catch {
        failCount++;
      }
      setBulkProgress({ done: i + 1, total: selected.length });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/cv-reports"] });
    setBulkSubmitting(false);

    if (failCount === 0) {
      toast({ title: `All ${successCount} case(s) submitted successfully` });
      setParsedCases([]);
      setShowBulkReview(false);
      setBulkText("");
    } else {
      toast({
        title: `${successCount} submitted, ${failCount} failed`,
        variant: "destructive",
      });
    }
  }

  function handleToggle(checked: boolean) {
    setGptEnabled(checked);
    saveGptSettings.mutate({ enabled: checked });
  }

  function handleSaveInstructions() {
    saveGptSettings.mutate({ instructions: gptInstructions });
  }

  function handleAddExample() {
    if (!newExample.concern.trim() || !newExample.reason.trim() || !newExample.subReason.trim() || !newExample.desiredAction.trim()) return;
    const updated = [...gptExamples, { ...newExample }];
    setGptExamples(updated);
    setNewExample({ concern: "", reason: "", subReason: "", desiredAction: "" });
    setShowAddExample(false);
    saveGptSettings.mutate({ examples: updated });
  }

  function handleDeleteExample(index: number) {
    const updated = gptExamples.filter((_, i) => i !== index);
    setGptExamples(updated);
    saveGptSettings.mutate({ examples: updated });
  }

  function handleExportCsv() {
    if (gptExamples.length === 0) return;
    const header = "concern,reason,subReason,desiredAction";
    const escCsv = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const rows = gptExamples.map(ex => `${escCsv(ex.concern)},${escCsv(ex.reason)},${escCsv(ex.subReason)},${escCsv(ex.desiredAction)}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gpt_reference_examples.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "CSV must have a header row and at least one data row", variant: "destructive" });
        return;
      }

      const parsed: { concern: string; reason: string; subReason: string; desiredAction: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let j = 0; j < lines[i].length; j++) {
          const ch = lines[i][j];
          if (ch === '"') {
            if (inQuotes && lines[i][j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === "," && !inQuotes) {
            fields.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        fields.push(current.trim());

        if (fields.length >= 4 && fields[0] && fields[1] && fields[2] && fields[3]) {
          parsed.push({ concern: fields[0], reason: fields[1], subReason: fields[2], desiredAction: fields[3] });
        }
      }

      if (parsed.length === 0) {
        toast({ title: "No valid examples found in CSV", variant: "destructive" });
        return;
      }

      const updated = [...gptExamples, ...parsed];
      setGptExamples(updated);
      saveGptSettings.mutate({ examples: updated });
      toast({ title: `Imported ${parsed.length} examples` });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const isSubmitting = submitMutation.isPending || analyzeMutation.isPending;
  const last5 = (recentReports || []).slice(0, 5);
  const selectedCount = parsedCases.filter((c) => c.selected).length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">CV Support</h2>
            <p className="text-muted-foreground mt-1">Submit support cases to CV Report</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="report-date" className="text-sm font-medium whitespace-nowrap">Report Date</Label>
            <Input
              id="report-date"
              data-testid="input-report-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Bulk Text
            </CardTitle>
            <CardDescription>
              Paste a large block of text with multiple cases. Only cases mentioning <strong>@Olia - TrimRx</strong> or <strong>@Karla - TrimRx</strong> will be extracted. Each case needs a "Case link:" and "Concern/Request:" to be captured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              data-testid="input-bulk-text"
              placeholder={"Paste all your cases here...\n\nHello @Olia - TrimRx @Karla - TrimRx\nCase ID: ADA-1OE5231R\nCase link: https://careglp.carevalidate.com/...\nConcern/Request: The patient is requesting..."}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              className="resize-none text-sm font-mono"
            />
            <Button
              type="button"
              onClick={handleBulkParse}
              className="w-full"
              disabled={!bulkText.trim()}
              data-testid="button-bulk-parse"
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Extract Cases
            </Button>
          </CardContent>
        </Card>

        {showBulkReview && parsedCases.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Review Extracted Cases ({parsedCases.length} found)
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-selected-count">
                    {selectedCount} selected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setParsedCases([]); setShowBulkReview(false); }}
                    data-testid="button-clear-review"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              {parsedCases.some((c) => c.link && isBrokenLink(c.link)) && (
                <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{parsedCases.filter((c) => c.link && isBrokenLink(c.link)).length} broken link(s) detected</strong> — these were truncated by Slack. Go to Slack, right-click the link, and choose "Copy Link" to get the full URL. You can fix them in CV Report after submitting.
                  </span>
                </div>
              )}
              <CardDescription>
                Review and deselect any cases you don't want to submit, then click "Submit Selected".
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={parsedCases.every((c) => c.selected)}
                          onCheckedChange={toggleAllCases}
                          data-testid="checkbox-select-all-bulk"
                        />
                      </TableHead>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Case ID</TableHead>
                      <TableHead className="text-xs">Case Link</TableHead>
                      <TableHead className="text-xs">Concern/Request</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedCases.map((c, idx) => (
                      <TableRow key={idx} className={c.selected ? "" : "opacity-50"} data-testid={`bulk-case-${idx}`}>
                        <TableCell>
                          <Checkbox
                            checked={c.selected}
                            onCheckedChange={() => toggleCaseSelection(idx)}
                            data-testid={`checkbox-bulk-${idx}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{idx + 1}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {c.caseId || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px]">
                          {c.link ? (
                            isBrokenLink(c.link) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 text-destructive font-medium cursor-help">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate block max-w-[200px]">Broken link - check manually</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[500px] break-all">
                                  <p className="text-destructive font-medium mb-1">This link appears truncated by Slack. Copy the full link from Slack (right-click &gt; Copy Link).</p>
                                  <p className="text-xs">{c.link}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate block max-w-[250px]">
                                    {c.link}
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[500px] break-all">
                                  <p>{c.link}</p>
                                </TooltipContent>
                              </Tooltip>
                            )
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> No link found
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[400px]">
                          {c.concern ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-[400px]">{c.concern}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[500px] break-words">
                                <p>{c.concern}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> No concern found
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {gptEnabled && <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> GPT auto-classification is active</span>}
                </p>
                <Button
                  onClick={handleBulkSubmit}
                  disabled={bulkSubmitting || selectedCount === 0 || !can("cv-support", "bulk-submit")}
                  data-testid="button-bulk-submit"
                >
                  {bulkSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting {bulkProgress.done}/{bulkProgress.total}...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit {selectedCount} Case{selectedCount !== 1 ? "s" : ""} to CV Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4" />
                  Quick Paste
                </CardTitle>
                <CardDescription>
                  Paste the full text containing "Case link:" and "Concern/Request:" and it will auto-fill the fields below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  data-testid="input-paste-text"
                  placeholder={"Case link: https://...\n\nConcern/Request: The patient wanted to..."}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  className="resize-none text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePasteExtract}
                  className="w-full"
                  data-testid="button-extract"
                >
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  Extract & Fill Fields
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HeadsetIcon className="h-4 w-4" />
                  Submit Case
                </CardTitle>
                <CardDescription>
                  Review or manually edit the fields, then submit to create a CV Report entry.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="case-link">Case Link</Label>
                    <Input
                      id="case-link"
                      data-testid="input-case-link"
                      placeholder="https://..."
                      value={caseLink}
                      onChange={(e) => setCaseLink(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="concern">Concern/Request</Label>
                    <Textarea
                      id="concern"
                      data-testid="input-concern"
                      placeholder="Describe the patient's concern or request..."
                      value={concern}
                      onChange={(e) => setConcern(e.target.value)}
                      rows={5}
                      className="resize-none"
                    />
                  </div>

                  {gptEnabled && (
                    <div className="rounded-md bg-muted/50 border p-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      Custom GPT is active — Reason, Sub-reason, and Desired Action will be auto-filled on submit.
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !can("cv-support", "submit-case")}
                    data-testid="button-submit-case"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {analyzeMutation.isPending ? "Analyzing with GPT..." : "Submitting..."}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit to CV Report
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {(user as any)?.role === "admin" && (<div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Custom GPT
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {gptEnabled ? "On" : "Off"}
                    </span>
                    <Switch
                      data-testid="switch-custom-gpt"
                      checked={gptEnabled}
                      onCheckedChange={handleToggle}
                    />
                  </div>
                </div>
                <CardDescription>
                  When enabled, submitting a case will use GPT to auto-classify Reason, Sub-reason, and Desired Action based on your instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gpt-instructions">Instructions</Label>
                  <Textarea
                    id="gpt-instructions"
                    data-testid="input-gpt-instructions"
                    placeholder="Enter your custom GPT instructions for classifying cases..."
                    value={gptInstructions}
                    onChange={(e) => {
                      setGptInstructions(e.target.value);
                      setInstructionsDirty(true);
                    }}
                    rows={14}
                    className="resize-none text-sm font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleSaveInstructions}
                  disabled={!instructionsDirty || saveGptSettings.isPending}
                  data-testid="button-save-instructions"
                >
                  {saveGptSettings.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Instructions
                </Button>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Reference Examples ({gptExamples.length})
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportCsv}
                        className="hidden"
                        id="csv-import-input"
                        data-testid="input-csv-import"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("csv-import-input")?.click()}
                        data-testid="button-import-csv"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Import
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        disabled={gptExamples.length === 0}
                        data-testid="button-export-csv"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Export
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddExample(!showAddExample)}
                        data-testid="button-add-example"
                      >
                        {showAddExample ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        {showAddExample ? "Cancel" : "Add"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add real case examples with correct classification. GPT will use these as reference when classifying new cases.
                  </p>

                  {showAddExample && (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <Textarea
                        placeholder="Paste the concern text..."
                        value={newExample.concern}
                        onChange={(e) => setNewExample({ ...newExample, concern: e.target.value })}
                        rows={3}
                        className="text-sm resize-none"
                        data-testid="input-example-concern"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Reason"
                          value={newExample.reason}
                          onChange={(e) => setNewExample({ ...newExample, reason: e.target.value })}
                          className="text-sm"
                          data-testid="input-example-reason"
                        />
                        <Input
                          placeholder="Sub-Reason"
                          value={newExample.subReason}
                          onChange={(e) => setNewExample({ ...newExample, subReason: e.target.value })}
                          className="text-sm"
                          data-testid="input-example-subreason"
                        />
                        <Input
                          placeholder="Desired Action"
                          value={newExample.desiredAction}
                          onChange={(e) => setNewExample({ ...newExample, desiredAction: e.target.value })}
                          className="text-sm"
                          data-testid="input-example-action"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        onClick={handleAddExample}
                        disabled={!newExample.concern.trim() || !newExample.reason.trim() || !newExample.subReason.trim() || !newExample.desiredAction.trim()}
                        data-testid="button-save-example"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Save Example
                      </Button>
                    </div>
                  )}

                  {gptExamples.length > 0 && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {gptExamples.map((ex, i) => (
                        <div key={i} className="border rounded-lg p-3 space-y-1.5 text-sm bg-background" data-testid={`example-${i}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">"{ex.concern}"</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                              onClick={() => handleDeleteExample(i)}
                              data-testid={`button-delete-example-${i}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs">{ex.reason}</Badge>
                            <Badge variant="outline" className="text-xs">{ex.subReason}</Badge>
                            <Badge variant="outline" className="text-xs">{ex.desiredAction}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>)}
        </div>

        {last5.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Recent Submissions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Link</TableHead>
                      <TableHead className="text-xs">Notes TrimRX</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Sub-reason</TableHead>
                      <TableHead className="text-xs">Desired Action</TableHead>
                      <TableHead className="text-xs w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {last5.map((r) => (
                      <TableRow key={r.id} data-testid={`recent-report-${r.id}`}>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {r.link ? (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              {r.link}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">
                          {r.notesTrimrx || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.reason || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.subReason || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.desiredAction || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
