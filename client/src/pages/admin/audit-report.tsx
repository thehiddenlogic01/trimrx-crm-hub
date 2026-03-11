import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, ClipboardCheck, Filter, X, Eye, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AuditLog {
  id: number;
  userId: string;
  username: string;
  action: string;
  page: string;
  details: string;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
}

interface UserItem {
  id: string;
  username: string;
  role: string;
}

interface ContextData {
  type: "slack" | "cv-report" | "retention" | "unknown";
  data: any;
  message?: string;
  ts?: string;
  channelId?: string;
  caseId?: string;
  email?: string;
}

const PAGE_SIZES = [25, 50, 100];

const ACTION_COLORS: Record<string, string> = {
  "Reply Sent": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Mark as Done": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Unmark Done": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Send to CV Report": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "Delete Message": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "CV Report Created": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "CV Report Updated": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "CV Report Deleted": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "Push to Google Sheets": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Retention Final Submit": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "Bulk Mark Done": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Bulk Send to CV": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const PAGE_COLORS: Record<string, string> = {
  "CV Report": "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "Manage Slack Case": "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  "Slack Backlog All": "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  "Retention Final Submit": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

const AVAILABLE_ACTIONS = [
  "Reply Sent",
  "Mark as Done",
  "Unmark Done",
  "Delete Message",
  "CV Report Created",
  "CV Report Updated",
  "CV Report Deleted",
  "Push to Google Sheets",
];

const AVAILABLE_PAGES = [
  "CV Report",
  "Manage Slack Case",
  "Slack Backlog All",
  "Retention Final Submit",
];

function ViewContextDialog({ log, open, onClose }: { log: AuditLog | null; open: boolean; onClose: () => void }) {
  const { data: contextData, isLoading } = useQuery<ContextData>({
    queryKey: ["/api/audit-logs", log?.id, "context"],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs/${log!.id}/context`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open && !!log,
  });

  const renderSlackContent = (ctx: ContextData) => {
    if (ctx.data) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>Channel: {ctx.data.channelId}</span>
            <span>|</span>
            <span>Timestamp: {ctx.data.ts}</span>
            {ctx.data.user && <><span>|</span><span>User: {ctx.data.user}</span></>}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Original Message:</p>
            <div className="bg-muted/50 rounded-lg p-4 border whitespace-pre-wrap text-sm leading-relaxed">
              {ctx.data.text || "(empty message)"}
            </div>
          </div>
          {ctx.data.replyText && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Reply Sent:</p>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800 whitespace-pre-wrap text-sm leading-relaxed">
                {ctx.data.replyText}
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Message Unavailable</span>
        </div>
        <p>{ctx.message || "The message could not be retrieved."}</p>
        {ctx.ts && <p className="text-xs mt-2 text-muted-foreground">Timestamp: {ctx.ts}, Channel: {ctx.channelId}</p>}
      </div>
    );
  };

  const renderCvReportContent = (ctx: ContextData) => {
    if (ctx.data) {
      const report = ctx.data;
      const fields = [
        { label: "Case ID", value: report.caseId },
        { label: "Customer Email", value: report.customerEmail },
        { label: "Customer Name", value: report.customerName },
        { label: "Customer Phone", value: report.customerPhone },
        { label: "Provider", value: report.provider },
        { label: "Status", value: report.status },
        { label: "Outcome", value: report.outcome },
        { label: "Medication", value: report.medication },
        { label: "Dosage", value: report.dosage },
        { label: "Quantity", value: report.quantity },
        { label: "Case Type", value: report.caseType },
        { label: "Notes", value: report.notes },
        { label: "Agent Notes", value: report.agentNotes },
        { label: "Agent Assigned", value: report.agentAssigned },
        { label: "Created", value: report.createdAt ? new Date(report.createdAt).toLocaleString() : null },
      ].filter(f => f.value);

      return (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Report ID: {report.id}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/30 rounded-lg p-4 border">
            {fields.map((f) => (
              <div key={f.label} className="text-sm">
                <span className="font-medium text-muted-foreground">{f.label}: </span>
                <span>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Report Unavailable</span>
        </div>
        <p>{ctx.message || "The report could not be retrieved."}</p>
        {ctx.caseId && <p className="text-xs mt-2 text-muted-foreground">Case ID: {ctx.caseId}</p>}
        {ctx.email && <p className="text-xs mt-1 text-muted-foreground">Email: {ctx.email}</p>}
      </div>
    );
  };

  const renderRetentionContent = (ctx: ContextData) => {
    return (
      <div className="bg-muted/50 rounded-lg p-4 border text-sm">
        <p>{ctx.message || ctx.data || "Push to Google Sheets action"}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Action Details
          </DialogTitle>
          <DialogDescription className="sr-only">View the details of this audit log entry</DialogDescription>
        </DialogHeader>

        {log && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm border-b pb-3">
              <div>
                <span className="text-muted-foreground">User: </span>
                <span className="font-medium">{log.username}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Action: </span>
                <Badge variant="secondary" className={`text-xs ${ACTION_COLORS[log.action] || ""}`}>{log.action}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Page: </span>
                <Badge variant="outline" className={`text-xs ${PAGE_COLORS[log.page] || ""}`}>{log.page}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Time: </span>
                <span className="text-xs">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 font-mono break-all">
              {(log.details || "").split("\n---MSG---\n")[0] || "No details"}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Original Content</h4>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : contextData ? (
                <>
                  {contextData.type === "slack" && renderSlackContent(contextData)}
                  {contextData.type === "cv-report" && renderCvReportContent(contextData)}
                  {contextData.type === "retention" && renderRetentionContent(contextData)}
                  {contextData.type === "unknown" && (
                    <div className="bg-muted/50 rounded-lg p-4 border text-sm text-muted-foreground">
                      {contextData.message || "No additional context available"}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Could not load context</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-view">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AuditReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedPage, setSelectedPage] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const [viewLog, setViewLog] = useState<AuditLog | null>(null);
  const [deleteLog, setDeleteLog] = useState<AuditLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: allUsers } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedUser !== "all") params.set("userId", selectedUser);
    if (selectedPage !== "all") params.set("page", selectedPage);
    if (selectedAction !== "all") params.set("action", selectedAction);
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      params.set("to", to.toISOString());
    }
    params.set("limit", String(pageSize));
    params.set("offset", String((currentPage - 1) * pageSize));
    return params.toString();
  }, [selectedUser, selectedPage, selectedAction, dateFrom, dateTo, pageSize, currentPage]);

  const { data: auditData, isLoading, isError } = useQuery<AuditResponse>({
    queryKey: [`/api/audit-logs?${queryParams}`],
    enabled: user?.role === "admin",
  });

  const invalidateAllAuditQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/audit-logs");
      },
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/audit-logs/${id}`);
    },
    onSuccess: () => {
      invalidateAllAuditQueries();
      toast({ title: "Audit log deleted" });
      setDeleteLog(null);
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("POST", "/api/audit-logs/delete-bulk", { ids });
    },
    onSuccess: () => {
      invalidateAllAuditQueries();
      toast({ title: `${selectedIds.size} log(s) deleted` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const totalPages = Math.ceil((auditData?.total || 0) / pageSize);
  const hasFilters = selectedUser !== "all" || selectedPage !== "all" || selectedAction !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSelectedUser("all");
    setSelectedPage("all");
    setSelectedAction("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const toggleSelectAll = () => {
    if (!auditData?.logs) return;
    if (selectedIds.size === auditData.logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(auditData.logs.map(l => l.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto" data-testid="audit-report-page">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Audit Report</h1>
          <p className="text-sm text-muted-foreground">Track all user actions across CV Report, Manage Slack Case, Slack Backlog All, and Retention Final Submit</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7" data-testid="button-clear-filters">
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">User</label>
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setCurrentPage(1); setSelectedIds(new Set()); }}>
                <SelectTrigger className="h-9" data-testid="select-user-filter">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {allUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Page</label>
              <Select value={selectedPage} onValueChange={(v) => { setSelectedPage(v); setCurrentPage(1); setSelectedIds(new Set()); }}>
                <SelectTrigger className="h-9" data-testid="select-page-filter">
                  <SelectValue placeholder="All Pages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  {AVAILABLE_PAGES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
              <Select value={selectedAction} onValueChange={(v) => { setSelectedAction(v); setCurrentPage(1); setSelectedIds(new Set()); }}>
                <SelectTrigger className="h-9" data-testid="select-action-filter">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {AVAILABLE_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                className="h-9"
                data-testid="input-date-from"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                className="h-9"
                data-testid="input-date-to"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Activity Log
              {auditData && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({auditData.total} total entries)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-bulk-delete"
                >
                  {bulkDeleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Delete {selectedIds.size} selected
                </Button>
              )}
              <label className="text-xs text-muted-foreground">Per page:</label>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); setSelectedIds(new Set()); }}>
                <SelectTrigger className="h-8 w-20" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Failed to load audit logs</p>
              <p className="text-xs mt-1 text-muted-foreground">Please try again later</p>
            </div>
          ) : !auditData?.logs?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No audit logs found</p>
              {hasFilters && <p className="text-xs mt-1">Try adjusting your filters</p>}
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 w-[40px]">
                        <input
                          type="checkbox"
                          checked={auditData.logs.length > 0 && selectedIds.size === auditData.logs.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th className="text-left p-3 font-medium w-[170px]">Date & Time</th>
                      <th className="text-left p-3 font-medium w-[100px]">User</th>
                      <th className="text-left p-3 font-medium w-[150px]">Action</th>
                      <th className="text-left p-3 font-medium w-[160px]">Page</th>
                      <th className="text-left p-3 font-medium">Details</th>
                      <th className="text-center p-3 font-medium w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditData.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-audit-${log.id}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={() => toggleSelect(log.id)}
                            className="rounded border-gray-300"
                            data-testid={`checkbox-select-${log.id}`}
                          />
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-date-${log.id}`}>
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="p-3" data-testid={`text-user-${log.id}`}>
                          <span className="font-medium text-sm">{log.username}</span>
                        </td>
                        <td className="p-3" data-testid={`text-action-${log.id}`}>
                          <Badge variant="secondary" className={`text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}`}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="p-3" data-testid={`text-page-${log.id}`}>
                          <Badge variant="outline" className={`text-xs ${PAGE_COLORS[log.page] || ""}`}>
                            {log.page}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[250px] truncate" title={(log.details || "").split("\n---MSG---\n")[0]} data-testid={`text-details-${log.id}`}>
                          {(log.details || "").split("\n---MSG---\n")[0] || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"
                              onClick={() => setViewLog(log)}
                              title="View details"
                              data-testid={`button-view-${log.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                              onClick={() => setDeleteLog(log)}
                              title="Delete log"
                              data-testid={`button-delete-${log.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, auditData.total)} of {auditData.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={currentPage <= 1}
                      onClick={() => { setCurrentPage((p) => p - 1); setSelectedIds(new Set()); }}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setCurrentPage(page); setSelectedIds(new Set()); }}
                          data-testid={`button-page-${page}`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={currentPage >= totalPages}
                      onClick={() => { setCurrentPage((p) => p + 1); setSelectedIds(new Set()); }}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ViewContextDialog
        log={viewLog}
        open={!!viewLog}
        onClose={() => setViewLog(null)}
      />

      <Dialog open={!!deleteLog} onOpenChange={(v) => !v && setDeleteLog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Audit Log
            </DialogTitle>
            <DialogDescription className="sr-only">Confirm deletion of this audit log entry</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this audit log entry?
          </p>
          {deleteLog && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p><span className="font-medium">User:</span> {deleteLog.username}</p>
              <p><span className="font-medium">Action:</span> {deleteLog.action}</p>
              <p><span className="font-medium">Time:</span> {formatDate(deleteLog.createdAt)}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteLog(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteLog && deleteMutation.mutate(deleteLog.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
