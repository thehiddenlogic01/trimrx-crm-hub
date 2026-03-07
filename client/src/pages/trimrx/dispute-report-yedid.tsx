import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload,
  Loader2,
  Trash2,
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useLocation } from "wouter";

type CaseFolderInfo = {
  id: number;
  name: string;
  email: string;
  status: string;
};

const DISPLAY_COLUMNS = [
  { key: "remainingDays", label: "Remaining Days" },
  { key: "mailDoc", label: "Mail Doc" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "customerPhone", label: "Customer Phone" },
  { key: "shippingName", label: "Shipping Name" },
  { key: "shippingAddressLine1", label: "Address Line1" },
  { key: "shippingAddressLine2", label: "Address Line2" },
  { key: "shippingAddressCity", label: "City" },
  { key: "shippingAddressState", label: "State" },
  { key: "shippingAddressCountry", label: "Country" },
  { key: "shippingAddressPostalCode", label: "Postal Code" },
  { key: "disputedAmount", label: "Disputed Amount" },
  { key: "disputeDate", label: "Dispute Date" },
  { key: "disputeEvidenceDue", label: "Evidence Due" },
  { key: "disputeReason", label: "Stripe Dispute Reason" },
  { key: "disputeStatus", label: "Internal Error Area Dispute Type" },
  { key: "cancellationProcess", label: "Cancellation Process" },
  { key: "invoiceId", label: "Invoice ID" },
];

const CSV_DISPLAY_HEADERS = [
  "Customer Email",
  "Customer Phone",
  "Shipping Name",
  "Shipping Address Line1",
  "Shipping Address Line2",
  "Shipping Address City",
  "Shipping Address State",
  "Shipping Address Country",
  "Shipping Address Postal Code",
  "Disputed Amount",
  "Dispute Date (UTC)",
  "Dispute Evidence Due (UTC)",
  "Dispute Reason",
  "Dispute Status",
];

type DisputeReport = {
  id: number;
  customerEmail: string;
  customerPhone: string;
  shippingName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingAddressCity: string;
  shippingAddressState: string;
  shippingAddressCountry: string;
  shippingAddressPostalCode: string;
  disputedAmount: string;
  disputeDate: string;
  disputeEvidenceDue: string;
  disputeReason: string;
  disputeStatus: string;
  cancellationProcess: string;
  invoiceId: string;
};

function calcRemainingDays(evidenceDue: string): number | null {
  if (!evidenceDue) return null;
  const dueDate = new Date(evidenceDue);
  if (isNaN(dueDate.getTime())) return null;
  const now = new Date();
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return Math.ceil((dueUTC - nowUTC) / (1000 * 60 * 60 * 24));
}

function RemainingDaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>;
  const isUrgent = days <= 7;
  const isExpired = days < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
        isExpired
          ? "bg-red-50 text-red-700 border-red-200"
          : isUrgent
          ? "bg-orange-50 text-orange-700 border-orange-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
      data-testid="badge-remaining-days"
    >
      {isExpired ? `${Math.abs(days)} days overdue` : `${days} days to respond`}
    </span>
  );
}

