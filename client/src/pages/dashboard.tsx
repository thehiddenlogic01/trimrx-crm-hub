import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Zap, BarChart3, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user as any)?.role || "manager";

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-greeting">
              {greeting}, {user?.username}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Here's your workspace overview
            </p>
          </div>
          <Badge variant="outline" className="text-xs gap-1.5 h-7 px-3">
            <Clock className="h-3 w-3" />
            {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value="--"
          description="Active records"
          icon={<Users className="h-4 w-4" />}
          testId="stat-clients"
          stagger={1}
        />
        <StatCard
          title="Messages"
          value="--"
          description="Slack messages"
          icon={<MessageSquare className="h-4 w-4" />}
          testId="stat-messages"
          stagger={2}
        />
        <StatCard
          title="Integrations"
          value="--"
          description="Connected services"
          icon={<Zap className="h-4 w-4" />}
          testId="stat-integrations"
          stagger={3}
        />
        <StatCard
          title="Activity"
          value="--"
          description="Today's actions"
          icon={<BarChart3 className="h-4 w-4" />}
          testId="stat-activity"
          stagger={4}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <QuickLink
          title="Manage Slack Cases"
          description="View and respond to incoming Slack support cases"
          href="/trimrx/slack-messages"
          icon={<MessageSquare className="h-5 w-5" />}
          stagger={1}
        />
        <QuickLink
          title="Slack Backlog"
          description="Process backlog messages and match data"
          href="/trimrx/slack-backlog-all"
          icon={<BarChart3 className="h-5 w-5" />}
          stagger={2}
        />
        {role === "admin" && (
          <>
            <QuickLink
              title="User Management"
              description="Manage users, roles, and permissions"
              href="/admin/users"
              icon={<Users className="h-5 w-5" />}
              stagger={3}
            />
            <QuickLink
              title="Audit Report"
              description="View system activity and audit logs"
              href="/admin/audit-report"
              icon={<BarChart3 className="h-5 w-5" />}
              stagger={4}
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  testId,
  stagger = 1,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  testId: string;
  stagger?: number;
}) {
  return (
    <Card data-testid={testId} className={`animate-fade-in-up stagger-${stagger}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  title,
  description,
  href,
  icon,
  stagger = 1,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  stagger?: number;
}) {
  return (
    <Link href={href}>
      <Card className={`animate-fade-in-up stagger-${stagger} cursor-pointer group hover:border-primary/30 transition-colors`} data-testid={`link-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
