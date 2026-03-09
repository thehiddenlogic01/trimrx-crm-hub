import { lazy, Suspense, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { hasRouteAccess, APP_SECTIONS } from "@shared/sections";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Page error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ShieldAlert className="h-12 w-12 text-orange-500" />
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            This page encountered an error. Click below to retry.
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            data-testid="button-error-retry"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const UserManagementPage = lazy(() => import("@/pages/admin/users"));
const ApiKeysPage = lazy(() => import("@/pages/admin/api-keys"));
const SlackPage = lazy(() => import("@/pages/slack"));
const CvSupportPage = lazy(() => import("@/pages/trimrx/cv-support"));
const CvReportPage = lazy(() => import("@/pages/trimrx/cv-report"));
const RetentionFinalSubmitPage = lazy(() => import("@/pages/trimrx/retention-final-submit"));
const CaseFoldersPage = lazy(() => import("@/pages/trimrx/case-folders"));
const DisputeReportYedidPage = lazy(() => import("@/pages/trimrx/dispute-report-yedid"));
const DisputesFinderPage = lazy(() => import("@/pages/trimrx/disputes-finder"));
const StripeSubmitPage = lazy(() => import("@/pages/trimrx/stripe-submit"));
const DisputeSettingsPage = lazy(() => import("@/pages/trimrx/dispute-settings"));
const CvSettingsPage = lazy(() => import("@/pages/trimrx/cv-settings"));
const DisputesDocPage = lazy(() => import("@/pages/trimrx/disputes-doc"));
const PatientsAnalysisPage = lazy(() => import("@/pages/trimrx/patients-analysis"));
const SlackMessagesPage = lazy(() => import("@/pages/trimrx/slack-messages"));
const CvSlackPage = lazy(() => import("@/pages/trimrx/cv-slack"));
const RtHelpPage = lazy(() => import("@/pages/trimrx/rt-help"));
const GptChatPage = lazy(() => import("@/pages/gpt-chat"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/settings"));
const PtFinderPage = lazy(() => import("@/pages/database/pt-finder"));
const InternalBdPage = lazy(() => import("@/pages/trimrx/internal-bd"));
const StripePaymentsPage = lazy(() => import("@/pages/database/stripe-payments"));

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

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType; path?: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (path && !hasRouteAccess((user as any).role, parsePermissions((user as any).permissions), path)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <Component />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div key={location} className="page-transition">
      {children}
    </div>
  );
}

function AppLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b h-12">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <PageWrapper>
                <Switch>
                  <Route path="/">
                    {() => <ProtectedRoute component={DashboardPage} path="/" />}
                  </Route>
                  <Route path="/admin/users">
                    {() => <ProtectedRoute component={UserManagementPage} path="/admin/users" />}
                  </Route>
                  <Route path="/admin/api-keys">
                    {() => <ProtectedRoute component={ApiKeysPage} path="/admin/api-keys" />}
                  </Route>
                  <Route path="/slack">
                    {() => <ProtectedRoute component={SlackPage} path="/slack" />}
                  </Route>
                  <Route path="/trimrx/cv-support">
                    {() => <ProtectedRoute component={CvSupportPage} path="/trimrx/cv-support" />}
                  </Route>
                  <Route path="/trimrx/cv-report">
                    {() => <ProtectedRoute component={CvReportPage} path="/trimrx/cv-report" />}
                  </Route>
                  <Route path="/trimrx/retention-final-submit">
                    {() => <ProtectedRoute component={RetentionFinalSubmitPage} path="/trimrx/retention-final-submit" />}
                  </Route>
                  <Route path="/trimrx/case-folders">
                    {() => <ProtectedRoute component={CaseFoldersPage} path="/trimrx/case-folders" />}
                  </Route>
                  <Route path="/trimrx/dispute-report-yedid">
                    {() => <ProtectedRoute component={DisputeReportYedidPage} path="/trimrx/dispute-report-yedid" />}
                  </Route>
                  <Route path="/trimrx/disputes-finder">
                    {() => <ProtectedRoute component={DisputesFinderPage} path="/trimrx/disputes-finder" />}
                  </Route>
                  <Route path="/trimrx/stripe-submit">
                    {() => <ProtectedRoute component={StripeSubmitPage} path="/trimrx/stripe-submit" />}
                  </Route>
                  <Route path="/trimrx/disputes-doc">
                    {() => <ProtectedRoute component={DisputesDocPage} path="/trimrx/disputes-doc" />}
                  </Route>
                  <Route path="/trimrx/patients-analysis">
                    {() => <ProtectedRoute component={PatientsAnalysisPage} path="/trimrx/patients-analysis" />}
                  </Route>
                  <Route path="/trimrx/slack-messages">
                    {() => <ProtectedRoute component={SlackMessagesPage} path="/trimrx/slack-messages" />}
                  </Route>
                  <Route path="/trimrx/rt-help">
                    {() => <ProtectedRoute component={RtHelpPage} path="/trimrx/rt-help" />}
                  </Route>
                  <Route path="/trimrx/cv-slack">
                    {() => <ProtectedRoute component={CvSlackPage} path="/trimrx/cv-slack" />}
                  </Route>
                  <Route path="/trimrx/dispute-settings">
                    {() => <ProtectedRoute component={DisputeSettingsPage} path="/trimrx/dispute-settings" />}
                  </Route>
                  <Route path="/trimrx/cv-settings">
                    {() => <ProtectedRoute component={CvSettingsPage} path="/trimrx/cv-settings" />}
                  </Route>
                  <Route path="/gpt-chat">
                    {() => <ProtectedRoute component={GptChatPage} path="/gpt-chat" />}
                  </Route>
                  <Route path="/integrations">
                    {() => <ProtectedRoute component={IntegrationsPage} path="/integrations" />}
                  </Route>
                  <Route path="/admin/settings">
                    {() => <ProtectedRoute component={AdminSettingsPage} path="/admin/settings" />}
                  </Route>
                  <Route path="/database/pt-finder">
                    {() => <ProtectedRoute component={PtFinderPage} path="/database/pt-finder" />}
                  </Route>
                  <Route path="/communication/internal-bd">
                    {() => <ProtectedRoute component={InternalBdPage} path="/communication/internal-bd" />}
                  </Route>
                  <Route path="/database/stripe-payments">
                    {() => <ProtectedRoute component={StripePaymentsPage} path="/database/stripe-payments" />}
                  </Route>
                  <Route component={NotFound} />
                </Switch>
              </PageWrapper>
            </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        {() => (user ? <AppLayout /> : <Redirect to="/login" />)}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
