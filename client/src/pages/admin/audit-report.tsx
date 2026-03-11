import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, ClipboardCheck, Filter, X } from "lucide-react";

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
  "Retention Final Submit",
];

export default function AuditReportPage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedPage, setSelectedPage] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.ceil((auditData?.total || 0) / pageSize);
  const hasFilters = selectedUser !== "all" || selectedPage !== "all" || selectedAction !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSelectedUser("all");
    setSelectedPage("all");
    setSelectedAction("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
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
          <p className="text-sm text-muted-foreground">Track all user actions across CV Report, Manage Slack Case, and Retention Final Submit</p>
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
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setCurrentPage(1); }}>
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
              <Select value={selectedPage} onValueChange={(v) => { setSelectedPage(v); setCurrentPage(1); }}>
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
              <Select value={selectedAction} onValueChange={(v) => { setSelectedAction(v); setCurrentPage(1); }}>
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
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="h-9"
                data-testid="input-date-from"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
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
              <label className="text-xs text-muted-foreground">Per page:</label>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
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
                      <th className="text-left p-3 font-medium w-[170px]">Date & Time</th>
                      <th className="text-left p-3 font-medium w-[120px]">User</th>
                      <th className="text-left p-3 font-medium w-[160px]">Action</th>
                      <th className="text-left p-3 font-medium w-[170px]">Page</th>
                      <th className="text-left p-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditData.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-audit-${log.id}`}>
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
                        <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate" title={log.details || ""} data-testid={`text-details-${log.id}`}>
                          {log.details || "—"}
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
                      onClick={() => setCurrentPage((p) => p - 1)}
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
                          onClick={() => setCurrentPage(page)}
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
                      onClick={() => setCurrentPage((p) => p + 1)}
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
    </div>
  );
}
