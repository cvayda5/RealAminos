"use client";

import { useEffect, useState } from "react";

type ViewMode = "auto" | "mobile" | "desktop";
const STORAGE_KEY = "ra-view-mode";

// Footer widget that lets anyone force the site into its phone layout (or
// back to its desktop layout) regardless of how wide the actual browser
// window is — the same idea as the "Switch to Mobile Site" / "Switch to
// Desktop Site" links older websites used to have. The actual layout
// switch happens purely in CSS (see the html.force-mobile /
// html:not(.force-desktop) rules in globals.css); this component's only
// job is flipping the class on <html> and remembering the choice.
//
// The choice is read back on every future page load by a small inline
// script in layout.tsx's <head> (not by this component, which only runs
// after hydration) — that's what avoids a flash of the wrong layout while
// this component is still loading in.
export default function ViewModeToggle() {
  const [mode, setMode] = useState<ViewMode>("auto");
  // Only used to decide which button LOOKS active while mode is still
  // "auto" (nothing forced yet) — a phone visitor who's never touched this
  // toggle should see "iPhone" highlighted (since that's genuinely what
  // they're seeing), not "Computer" by default.
  const [naturallyNarrow, setNaturallyNarrow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mobile" || stored === "desktop") {
      setMode(stored);
    } else {
      setNaturallyNarrow(window.matchMedia("(max-width: 980px)").matches);
    }
  }, []);

  function apply(next: ViewMode) {
    setMode(next);
    document.documentElement.classList.remove("force-mobile", "force-desktop");
    if (next === "mobile") document.documentElement.classList.add("force-mobile");
    if (next === "desktop") document.documentElement.classList.add("force-desktop");

    if (next === "auto") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  const showingMobile = mode === "mobile" || (mode === "auto" && naturallyNarrow);

  return (
    <div className="view-toggle">
      <span className="view-toggle-label">Viewing this site as:</span>
      <div className="view-toggle-btns">
        <button
          type="button"
          className={`view-toggle-btn ${!showingMobile ? "active" : ""}`}
          onClick={() => apply("desktop")}
        >
          💻 Computer
        </button>
        <button
          type="button"
          className={`view-toggle-btn ${showingMobile ? "active" : ""}`}
          onClick={() => apply("mobile")}
        >
          📱 iPhone
        </button>
      </div>
    </div>
  );
}
