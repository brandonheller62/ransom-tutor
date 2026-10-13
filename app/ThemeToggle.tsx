"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Flips between light and dark and remembers the choice on this browser. Until
// the student clicks it, the theme follows the device (see themeScript in
// app/layout.tsx, which also applies the saved choice before first paint).
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    // The layout script can switch themes when the device setting changes.
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: the choice just lasts until reload */
    }
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="header-icon-btn" onClick={toggle} aria-label={label} title={label}>
      {/* Rendered after mount only: the server can't know the theme. */}
      <span aria-hidden="true">{theme === null ? "" : theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
