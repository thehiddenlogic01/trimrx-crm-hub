import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Database,
  Loader2,
  Link2,
  Mail,
  User,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";

interface PtFinderConfig {
  spreadsheetId: string;
  sheetName: string;
  headerRow: number;
  refundsSheetName: string;
  refundsHeaderRow: number;
  hasCredentials: boolean;
}

function ResultCard({
  record,
  headers,
  idx,
  highlightedColumns,
  source,
}: {
  record: Record<string, string>;
  headers: string[];
  idx: number;
  highlightedColumns: string[];
  source?: string;
}) {
  return (
    <Card data-testid={`card-result-${source ? source + "-" : ""}${idx}`}>
      <CardHeader className="py-3 px-4 bg-muted/30">
        <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
          {source === "refunds" ? (
            <RefreshCw className="h-4 w-4 text-orange-500" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
          {record["Name"] || record["name"] || record["Patient Name"] || record["Customer Name"] || `Record #${idx + 1}`}
          {source && (
            <Badge
              variant="outline"
              className={source === "refunds"
                ? "text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700 text-[10px] px-1.5 py-0"
                : "text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700 text-[10px] px-1.5 py-0"
              }
            >
              {source === "refunds" ? "Refund" : "PT"}
            </Badge>
          )}
          {(record["Customer Email"] || record["Email"] || record["email"]) && (
            <span className="text-xs text-muted-foreground font-normal flex items-center gap-1 ml-auto">
              <Mail className="h-3 w-3" />
              {record["Customer Email"] || record["Email"] || record["email"]}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {headers.map((header) => {
            const value = record[header];
            if (!value) return null;
            const isHighlighted = highlightedColumns.some(
              (h) => header.toLowerCase().includes(h.toLowerCase())
            );
            const isLink = value.startsWith("http://") || value.startsWith("https://");
            return (
              <div key={header} className="flex flex-col">
                <span className={`text-xs ${isHighlighted ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {header}
                </span>
                {isLink ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                    data-testid={`link-${header.toLowerCase().replace(/\s+/g, "-")}-${idx}`}
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{value}</span>
                  </a>
                ) : (
                  <span className={`text-sm ${isHighlighted ? "font-medium" : ""} break-words`}>
                    {value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PtFinderPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, string>[] | null>(null);
  const [searchHeaders, setSearchHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [refundsResults, setRefundsResults] = useState<Record<string, string>[]>([]);
  const [refundsHeaders, setRefundsHeaders] = useState<string[]>([]);
  const [refundsTotalRows, setRefundsTotalRows] = useState(0);
  const [hasRefundsSheet, setHasRefundsSheet] = useState(false);

  const configQuery = useQuery<PtFinderConfig>({
    queryKey: ["/api/pt-finder/config"],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/pt-finder/search", { query });
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      setSearchHeaders(data.headers || []);
      setTotalRows(data.totalRows || 0);
      setRefundsResults(data.refundsResults || []);
      setRefundsHeaders(data.refundsHeaders || []);
      setRefundsTotalRows(data.refundsTotalRows || 0);
      setHasRefundsSheet(data.hasRefundsSheet || false);
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchResults(null);
    setRefundsResults([]);
    setRefundsHeaders([]);
    setRefundsTotalRows(0);
    setSearchQuery("");
  };

  const isConnected = configQuery.data?.hasCredentials && configQuery.data?.spreadsheetId;

  const highlightedColumns = ["Customer Email", "Email", "email", "Case Link", "case_link", "Name", "name", "Agent Assigned", "Request Status", "OUTCOME", "TICKET COMPLETION DATE", "Status"];

  const ptCount = searchResults?.length || 0;
  const refCount = refundsResults.length;
  const totalCount = ptCount + refCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-6 w-6" />
            PT Finder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search patient records from Google Sheets by email, case link, name, or any field.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700" data-testid="status-connected">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" data-testid="status-not-configured">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not connected
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search by email, case link, name, or any field..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          type="submit"
          disabled={searchMutation.isPending || !searchQuery.trim()}
          data-testid="button-search"
        >
          {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Search
        </Button>
      </form>

      {!isConnected && !searchResults && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Google Sheet Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a Google Sheet to start searching patient records.
            </p>
          </CardContent>
        </Card>
      )}

      {isConnected && !searchResults && !searchMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Search Patient Records</h3>
            <p className="text-sm text-muted-foreground">
              Enter an email, case link, patient name, or any keyword to search the connected sheet.
            </p>
          </CardContent>
        </Card>
      )}

      {searchResults !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "No results found"
                : hasRefundsSheet
                  ? `Found ${ptCount} PT result${ptCount !== 1 ? "s" : ""} and ${refCount} Refund result${refCount !== 1 ? "s" : ""}`
                  : `Found ${ptCount} result${ptCount !== 1 ? "s" : ""} out of ${totalRows} records`}
            </p>
            {totalCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {ptCount > 0 && (
            <div className="space-y-3">
              {hasRefundsSheet && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700" data-testid="badge-pt-section">
                    <User className="h-3 w-3 mr-1" />
                    PT Records ({ptCount})
                  </Badge>
                </div>
              )}
              {searchResults.map((record, idx) => (
                <ResultCard
                  key={`pt-${idx}`}
                  record={record}
                  headers={searchHeaders}
                  idx={idx}
                  highlightedColumns={highlightedColumns}
                  source={hasRefundsSheet ? "pt" : undefined}
                />
              ))}
            </div>
          )}

          {refCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700" data-testid="badge-refunds-section">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refund Records ({refCount})
                </Badge>
              </div>
              {refundsResults.map((record, idx) => (
                <ResultCard
                  key={`refund-${idx}`}
                  record={record}
                  headers={refundsHeaders}
                  idx={idx}
                  highlightedColumns={highlightedColumns}
                  source="refunds"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
