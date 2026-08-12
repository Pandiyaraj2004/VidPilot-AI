import { cn } from "@/utils/cn";
import type { InputHTMLAttributes } from "react";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

export function Slider({ value, onValueChange, min, max, step = 0.05, className, ...props }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      {...props}
    />
  );
}
