"use client";

import { useEffect, useState } from "react";

// Fixed as a UTC instant rather than a local Date string — Arizona (MST)
// never observes daylight saving, so 10:00 AM MST is always exactly
// 17:00 UTC. Anchoring here means every visitor sees the same correct
// countdown regardless of their own browser's timezone.
const LAUNCH_AT = new Date("2026-09-22T17:00:00Z").getTime();

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function getRemaining(): Remaining {
  const diff = LAUNCH_AT - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

// Rendered only after mount (starts as null) rather than computed during
// the initial render — computing it eagerly would run once on the server
// at build/request time and again on the client a moment later, and those
// two clocks are never exactly in sync, which trips React's hydration
// mismatch warning over something as harmless as a one-second drift.
export default function LaunchCountdown() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(getRemaining());
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!remaining) {
    // Reserves the same height as the real banner so the page doesn't
    // jump once the client-side timer kicks in a moment after paint.
    return <div className="launch-countdown" aria-hidden="true" style={{ visibility: "hidden" }} />;
  }

  if (remaining.done) {
    return (
      <div className="launch-countdown launch-countdown-live">
        <span className="launch-countdown-live-text">
          🎉 We&rsquo;re live! Use code <strong>BETA20</strong> for 20% off site wide.
        </span>
        <a href="/shop" className="launch-countdown-cta">
          Shop Now →
        </a>
      </div>
    );
  }

  const units: { label: string; value: number }[] = [
    { label: "Days", value: remaining.days },
    { label: "Hours", value: remaining.hours },
    { label: "Min", value: remaining.minutes },
    { label: "Sec", value: remaining.seconds },
  ];

  return (
    <div className="launch-countdown">
      <span className="launch-countdown-label">
        Launching Sept 22 at 10AM MST &mdash; code <strong>BETA20</strong> for 20% off
      </span>
      <div className="launch-countdown-units">
        {units.map((u) => (
          <div className="launch-countdown-unit" key={u.label}>
            <span className="launch-countdown-num">{String(u.value).padStart(2, "0")}</span>
            <span className="launch-countdown-unit-label">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