export default function DisputeReportYedidPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [, setLocation] = useLocation();
  const [reviewRows, setReviewRows] = useState<Record<string, string>[] | null>(null);
  const [selectedReviewRows, setSelectedReviewRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: reports, isLoading } = useQuery<DisputeReport[]>({
    queryKey: ["/api/dispute-reports-yedid"],
  });

  const { data: caseFolders } = useQuery<CaseFolderInfo[]>({
    queryKey: ["/api/case-folders"],
  });

  const { data: disputeTypeOptions = [] } = useQuery<string[]>({
    queryKey: ["/api/dispute-settings", "dispute_type_options"],
    queryFn: async () => {
      const res = await fetch("/api/dispute-settings/dispute_type_options", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    },
  });

  const { data: cancellationProcessOptions = [] } = useQuery<string[]>({
    queryKey: ["/api/dispute-settings", "cancellation_process_options"],
    queryFn: async () => {
      const res = await fetch("/api/dispute-settings/cancellation_process_options", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    },
  });

  const { data: invoiceIdOptions = [] } = useQuery<string[]>({
    queryKey: ["/api/dispute-settings", "invoice_id_options"],
    queryFn: async () => {
      const res = await fetch("/api/dispute-settings/invoice_id_options", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    },
  });

  const readyEmails = new Set(
    (caseFolders || [])
      .filter((f) => f.status === "ready")
      .map((f) => f.email.toLowerCase().trim())
  );

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/dispute-reports-yedid/import", { rows });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispute-reports-yedid"] });
      toast({ title: `Imported ${data.imported} dispute report(s)` });
      setReviewRows(null);
      setSelectedReviewRows(new Set());
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/dispute-reports-yedid/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispute-reports-yedid"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dispute-reports-yedid/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispute-reports-yedid"] });
      toast({ title: "Report deleted" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/dispute-reports-yedid");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispute-reports-yedid"] });
      toast({ title: "All reports deleted" });
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        const res = await apiRequest("POST", "/api/dispute-reports-yedid/parse-csv", { csvText: text });
        const data = await res.json();
        if (data.rows && data.rows.length > 0) {
          setReviewRows(data.rows);
          const allIndices = new Set<number>();
          data.rows.forEach((_: any, i: number) => allIndices.add(i));
          setSelectedReviewRows(allIndices);
          toast({ title: `Parsed ${data.count} row(s) from CSV` });
        } else {
          toast({ title: "No data found in CSV", variant: "destructive" });
        }
      } catch (err: any) {
        toast({ title: "Failed to parse CSV", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleImportSelected() {
    if (!reviewRows) return;
    const selected = reviewRows.filter((_, i) => selectedReviewRows.has(i));
    if (selected.length === 0) {
      toast({ title: "No rows selected", variant: "destructive" });
      return;
    }
    importMutation.mutate(selected);
  }

  if (reviewRows) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Review CSV Data</h1>
            <p className="text-muted-foreground mt-1">{reviewRows.length} row(s) parsed — select rows to import</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setReviewRows(null); setSelectedReviewRows(new Set()); }} data-testid="button-cancel-review">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleImportSelected}
              disabled={importMutation.isPending || selectedReviewRows.size === 0}
              data-testid="button-import-selected"
            >
              {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import {selectedReviewRows.size} Row(s)
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={reviewRows.length > 0 && selectedReviewRows.size === reviewRows.length}
                        onCheckedChange={() => {
                          if (selectedReviewRows.size === reviewRows.length) {
                            setSelectedReviewRows(new Set());
                          } else {
                            const all = new Set<number>();
                            reviewRows.forEach((_, i) => all.add(i));
                            setSelectedReviewRows(all);
                          }
                        }}
                        data-testid="checkbox-select-all-review"
                      />
                    </TableHead>
                    <TableHead className="w-10">#</TableHead>
                    {CSV_DISPLAY_HEADERS.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewRows.map((row, idx) => (
                    <TableRow key={idx} className={selectedReviewRows.has(idx) ? "bg-muted/50" : ""} data-testid={`review-row-${idx}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReviewRows.has(idx)}
                          onCheckedChange={() => {
                            setSelectedReviewRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {CSV_DISPLAY_HEADERS.map((h) => (
                        <TableCell key={h} className="text-xs max-w-[150px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block">{row[h] || "—"}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] break-words">
                              <p>{row[h] || "—"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredReports = (reports || []).filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return DISPLAY_COLUMNS.some((col) => {
      const val = (r as any)[col.key];
      return val && String(val).toLowerCase().includes(q);
    });
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageReports = filteredReports.slice(startIdx, startIdx + pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dispute Report Yedid</h1>
        <p className="text-muted-foreground mt-1">TrimRX dispute tracking from CSV imports</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
            data-testid="input-search-reports"
          />
        </div>
        {can("dispute-report-yedid", "import") && (
          <>
            <Button onClick={() => document.getElementById("csv-upload-input")?.click()} data-testid="button-upload-csv">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </>
        )}
        {can("dispute-report-yedid", "delete") && (reports || []).length > 0 && (
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Delete ALL dispute reports? This cannot be undone.")) {
                deleteAllMutation.mutate();
              }
            }}
            disabled={deleteAllMutation.isPending}
            data-testid="button-delete-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Reports ({filteredReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No dispute reports</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Click "Upload CSV" to import dispute data.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {DISPLAY_COLUMNS.map((col) => (
                        <TableHead key={col.key} className="whitespace-nowrap text-xs">{col.label}</TableHead>
                      ))}
                      <TableHead className="w-10 text-xs">Send</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageReports.map((report) => (
                      <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                        {DISPLAY_COLUMNS.map((col) => {
                          if (col.key === "mailDoc") {
                            const email = (report.customerEmail || "").toLowerCase().trim();
                            const isReady = email && readyEmails.has(email);
                            return (
                              <TableCell key={col.key} className="text-xs text-center">
                                {isReady ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" data-testid={`mail-doc-ready-${report.id}`} />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            );
                          }
                          if (col.key === "remainingDays") {
                            const days = calcRemainingDays(report.disputeEvidenceDue);
                            return (
                              <TableCell key={col.key} className="text-xs">
                                <RemainingDaysBadge days={days} />
                              </TableCell>
                            );
                          }
                          if (col.key === "disputeStatus" || col.key === "cancellationProcess" || col.key === "invoiceId") {
                            const val = (report as any)[col.key] || "";
                            const optionsMap: Record<string, string[]> = {
                              disputeStatus: disputeTypeOptions,
                              cancellationProcess: cancellationProcessOptions,
                              invoiceId: invoiceIdOptions,
                            };
                            const options = optionsMap[col.key] || [];
                            return (
                              <TableCell key={col.key} className="text-xs min-w-[140px]">
                                {options.length > 0 ? (
                                  <Select
                                    value={val}
                                    onValueChange={(v) => {
                                      updateMutation.mutate({ id: report.id, data: { [col.key]: v === "__clear__" ? "" : v } });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-xs" data-testid={`select-${col.key}-${report.id}`}>
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__clear__">— None —</SelectItem>
                                      {options.map((opt) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    defaultValue={val}
                                    placeholder="Type here..."
                                    className="h-7 text-xs"
                                    onBlur={(e) => {
                                      if (e.target.value !== val) {
                                        updateMutation.mutate({ id: report.id, data: { [col.key]: e.target.value } });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    }}
                                    data-testid={`input-${col.key}-${report.id}`}
                                  />
                                )}
                              </TableCell>
                            );
                          }
                          const val = (report as any)[col.key] || "";
                          return (
                            <TableCell key={col.key} className="text-xs max-w-[150px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block">{val || "—"}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[300px] break-words">
                                  <p>{val || "—"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  sessionStorage.setItem("stripeSubmitData", JSON.stringify(report));
                                  setLocation("/trimrx/stripe-submit");
                                }}
                                data-testid={`button-send-stripe-${report.id}`}
                              >
                                <Send className="h-4 w-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send to Stripe Submit</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {can("dispute-report-yedid", "delete") && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (window.confirm("Delete this report?")) {
                                  deleteMutation.mutate(report.id);
                                }
                              }}
                              data-testid={`button-delete-${report.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-16 h-8" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {startIdx + 1}–{Math.min(startIdx + pageSize, filteredReports.length)} of {filteredReports.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={safePage <= 1} onClick={() => setCurrentPage(1)} data-testid="button-first-page">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)} data-testid="button-prev-page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm mx-2">Page {safePage} of {totalPages}</span>
                  <Button variant="ghost" size="icon" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)} data-testid="button-next-page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)} data-testid="button-last-page">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
