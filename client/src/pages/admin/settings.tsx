import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Tag, Package, Crosshair, AlertTriangle, LayoutDashboard, Eye, EyeOff, ArrowUp, ArrowDown, GripVertical, ArrowUpDown } from "lucide-react";
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

function SectionOrderSection() {
  const { toast } = useToast();
  const nonAdminSections = SIDEBAR_SECTIONS.filter((s) => s.label !== "Admin").map((s) => s.label);

  const { data: sectionOrder = nonAdminSections } = useQuery<string[]>({
    queryKey: ["/api/cv-settings", "sidebar_section_order"],
    queryFn: async () => {
      const res = await fetch("/api/cv-settings/sidebar_section_order", { credentials: "include" });
      if (!res.ok) return nonAdminSections;
      const data = await res.json();
      const saved: string[] = (data.options || []).filter((s: string) => s !== "Admin");
      if (saved.length === 0) return nonAdminSections;
      const merged = [...saved.filter((s: string) => nonAdminSections.includes(s)), ...nonAdminSections.filter((s) => !saved.includes(s))];
      return merged;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      await apiRequest("POST", "/api/cv-settings/sidebar_section_order", { options: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-settings", "sidebar_section_order"] });
      toast({ title: "Saved", description: "Section order updated." });
    },
  });

  const moveSection = (index: number, direction: "up" | "down") => {
    const newOrder = [...sectionOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    saveMutation.mutate(newOrder);
  };

  return (
    <Card data-testid="card-section-order">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowUpDown className="h-5 w-5 text-primary" />
          Section Order
        </CardTitle>
        <CardDescription>
          Control the order of sidebar sections. Move sections up or down to rearrange. Admin section is always pinned at the bottom.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sectionOrder.map((label, index) => (
          <div
            key={label}
            className="flex items-center justify-between p-3 rounded-lg border bg-background"
            data-testid={`row-section-order-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0 || saveMutation.isPending}
                onClick={() => moveSection(index, "up")}
                data-testid={`button-section-up-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === sectionOrder.length - 1 || saveMutation.isPending}
                onClick={() => moveSection(index, "down")}
                data-testid={`button-section-down-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 opacity-60">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Admin</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pinned</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function MenuOrderSection() {
  const { toast } = useToast();

  const { data: menuOrder = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/cv-settings", "sidebar_menu_order"],
    queryFn: async () => {
      const res = await fetch("/api/cv-settings/sidebar_menu_order", { credentials: "include" });
      if (!res.ok) return {};
      const data = await res.json();
      return data.options || {};
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newOrder: Record<string, string[]>) => {
      await apiRequest("POST", "/api/cv-settings/sidebar_menu_order", { options: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cv-settings", "sidebar_menu_order"] });
      toast({ title: "Saved", description: "Menu order updated." });
    },
  });

  const getOrderedRoutes = (section: { label: string; routes: string[] }) => {
    const saved = menuOrder[section.label];
    if (!saved || saved.length === 0) return section.routes;
    const merged = [...saved.filter((r: string) => section.routes.includes(r)), ...section.routes.filter((r) => !saved.includes(r))];
    return merged;
  };

  const moveItem = (sectionLabel: string, routes: string[], index: number, direction: "up" | "down") => {
    const ordered = [...routes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    const newOrder = { ...menuOrder, [sectionLabel]: ordered };
    saveMutation.mutate(newOrder);
  };

  return (
    <Card data-testid="card-menu-order-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GripVertical className="h-5 w-5 text-primary" />
          Menu Item Order
        </CardTitle>
        <CardDescription>
          Control the order of menu items within each sidebar section. Move items up or down to rearrange.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SIDEBAR_SECTIONS.filter((s) => s.label !== "Admin").map((section) => {
          const orderedRoutes = getOrderedRoutes(section);
          return (
            <div key={section.label}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">{section.label}</h4>
              <div className="space-y-1.5">
                {orderedRoutes.map((route, index) => {
                  const label = APP_PAGES[route] || route;
                  return (
                    <div
                      key={route}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                      data-testid={`row-menu-order-${route.replace(/\//g, "-").slice(1)}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono w-5 text-center">{index + 1}</span>
                        <span className="text-sm">{label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{route}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0 || saveMutation.isPending}
                          onClick={() => moveItem(section.label, orderedRoutes, index, "up")}
                          data-testid={`button-menu-up-${route.replace(/\//g, "-").slice(1)}`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === orderedRoutes.length - 1 || saveMutation.isPending}
                          onClick={() => moveItem(section.label, orderedRoutes, index, "down")}
                          data-testid={`button-menu-down-${route.replace(/\//g, "-").slice(1)}`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

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
      <SectionOrderSection />
      <MenuOrderSection />
      <ReasonSection />
      <ProductTypeSection />
      <DesiredActionSection />
      <ClientThreatSection />
    </div>
  );
}
