import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendHorizonal } from "lucide-react";

export default function RetentionFinalSubmitPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
          Retention Final Submit
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Submit finalized retention cases
        </p>
      </div>

      <Card data-testid="card-retention-final">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SendHorizonal className="h-5 w-5" />
            Retention Final Submit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="text-empty-state">
            <SendHorizonal className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="text-xs mt-1">This page will be used for final retention case submissions</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
