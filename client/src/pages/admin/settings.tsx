import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Tag, Package, Crosshair, AlertTriangle, LayoutDashboard, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { REASON_SUBREASON_MAP, DESIRED_ACTION_OPTIONS, CLIENT_THREAT_OPTIONS } from "@shared/classification";
import { APP_PAGES } from "@shared/sections";

const REASON_COLORS: Record<string, string> = {
  "Financial & Pricing": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Clinical & Health": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Logistics & Supply": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Support & UX": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Uncategorized": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "Not for Retention": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CLASSIFICATION_DATA = {
  reasons: Object.entries(REASON_SUBREASON_MAP).map(([name, subReasons]) => ({
    name,
    color: REASON_COLORS[name] || "bg-gray-100 text-gray-800",
    subReasons,
  })),
  productTypes: [
    { name: "1M", description: "Monthly subscription (single month supply)" },
    { name: "3M Bundle", description: "3-month bundle subscription" },
    { name: "6M Bundle", description: "6-month bundle subscription" },
    { name: "12M Bundle", description: "12-month bundle subscription" },
    { name: "Supplement", description: "Supplement products (NAD+, Sermorelin, etc.)" },
    { name: "Upsell", description: "Upsell add-on products" },
  ],
  desiredActions: [
    { name: "Cancel", description: "Patient wants to cancel their subscription only" },
    { name: "Refund", description: "Patient wants a refund only" },
    { name: "Refund and Cancel", description: "Patient wants both a refund and cancellation" },
    { name: "Paused", description: "Patient wants to pause their subscription" },
    { name: "N/A", description: "No specific action requested or not applicable" },
  ],
  clientThreats: [
    { name: "BBB Review", keywords: "BBB, Better Business Bureau" },
    { name: "Dispute", keywords: "dispute, chargeback, bank dispute" },
    { name: "Attorney General", keywords: "attorney general, lawyer, legal action" },
    { name: "Trust Pilot Review", keywords: "trustpilot, bad review, negative review" },
  ],
};

function ReasonSection() {
  const [openReasons, setOpenReasons] = useState<Record<string, boolean>>({});

  const toggleReason = (name: string) => {
    setOpenReasons((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <Card data-testid="card-reasons-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="h-5 w-5 text-primary" />
          Reason & Sub-Reason
        </CardTitle>
        <CardDescription>
          Classification categories used by GPT AI to identify why a patient is requesting cancellation or refund. Each primary reason contains specific sub-reasons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {CLASSIFICATION_DATA.reasons.map((reason) => (
          <Collapsible
            key={reason.name}
            open={openReasons[reason.name] || false}
            onOpenChange={() => toggleReason(reason.name)}
          >
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              data-testid={`trigger-reason-${reason.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-3">
                {openReasons[reason.name] ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Badge className={`${reason.color} border-0 font-medium`}>
                  {reason.name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {reason.subReasons.length} sub-reason{reason.subReasons.length !== 1 ? "s" : ""}
                </span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-7 mt-1 mb-2 pl-4 border-l-2 border-muted space-y-1.5">
                {reason.subReasons.map((sub) => (
                  <div
                    key={sub}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-md text-sm bg-muted/30"
                    data-testid={`text-subreason-${sub.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    {sub}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductTypeSection() {
  return (
    <Card data-testid="card-product-types-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Product Type
        </CardTitle>
        <CardDescription>
          Product categories extracted from CareValidate case data. These represent the subscription plans and add-on products.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CLASSIFICATION_DATA.productTypes.map((pt) => (
            <div
              key={pt.name}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
              data-testid={`card-product-type-${pt.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Badge variant="secondary" className="font-semibold shrink-0 mt-0.5">
                {pt.name}
              </Badge>
              <span className="text-sm text-muted-foreground">{pt.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DesiredActionSection() {
  return (
    <Card data-testid="card-desired-actions-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crosshair className="h-5 w-5 text-primary" />
          Desired Action
        </CardTitle>
        <CardDescription>
          Actions the AI identifies from the patient's request. These determine what needs to happen with the account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CLASSIFICATION_DATA.desiredActions.map((action) => (
            <div
              key={action.name}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
              data-testid={`card-desired-action-${action.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Badge variant="outline" className="font-semibold shrink-0 mt-0.5">
                {action.name}
              </Badge>
              <span className="text-sm text-muted-foreground">{action.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ClientThreatSection() {
  return (
    <Card data-testid="card-client-threats-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Client Threat
        </CardTitle>
        <CardDescription>
          Threat types auto-detected by GPT AI and keyword fallback scanner. When a patient mentions any of these, the system flags the message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CLASSIFICATION_DATA.clientThreats.map((threat) => (
            <div
              key={threat.name}
              className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5"
              data-testid={`card-client-threat-${threat.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Badge variant="destructive" className="font-semibold shrink-0 mt-0.5">
                {threat.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Keywords: {threat.keywords}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const SIDEBAR_SECTIONS: { label: string; routes: string[] }[] = [
  {
    label: "TrimRX CV",
    routes: ["/trimrx/cv-support", "/trimrx/cv-report", "/trimrx/retention-final-submit", "/trimrx/slack-messages", "/trimrx/rt-help", "/trimrx/cv-slack", "/trimrx/cv-settings"],
  },
  {
    label: "TrimRX Disputes",
    routes: ["/trimrx/dispute-report-yedid", "/trimrx/disputes-finder", "/trimrx/case-folders", "/trimrx/disputes-doc", "/trimrx/stripe-submit", "/trimrx/patients-analysis", "/trimrx/dispute-settings"],
  },
  {
    label: "Communication",
    routes: ["/communication/internal-bd"],
  },
  {
    label: "Database",
    routes: ["/database/pt-finder", "/database/stripe-payments"],
  },
  {
    label: "Admin",
    routes: ["/admin/users", "/admin/api-keys", "/slack", "/gpt-chat", "/integrations", "/admin/settings"],
  },
];

function SidebarVisibilitySection() {
  const { toast } = useToast();

  const { data: hiddenItems = [] } = useQuery<string[]>({
    queryKey: ["/api/cv-settings", "sidebar_hidden_items"],
    queryFn: async () => {
      const res = await fetch("/api/cv-settings/sidebar_hidden_items", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newHidden: string[]) => {
      await apiRequest("POST", "/api/cv-settings/sidebar_hidden_items", { options: newHidden });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-settings", "sidebar_hidden_items"] });
      toast({ title: "Saved", description: "Sidebar visibility updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleItem = (route: string) => {
    const newHidden = hiddenItems.includes(route)
      ? hiddenItems.filter((r) => r !== route)
      : [...hiddenItems, route];
    saveMutation.mutate(newHidden);
  };

  const isVisible = (route: string) => !hiddenItems.includes(route);

  return (
    <Card data-testid="card-sidebar-visibility-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Sidebar Menu Visibility
        </CardTitle>
        <CardDescription>
          Control which menu items are visible in the sidebar for all users. Hidden items will not appear in the navigation. Admin pages cannot be hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">{section.label}</h4>
            <div className="space-y-2">
              {section.routes.map((route) => {
                const label = APP_PAGES[route] || route;
                const isAdmin = section.label === "Admin";
                const visible = isVisible(route);
                return (
                  <div
                    key={route}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${visible ? "bg-background" : "bg-muted/50 opacity-60"}`}
                    data-testid={`row-sidebar-item-${route.replace(/\//g, "-").slice(1)}`}
                  >
                    <div className="flex items-center gap-3">
                      {visible ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm ${visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {label}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {route}
                      </Badge>
                    </div>
                    <Switch
                      checked={visible}
                      onCheckedChange={() => toggleItem(route)}
                      disabled={isAdmin || saveMutation.isPending}
                      data-testid={`switch-sidebar-${route.replace(/\//g, "-").slice(1)}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-admin-settings-title">
          Admin Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage sidebar visibility and view AI classification categories.
        </p>
      </div>

      <SidebarVisibilitySection />
      <ReasonSection />
      <ProductTypeSection />
      <DesiredActionSection />
      <ClientThreatSection />
    </div>
  );
}
