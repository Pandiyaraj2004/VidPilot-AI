import { ThemeContext, type ThemeMode } from "@/context/themeContextObject";
import { useContext } from "react";

export type { ThemeMode };

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
