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
} from "lucide-react";

interface PtFinderConfig {
  spreadsheetId: string;
  sheetName: string;
  headerRow: number;
  hasCredentials: boolean;
}

export default function PtFinderPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, string>[] | null>(null);
  const [searchHeaders, setSearchHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);

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

  const isConnected = configQuery.data?.hasCredentials && configQuery.data?.spreadsheetId;

  const highlightedColumns = ["Customer Email", "Email", "email", "Case Link", "case_link", "Name", "name", "Agent Assigned", "Request Status", "OUTCOME", "TICKET COMPLETION DATE", "Status"];

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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {searchResults.length === 0
                ? "No results found"
                : `Found ${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} out of ${totalRows} records`}
            </p>
            {searchResults.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchResults(null); setSearchQuery(""); }}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {searchResults.map((record, idx) => (
            <Card key={idx} data-testid={`card-result-${idx}`}>
              <CardHeader className="py-3 px-4 bg-muted/30">
                <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 text-primary" />
                  {record["Name"] || record["name"] || record["Patient Name"] || `Record #${idx + 1}`}
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
                  {searchHeaders.map((header) => {
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
          ))}
        </div>
      )}
    </div>
  );
}
