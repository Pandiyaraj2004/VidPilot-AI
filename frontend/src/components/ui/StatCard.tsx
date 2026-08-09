import { Card, CardContent } from "@/components/ui/Card";
import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
          {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-surface-elevated p-2">
            <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
