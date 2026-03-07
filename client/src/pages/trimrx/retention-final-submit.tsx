import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  SendHorizonal, Search, Loader2, ExternalLink, FileSpreadsheet,
  Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2,
} from "lucide-react";
import type { CvReport } from "@shared/schema";

const COLUMNS = [
  { key: "submittedBy", label: "User" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "caseId", label: "Case ID" },
  { key: "status", label: "Status" },
  { key: "link", label: "Link" },
  { key: "duplicated", label: "Duplicated" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "notesTrimrx", label: "Notes TrimRX" },
  { key: "productType", label: "Product Type" },
  { key: "clientThreat", label: "Client Threat" },
  { key: "reason", label: "Reason" },
  { key: "subReason", label: "Sub-reason" },
  { key: "desiredAction", label: "Desired Action" },
] as const;

type ColumnKey = typeof COLUMNS[number]["key"];
type SortDir = "asc" | "desc" | null;

export default function RetentionFinalSubmitPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(() => {
    try {
      const saved = localStorage.getItem("retention-final-hidden-columns");
      if (saved) return new Set(JSON.parse(saved) as ColumnKey[]);
    } catch {}
    return new Set<ColumnKey>();
  });

  const { data: allReports, isLoading } = useQuery<CvReport[]>({
    queryKey: ["/api/cv-reports"],
  });

  const readyReports = (allReports || []).filter((r) => r.checkingStatus === "Ready");

  const filtered = readyReports.filter((report) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return COLUMNS.some((col) => {
      const val = (report as any)[col.key];
      return val && String(val).toLowerCase().includes(q);
    });
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const aVal = String((a as any)[sortKey] || "").toLowerCase();
    const bVal = String((b as any)[sortKey] || "").toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("retention-final-hidden-columns", JSON.stringify([...next]));
      return next;
    });
  };

  const visibleColumns = COLUMNS.filter((col) => !hiddenColumns.has(col.key));

  const renderCellContent = (report: CvReport, col: typeof COLUMNS[number]) => {
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
          ) : sorted.length === 0 ? (
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
                        className="text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                        onClick={() => toggleSort(col.key)}
                        data-testid={`th-${col.key}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((report) => (
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
    </div>
  );
}
