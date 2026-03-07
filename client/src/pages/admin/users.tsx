import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Loader2,
  UserPlus,
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

type SafeUser = {
  id: string;
  username: string;
  role: string | null;
  permissions: string | null;
  featurePermissions: string | null;
};

function parsePermissions(perms: string | null | undefined): string[] {
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

function parseFeaturePerms(raw: string | null | undefined): FeaturePermissions {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function RoleBadge({ role }: { role: string }) {
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

function FeaturePermissionsEditor({
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

export default function UserManagementPage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("manager");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [newFeaturePerms, setNewFeaturePerms] = useState<FeaturePermissions>({});
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editRole, setEditRole] = useState("manager");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editFeaturePerms, setEditFeaturePerms] = useState<FeaturePermissions>({});

  const { data: users, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      const user = await res.json();
      await apiRequest("PATCH", `/api/users/${user.id}`, {
        role: newRole,
        permissions: newRole === "admin" ? [] : newPermissions,
        featurePermissions: newRole === "admin" ? {} : newRole === "viewer" ? {} : newFeaturePerms,
      });
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      setShowCreateForm(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("manager");
      setNewPermissions([]);
      setNewFeaturePerms({});
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, role, permissions, featurePermissions }: {
      id: string; role: string; permissions: string[]; featurePermissions: FeaturePermissions;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, {
        role,
        permissions: role === "admin" ? [] : permissions,
        featurePermissions: role === "admin" ? {} : role === "viewer" ? {} : featurePermissions,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "User updated" });
      setEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete user", description: err.message, variant: "destructive" });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      toast({ title: "Please fill in both fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({ username: newUsername.trim(), password: newPassword });
  }

  function openEdit(user: SafeUser) {
    setEditingUser(user);
    setEditRole(user.role || "manager");
    setEditPermissions(parsePermissions(user.permissions));
    setEditFeaturePerms(parseFeaturePerms(user.featurePermissions));
    setEditDialogOpen(true);
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      role: editRole,
      permissions: editPermissions,
      featurePermissions: editFeaturePerms,
    });
  }

  function toggleRoute(perms: string[], route: string, setter: (v: string[]) => void) {
    if (perms.includes(route)) {
      setter(perms.filter((p) => p !== route));
    } else {
      setter([...perms, route]);
    }
  }

  function toggleAllRoutes(perms: string[], routes: readonly string[], setter: (v: string[]) => void) {
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

  function PageAccessEditor({ perms, setter, disabled }: { perms: string[]; setter: (v: string[]) => void; disabled?: boolean }) {
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

  function featureCountForUser(user: SafeUser): string {
    const fp = parseFeaturePerms(user.featurePermissions);
    const total = Object.values(fp).reduce((sum, arr) => sum + arr.length, 0);
    if (total === 0) return "";
    return `${total} feature${total !== 1 ? "s" : ""}`;
  }

  function UserFormDialog({
    open,
    onOpenChange,
    title,
    description,
    icon: Icon,
    role,
    setRole,
    perms,
    setPerms,
    featurePerms,
    setFeaturePerms,
    onSubmit,
    isPending,
    submitLabel,
    submitIcon: SubmitIcon,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    icon: any;
    role: string;
    setRole: (r: string) => void;
    perms: string[];
    setPerms: (p: string[]) => void;
    featurePerms: FeaturePermissions;
    setFeaturePerms: (fp: FeaturePermissions) => void;
    onSubmit: (e: React.FormEvent) => void;
    isPending: boolean;
    submitLabel: string;
    submitIcon: any;
    children?: React.ReactNode;
  }) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            {children}

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

            {role !== "admin" && (
              <>
                <Separator />
                <PageAccessEditor perms={perms} setter={setPerms} disabled={role === "admin"} />
              </>
            )}

            {(role === "manager" || role === "editor") && perms.length > 0 && (
              <>
                <Separator />
                <FeaturePermissionsEditor
                  sections={perms}
                  featurePerms={featurePerms}
                  setFeaturePerms={setFeaturePerms}
                />
              </>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-user">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SubmitIcon className="h-4 w-4 mr-2" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">User Management</h2>
          <p className="text-muted-foreground mt-1">Manage users, roles, and granular feature access</p>
        </div>
        <Button data-testid="button-add-user" onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "Add User"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Users</CardTitle>
          <CardDescription>Users and their assigned roles and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {(users || []).map((user) => {
                const perms = parsePermissions(user.permissions);
                const role = user.role || "manager";
                const featCount = featureCountForUser(user);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary uppercase">
                          {user.username.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p data-testid={`text-user-${user.username}`} className="text-sm font-medium text-foreground">
                          {user.username}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <RoleBadge role={role} />
                          {role !== "admin" && perms.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {perms.map((p) => APP_PAGES[p] || p).join(", ")}
                            </span>
                          )}
                          {role !== "admin" && perms.length === 0 && (
                            <span className="text-[10px] text-muted-foreground italic">No pages assigned</span>
                          )}
                          {role === "manager" && featCount && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                              {featCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.username !== "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(user.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New User
            </CardTitle>
            <CardDescription>Create a new user and configure their role and permissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-username">Username</Label>
                  <Input
                    id="new-username"
                    data-testid="input-new-username"
                    placeholder="Enter username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    data-testid="input-new-password"
                    type="password"
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
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
                {newRole === "admin" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Admins have full access to all sections and features.
                  </p>
                )}
                {newRole === "editor" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Editors can edit data on assigned pages but only see reports assigned to them.
                  </p>
                )}
                {newRole === "viewer" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Viewers can see everything in their assigned pages but cannot perform any actions.
                  </p>
                )}
              </div>

              {newRole !== "admin" && (
                <>
                  <Separator />
                  <PageAccessEditor perms={newPermissions} setter={setNewPermissions} disabled={newRole === "admin"} />
                </>
              )}

              {(newRole === "manager" || newRole === "editor") && newPermissions.length > 0 && (
                <>
                  <Separator />
                  <FeaturePermissionsEditor
                    sections={newPermissions}
                    featurePerms={newFeaturePerms}
                    setFeaturePerms={setNewFeaturePerms}
                  />
                </>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-user">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Create User
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <UserFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title={`Edit User — ${editingUser?.username}`}
        description="Update role and permissions for this user."
        icon={Pencil}
        role={editRole}
        setRole={setEditRole}
        perms={editPermissions}
        setPerms={setEditPermissions}
        featurePerms={editFeaturePerms}
        setFeaturePerms={setEditFeaturePerms}
        onSubmit={handleUpdate}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        submitIcon={Pencil}
      />
    </div>
  );
}
