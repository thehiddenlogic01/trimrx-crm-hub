import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Pencil,
  ShieldCheck,
  UserCog,
  Eye,
  ChevronRight,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { APP_SECTIONS, APP_FEATURES, APP_PAGES, type FeaturePermissions } from "@shared/sections";

export type SafeUser = {
  id: string;
  username: string;
  role: string | null;
  permissions: string | null;
  featurePermissions: string | null;
};

export function parsePermissions(perms: string | null | undefined): string[] {
  if (!perms) return [];
  try {
    const parsed: string[] = JSON.parse(perms);
    const migrated: string[] = [];
    for (const p of parsed) {
      if (p.startsWith("/")) {
        migrated.push(p);
      } else {
        const section = APP_SECTIONS.find((s) => s.key === p);
        if (section) {
          for (const route of section.routes) {
            if (!migrated.includes(route)) migrated.push(route);
          }
        }
      }
    }
    return migrated;
  } catch { return []; }
}

export function parseFeaturePerms(raw: string | null | undefined): FeaturePermissions {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <Badge variant="default" className="text-[10px] px-1.5 py-0">
        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
        Admin
      </Badge>
    );
  }
  if (role === "editor") {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        <Pencil className="h-2.5 w-2.5 mr-0.5" />
        Editor
      </Badge>
    );
  }
  if (role === "viewer") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        <Eye className="h-2.5 w-2.5 mr-0.5" />
        Viewer
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
      <UserCog className="h-2.5 w-2.5 mr-0.5" />
      Manager
    </Badge>
  );
}

export function toggleRoute(perms: string[], route: string, setter: (v: string[]) => void) {
  if (perms.includes(route)) {
    setter(perms.filter((p) => p !== route));
  } else {
    setter([...perms, route]);
  }
}

export function toggleAllRoutes(perms: string[], routes: readonly string[], setter: (v: string[]) => void) {
  const allIncluded = routes.every((r) => perms.includes(r));
  if (allIncluded) {
    setter(perms.filter((p) => !routes.includes(p)));
  } else {
    const newPerms = [...perms];
    for (const r of routes) {
      if (!newPerms.includes(r)) newPerms.push(r);
    }
    setter(newPerms);
  }
}

