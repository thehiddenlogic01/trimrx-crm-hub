import { Card, CardContent } from "@/components/ui/card";
import { Hash } from "lucide-react";

export default function CvSlackPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">CV Slack</h2>
        <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Hash className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">This page is under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}
