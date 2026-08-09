import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart3 } from "lucide-react";

export function ChartPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
          <BarChart3 className="h-6 w-6 text-text-muted" aria-hidden="true" />
          <p className="max-w-xs text-sm text-text-secondary">Analytics will appear after YouTube is connected.</p>
        </div>
      </CardContent>
    </Card>
  );
}
