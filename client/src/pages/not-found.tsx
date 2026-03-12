import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-404-title">Page Not Found</h1>
            <p className="text-sm text-muted-foreground">
              The page you're looking for doesn't exist or you don't have permission to view it.
            </p>
          </div>
          <Button variant="outline" className="mt-2" data-testid="button-go-home" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
