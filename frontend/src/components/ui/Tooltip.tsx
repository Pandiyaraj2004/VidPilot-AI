import { useId, type ReactNode } from "react";

export interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();

  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id} tabIndex={0} className="inline-flex focus:outline-none">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2.5 py-1 text-xs text-text-primary opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
