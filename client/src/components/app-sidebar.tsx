import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Zap,
  LogOut,
  ShieldCheck,
  UserCog,
  KeyRound,
  Hash,
  Scissors,
  HeadsetIcon,
  FileSpreadsheet,
  Bot,
  Gavel,
  FolderOpen,
  FileBarChart,
  CreditCard,
  FileImage,
  MessagesSquare,
  Headphones,
  Users,
  Database,
  Radio,
  Globe,
  Search,
  SendHorizonal,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { APP_SECTIONS, hasSectionAccess, hasPageAccess } from "@shared/sections";

const trimrxMenu = [
  { title: "CV Support", url: "/trimrx/cv-support", icon: HeadsetIcon },
  { title: "CV Report", url: "/trimrx/cv-report", icon: FileSpreadsheet },
  { title: "Retention Final Submit", url: "/trimrx/retention-final-submit", icon: SendHorizonal },
  { title: "Manage Slack Case", url: "/trimrx/slack-messages", icon: MessagesSquare },
  { title: "RT Help", url: "/trimrx/rt-help", icon: Headphones },
  { title: "CV Slack", url: "/trimrx/cv-slack", icon: Hash },
  { title: "CV Settings", url: "/trimrx/cv-settings", icon: Settings },
];

const disputesMenu = [
  { title: "Dispute Report Yedid", url: "/trimrx/dispute-report-yedid", icon: FileBarChart },
  { title: "Disputes Finder", url: "/trimrx/disputes-finder", icon: Search },
  { title: "Case Folder", url: "/trimrx/case-folders", icon: FolderOpen },
  { title: "Disputes Doc", url: "/trimrx/disputes-doc", icon: FileImage },
  { title: "Stripe Submit", url: "/trimrx/stripe-submit", icon: CreditCard },
  { title: "Patients Analysis", url: "/trimrx/patients-analysis", icon: Users },
  { title: "Settings", url: "/trimrx/dispute-settings", icon: Settings },
];

const communicationMenu = [
  { title: "Trimrx Internal (BD)", url: "/communication/internal-bd", icon: Globe },
];

const databaseMenu = [
  { title: "PT Finder", url: "/database/pt-finder", icon: Database },
  { title: "Stripe Payments", url: "/database/stripe-payments", icon: CreditCard },
];

const adminMenu = [
  { title: "User Management", url: "/admin/users", icon: UserCog },
  { title: "API Keys", url: "/admin/api-keys", icon: KeyRound },
  { title: "Slack", url: "/slack", icon: Hash },
  { title: "Integrations", url: "/integrations", icon: Zap },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

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

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const role = (user as any)?.role || "manager";
  const permissions = parsePermissions((user as any)?.permissions);

  const sections = [
    { key: "trimrx-cv", label: "TrimRX CV", icon: Scissors, items: trimrxMenu },
    { key: "trimrx-disputes", label: "TrimRX Disputes", icon: Gavel, items: disputesMenu },
    { key: "communication", label: "Communication", icon: Radio, items: communicationMenu },
    { key: "database", label: "Database", icon: Database, items: databaseMenu },
    { key: "admin", label: "Admin", icon: ShieldCheck, items: adminMenu },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">T</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-sidebar-foreground truncate">TrimRX</span>
            <span className="text-xs text-muted-foreground truncate">Workspace</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {sections
          .filter((section) => hasSectionAccess(role, permissions, section.key))
          .map((section) => {
            const visibleItems = section.items.filter(
              (item) => hasPageAccess(role, permissions, item.url)
            );
            if (visibleItems.length === 0) return null;
            return (
              <SidebarGroup key={section.key}>
                <SidebarGroupLabel>
                  {section.icon && <section.icon className="h-3.5 w-3.5 mr-1" />}
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          data-active={location === item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span data-testid="text-username" className="text-sm text-sidebar-foreground truncate">
                {user?.username}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 w-fit">
                {role === "admin" ? "Admin" : role === "viewer" ? "Viewer" : "Manager"}
              </Badge>
            </div>
          </div>
          <Button
            data-testid="button-logout"
            variant="ghost"
            size="icon"
            onClick={logout}
            className="shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
