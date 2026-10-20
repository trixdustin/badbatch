"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const sync = (event: Event) => {
      const selected = (event as CustomEvent<"light" | "dark">).detail;
      setTheme(selected);
    };
    window.addEventListener("badbatch-theme", sync);

    const saved = window.localStorage.getItem("badbatch-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
      document.documentElement.style.colorScheme = saved;
      window.dispatchEvent(new CustomEvent("badbatch-theme", { detail: saved }));
    }
    return () => window.removeEventListener("badbatch-theme", sync);
  }, []);

  function selectTheme(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("badbatch-theme", next);
    window.dispatchEvent(new CustomEvent("badbatch-theme", { detail: next }));
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = nextTheme === "light" ? Sun : Moon;

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      className="theme-toggle"
      onClick={() => selectTheme(nextTheme)}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      <ThemeIcon aria-hidden="true" size={14} strokeWidth={1.8} />
    </button>
  );
}
