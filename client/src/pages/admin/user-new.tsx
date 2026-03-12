import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { type FeaturePermissions } from "@shared/sections";
import {
  RoleSelector,
  PageAccessEditor,
  FeaturePermissionsEditor,
} from "./user-components";

export default function AddUserPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [featurePerms, setFeaturePerms] = useState<FeaturePermissions>({});

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      const user = await res.json();
      await apiRequest("PATCH", `/api/users/${user.id}`, {
        role,
        permissions: role === "admin" ? [] : permissions,
        featurePermissions: role === "admin" ? {} : role === "viewer" ? {} : featurePerms,
      });
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      navigate("/admin/users");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "Please fill in both fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({ username: username.trim(), password });
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Add New User</h2>
          <p className="text-muted-foreground mt-1">Create a new user and configure their role and permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            User Details
          </CardTitle>
          <CardDescription>Set up the new user's credentials, role, and access permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  data-testid="input-new-username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

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
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-user">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Create User
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
