import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { APP_PAGES } from "@shared/sections";
import {
  type SafeUser,
  parsePermissions,
  RoleBadge,
  featureCountForUser,
} from "./user-components";

export default function UserManagementPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: users, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">User Management</h2>
          <p className="text-muted-foreground mt-1">Manage users, roles, and granular feature access</p>
        </div>
        <Button data-testid="button-add-user" onClick={() => navigate("/admin/users/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
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
                        onClick={() => navigate(`/admin/users/${user.id}/edit`)}
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
    </div>
  );
}
