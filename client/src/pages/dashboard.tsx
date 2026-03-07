import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Zap, BarChart3 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your CRM activity
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value="0"
          description="No clients yet"
          icon={<Users className="h-4 w-4" />}
          testId="stat-clients"
          stagger={1}
        />
        <StatCard
          title="Messages"
          value="0"
          description="No messages yet"
          icon={<MessageSquare className="h-4 w-4" />}
          testId="stat-messages"
          stagger={2}
        />
        <StatCard
          title="Integrations"
          value="0"
          description="Connect services"
          icon={<Zap className="h-4 w-4" />}
          testId="stat-integrations"
          stagger={3}
        />
        <StatCard
          title="Activity"
          value="--"
          description="Getting started"
          icon={<BarChart3 className="h-4 w-4" />}
          testId="stat-activity"
          stagger={4}
        />
      </div>

      <Card className="animate-fade-in-up stagger-4">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to build</h3>
          <p className="text-muted-foreground max-w-md">
            Your CRM is set up and ready. Next steps include adding clients, connecting Slack, Google Sheets, and AI integrations.
          </p>
        </CardContent>
      </Card>
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
    <Card data-testid={testId} className={`animate-fade-in-up stagger-${stagger} transition-shadow hover:shadow-md`}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