export function FeaturePermissionsEditor({
  sections,
  featurePerms,
  setFeaturePerms,
  disabled,
}: {
  sections: string[];
  featurePerms: FeaturePermissions;
  setFeaturePerms: (fp: FeaturePermissions) => void;
  disabled?: boolean;
}) {
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  const relevantPages = APP_FEATURES.filter((pf) => sections.includes(pf.route));

  function togglePage(page: string) {
    setOpenPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  function toggleFeature(page: string, feature: string) {
    const current = featurePerms[page] || [];
    const next = current.includes(feature)
      ? current.filter((f) => f !== feature)
      : [...current, feature];
    setFeaturePerms({ ...featurePerms, [page]: next });
  }

  function toggleAllFeatures(page: string, features: string[]) {
    const current = featurePerms[page] || [];
    const allEnabled = features.every((f) => current.includes(f));
    setFeaturePerms({
      ...featurePerms,
      [page]: allEnabled ? [] : [...features],
    });
  }

  if (relevantPages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        Select page access first to configure feature permissions.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Feature Permissions</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Control which actions the user can perform on each page.
      </p>
      <div className="border rounded-md divide-y">
        {relevantPages.map((pf) => {
          const isOpen = openPages.has(pf.page);
          const enabledCount = (featurePerms[pf.page] || []).length;
          const totalCount = pf.features.length;
          const allEnabled = totalCount > 0 && enabledCount === totalCount;

          return (
            <Collapsible key={pf.page} open={isOpen} onOpenChange={() => togglePage(pf.page)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  data-testid={`toggle-page-${pf.page}`}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{pf.label}</span>
                  </div>
                  <Badge
                    variant={enabledCount === 0 ? "outline" : enabledCount === totalCount ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {enabledCount}/{totalCount}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {allEnabled ? "All features enabled" : `${enabledCount} of ${totalCount} enabled`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => !disabled && toggleAllFeatures(pf.page, pf.features.map((f) => f.key))}
                      disabled={disabled}
                      data-testid={`toggle-all-${pf.page}`}
                    >
                      {allEnabled ? (
                        <><ToggleRight className="h-3 w-3 mr-1" /> Disable All</>
                      ) : (
                        <><ToggleLeft className="h-3 w-3 mr-1" /> Enable All</>
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {pf.features.map((feat) => {
                      const enabled = (featurePerms[pf.page] || []).includes(feat.key);
                      return (
                        <label
                          key={feat.key}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors text-sm ${
                            disabled ? "opacity-50 cursor-not-allowed" : enabled ? "bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => !disabled && toggleFeature(pf.page, feat.key)}
                            disabled={disabled}
                            className="scale-75"
                            data-testid={`switch-${pf.page}-${feat.key}`}
                          />
                          <span>{feat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export function PageAccessEditor({ perms, setter, disabled }: { perms: string[]; setter: (v: string[]) => void; disabled?: boolean }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Page Access</Label>
      <p className="text-xs text-muted-foreground">
        Select which pages this user can access.
      </p>
      <div className="border rounded-md divide-y">
        {APP_SECTIONS.filter((s) => s.key !== "menu").map((section) => {
          const isOpen = openSections.has(section.key);
          const enabledCount = section.routes.filter((r) => perms.includes(r)).length;
          const totalCount = section.routes.length;
          const allEnabled = totalCount > 0 && enabledCount === totalCount;

          return (
            <Collapsible key={section.key} open={isOpen} onOpenChange={() => toggleSection(section.key)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  data-testid={`toggle-section-${section.key}`}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{section.label}</span>
                  </div>
                  <Badge
                    variant={enabledCount === 0 ? "outline" : enabledCount === totalCount ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {enabledCount}/{totalCount}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {allEnabled ? "All pages enabled" : `${enabledCount} of ${totalCount} enabled`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => !disabled && toggleAllRoutes(perms, section.routes, setter)}
                      disabled={disabled}
                      data-testid={`toggle-all-section-${section.key}`}
                    >
                      {allEnabled ? (
                        <><ToggleRight className="h-3 w-3 mr-1" /> Disable All</>
                      ) : (
                        <><ToggleLeft className="h-3 w-3 mr-1" /> Enable All</>
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {section.routes.map((route) => {
                      const enabled = perms.includes(route);
                      const label = APP_PAGES[route] || route;
                      return (
                        <label
                          key={route}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors text-sm ${
                            disabled ? "opacity-50 cursor-not-allowed" : enabled ? "bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={enabled}
                            onCheckedChange={() => !disabled && toggleRoute(perms, route, setter)}
                            disabled={disabled}
                            data-testid={`checkbox-page-${route.replace(/\//g, "-")}`}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export function RoleSelector({ role, setRole }: { role: string; setRole: (r: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Role</Label>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger data-testid="select-role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin — Full access to everything
            </div>
          </SelectItem>
          <SelectItem value="manager">
            <div className="flex items-center gap-2">
              <UserCog className="h-3.5 w-3.5" />
              Manager — Configurable access
            </div>
          </SelectItem>
          <SelectItem value="editor">
            <div className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editor — Edit access, sees only assigned data
            </div>
          </SelectItem>
          <SelectItem value="viewer">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              Viewer — Read-only access
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {role === "admin" && (
        <p className="text-xs text-muted-foreground mt-1">
          Admins have full access to all sections and features.
        </p>
      )}
      {role === "editor" && (
        <p className="text-xs text-muted-foreground mt-1">
          Editors can edit data on assigned pages but only see reports assigned to them.
        </p>
      )}
      {role === "viewer" && (
        <p className="text-xs text-muted-foreground mt-1">
          Viewers can see everything in their assigned pages but cannot perform any actions.
        </p>
      )}
    </div>
  );
}

export function featureCountForUser(user: SafeUser): string {
  const fp = parseFeaturePerms(user.featurePermissions);
  const total = Object.values(fp).reduce((sum, arr) => sum + arr.length, 0);
  if (total === 0) return "";
  return `${total} feature${total !== 1 ? "s" : ""}`;
}
