import { cn } from "@/utils/cn";
import { Loader2 } from "lucide-react";

function SkeletonBase({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-elevated", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBase key={index} className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <SkeletonBase className="mb-4 h-4 w-1/3" />
      <SkeletonBase className="h-8 w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonBase key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-secondary">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ButtonLoader({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />;
}
