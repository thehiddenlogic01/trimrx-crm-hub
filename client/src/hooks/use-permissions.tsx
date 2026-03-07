import { useAuth } from "./use-auth";
import { hasFeatureAccess, parseFeaturePermissions, isEditorRole, type FeaturePermissions } from "@shared/sections";

export function usePermissions() {
  const { user } = useAuth();

  const role = (user as any)?.role || "manager";
  const featurePerms: FeaturePermissions = parseFeaturePermissions((user as any)?.featurePermissions);

  function can(page: string, feature: string): boolean {
    return hasFeatureAccess(role, featurePerms, page, feature);
  }

  const isAdmin = role === "admin";
  const isViewer = role === "viewer";
  const isEditor = isEditorRole(role);

  return { can, isAdmin, isViewer, isEditor, role, featurePerms };
}
