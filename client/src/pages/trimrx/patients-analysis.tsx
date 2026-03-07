import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function PatientsAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
          Patients Analysis
        </h2>
        <p className="text-muted-foreground mt-1">
          Analyze patient dispute patterns and trends
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patient Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm" data-testid="text-coming-soon">
            Patients analysis features coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
