import { ThemeContext, type ResolvedTheme, type ThemeMode } from "@/context/themeContextObject";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "vidpilot:theme";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    mode === "system" ? getSystemTheme() : mode
  );

  useEffect(() => {
    const next = mode === "system" ? getSystemTheme() : mode;
    setResolvedTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const next = getSystemTheme();
      setResolvedTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
