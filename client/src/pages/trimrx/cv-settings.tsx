import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Settings2, GripVertical } from "lucide-react";

type DropdownConfig = {
  key: string;
  label: string;
  settingsKey: string;
};

const DROPDOWN_FIELDS: DropdownConfig[] = [
  { key: "slackStatusRt", label: "Slack Status (RT)", settingsKey: "slack_status_rt_options" },
];

function OptionManager({ config }: { config: DropdownConfig }) {
  const { toast } = useToast();
  const [newOption, setNewOption] = useState("");

  const { data: options = [] } = useQuery<string[]>({
    queryKey: ["/api/cv-settings", config.settingsKey],
    queryFn: async () => {
      const res = await fetch(`/api/cv-settings/${config.settingsKey}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newOptions: string[]) => {
      await apiRequest("POST", `/api/cv-settings/${config.settingsKey}`, { options: newOptions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-settings", config.settingsKey] });
      toast({ title: "Saved", description: "Options updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const addOption = () => {
    const val = newOption.trim();
    if (!val) return;
    if (options.includes(val)) {
      toast({ title: "Already exists", variant: "destructive" });
      return;
    }
    saveMutation.mutate([...options, val]);
    setNewOption("");
  };

  const removeOption = (opt: string) => {
    saveMutation.mutate(options.filter((o) => o !== opt));
  };

  return (
    <Card data-testid={`card-settings-${config.settingsKey}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {config.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            placeholder={`Add new ${config.label.toLowerCase()} option...`}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") addOption();
            }}
            data-testid={`input-add-${config.settingsKey}`}
          />
          <Button onClick={addOption} size="sm" disabled={saveMutation.isPending} data-testid={`button-add-${config.settingsKey}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground">No options added yet. Add options above to populate the dropdown.</p>
          )}
          {options.map((opt) => (
            <Badge key={opt} variant="secondary" className="text-sm py-1 px-3 gap-1" data-testid={`badge-option-${config.settingsKey}-${opt}`}>
              {opt}
              <button
                onClick={() => removeOption(opt)}
                className="ml-1 hover:text-destructive"
                data-testid={`button-remove-${config.settingsKey}-${opt}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CvSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="cv-settings-page">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-cv-settings-title">CV Settings</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Manage dropdown options for the CV Report and Retention Final Submit tables. Options you add here will appear as dropdown choices when editing reports.
      </p>
      {DROPDOWN_FIELDS.map((config) => (
        <OptionManager key={config.settingsKey} config={config} />
      ))}
    </div>
  );
}
