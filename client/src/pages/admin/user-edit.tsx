import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { type FeaturePermissions } from "@shared/sections";
import {
  type SafeUser,
  parsePermissions,
  parseFeaturePerms,
  RoleSelector,
  PageAccessEditor,
  FeaturePermissionsEditor,
} from "./user-components";

export default function EditUserPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const { data: users, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const user = users?.find((u) => u.id === userId);

  const [role, setRole] = useState("manager");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [featurePerms, setFeaturePerms] = useState<FeaturePermissions>({});
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.id !== lastUserId) {
      setRole(user.role || "manager");
      setPermissions(parsePermissions(user.permissions));
      setFeaturePerms(parseFeaturePerms(user.featurePermissions));
      setLastUserId(user.id);
    }
  }, [user, lastUserId]);

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
      navigate("/admin/users");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    updateMutation.mutate({
      id: userId,
      role,
      permissions,
      featurePermissions: featurePerms,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/admin/users")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">User Not Found</h2>
            <p className="text-muted-foreground mt-1">The user you're looking for doesn't exist or could not be loaded.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/users")} data-testid="button-back-to-list">
          Back to User List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate("/admin/users")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Edit User — {user.username}</h2>
          <p className="text-muted-foreground mt-1">Update role and permissions for this user</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
          <CardDescription>Configure this user's role and access permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <RoleSelector role={role} setRole={setRole} />

            {role !== "admin" && (
              <>
                <Separator />
                <PageAccessEditor perms={permissions} setter={setPermissions} disabled={role === "admin"} />
              </>
            )}

            {(role === "manager" || role === "editor") && permissions.length > 0 && (
              <>
                <Separator />
                <FeaturePermissionsEditor
                  sections={permissions}
                  featurePerms={featurePerms}
                  setFeaturePerms={setFeaturePerms}
                />
              </>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-user">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/users")} data-testid="button-cancel">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
