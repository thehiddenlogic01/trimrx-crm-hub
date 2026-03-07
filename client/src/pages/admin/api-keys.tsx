import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sheet, Loader2, Save, Plus, Trash2, Download, Upload } from "lucide-react";

const CV_REPORT_FIELDS = [
  { key: "submittedBy", label: "User" },
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
  { key: "checkingStatus", label: "Checking Status" },
];

const COLUMN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface GSheetConfig {
  spreadsheetId: string;
  sheetName: string;
  columnMapping: Record<string, string>;
  startRow: number;
  hasCredentials: boolean;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const { data: config, isLoading } = useQuery<GSheetConfig>({
    queryKey: ["/api/gsheets/config"],
  });

  useEffect(() => {
    if (config) {
      setColumnMapping(config.columnMapping || {});
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/gsheets/config", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gsheets/config"] });
      toast({ title: "Column mapping saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gsheets/clear");
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Sheet data cleared", description: "All data rows have been removed from the sheet (headers kept)" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to clear", description: err.message, variant: "destructive" });
    },
  });

  function handleSaveMapping() {
    saveMutation.mutate({ columnMapping });
  }

  function handleBackupSettings() {
    const backup = {
      spreadsheetId: config?.spreadsheetId,
      sheetName: config?.sheetName,
      startRow: config?.startRow,
      columnMapping,
      backupDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gsheets-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded" });
  }

  function handleRestoreSettings(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.columnMapping) setColumnMapping(data.columnMapping);
        toast({ title: "Settings restored", description: "Review the mappings and click Save to apply." });
      } catch {
        toast({ title: "Invalid backup file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function addMapping() {
    const usedFields = Object.keys(columnMapping);
    const nextField = CV_REPORT_FIELDS.find((f) => !usedFields.includes(f.key));
    if (!nextField) return;

    const usedCols = Object.values(columnMapping);
    const nextCol = COLUMN_LETTERS.find((l) => !usedCols.includes(l)) || "A";

    setColumnMapping((prev) => ({ ...prev, [nextField.key]: nextCol }));
  }

  function removeMapping(field: string) {
    setColumnMapping((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateMappingField(oldField: string, newField: string) {
    setColumnMapping((prev) => {
      const col = prev[oldField];
      const next = { ...prev };
      delete next[oldField];
      next[newField] = col;
      return next;
    });
  }

  function updateMappingCol(field: string, col: string) {
    setColumnMapping((prev) => ({ ...prev, [field]: col }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = config?.hasCredentials && config?.spreadsheetId;
  const mappingEntries = Object.entries(columnMapping);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Google Sheets Column Mapping</h2>
        <p className="text-muted-foreground mt-1">Map CV Report fields to Google Sheet columns for data sync</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Sheet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">Column Mapping</CardTitle>
                <CardDescription>Map CV Report fields to Google Sheet columns (A, B, C...)</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "outline"} data-testid="badge-gsheet-status">
                {isConnected ? "Connected" : "Not configured"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={addMapping}
              disabled={mappingEntries.length >= CV_REPORT_FIELDS.length}
              data-testid="button-add-mapping"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Field
            </Button>
          </div>

          {mappingEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
              No column mappings configured. Click "Add Field" to start mapping CV Report fields to sheet columns.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_40px] gap-2 text-xs font-semibold text-muted-foreground px-1">
                <span>CV Report Field</span>
                <span>Sheet Column</span>
                <span></span>
              </div>
              {mappingEntries.map(([field, col]) => {
                const fieldLabel = CV_REPORT_FIELDS.find((f) => f.key === field)?.label || field;
                return (
                  <div key={field} className="grid grid-cols-[1fr_100px_40px] gap-2 items-center" data-testid={`mapping-row-${field}`}>
                    <Select value={field} onValueChange={(val) => updateMappingField(field, val)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue>{fieldLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CV_REPORT_FIELDS.map((f) => (
                          <SelectItem
                            key={f.key}
                            value={f.key}
                            disabled={f.key !== field && field in columnMapping && f.key in columnMapping}
                          >
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={col} onValueChange={(val) => updateMappingCol(field, val)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue>{col}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_LETTERS.map((letter) => (
                          <SelectItem key={letter} value={letter}>
                            {letter}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeMapping(field)}
                      data-testid={`button-remove-mapping-${field}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleSaveMapping}
              disabled={saveMutation.isPending}
              data-testid="button-save-mapping"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Column Mapping
            </Button>
            {isConnected && (
              <Button
                variant="outline"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                data-testid="button-clear-gsheet"
              >
                {clearMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear Sheet Data
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleBackupSettings}
              data-testid="button-backup-settings"
            >
              <Download className="h-4 w-4 mr-2" />
              Backup Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById("restore-file-input")?.click()}
              data-testid="button-restore-settings"
            >
              <Upload className="h-4 w-4 mr-2" />
              Restore Settings
            </Button>
            <input
              id="restore-file-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestoreSettings}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
