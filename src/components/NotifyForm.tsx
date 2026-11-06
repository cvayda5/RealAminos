"use client";

import { useState } from "react";

// Email signup for the Coming Soon section. Posts to /api/coming-soon/notify.
export default function NotifyForm() {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/coming-soon/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website: trap }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setStatus("idle");
      setError(body.error ?? "Couldn't save that right now — please try again.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <p style={{ margin: "0 0 28px", fontWeight: 700, color: "var(--ok)" }}>
        ✓ You&apos;re on the list — we&apos;ll email you when these go live.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ margin: "0 0 28px", maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@lab.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: "1 1 240px", minWidth: 0 }}
        />
        {/* Honeypot — real visitors never see or fill this. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        <button type="submit" className="btn" disabled={status === "sending"}>
          {status === "sending" ? "Saving…" : "Notify me when live"}
        </button>
      </div>
      {error && (
        <p className="error" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        One email when these launch. Nothing else.
      </p>
    </form>
  );
}
