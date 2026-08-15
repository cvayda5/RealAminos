"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  // By the time this page loads, /auth/callback has already exchanged the
  // link's one-time code for a real session — so we just need to confirm
  // that actually happened (an expired or already-used link would land
  // here with no session at all) before showing the form.
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (checking) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Reset your password</h1>
          <div className="card">
            <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Checking your reset link…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Reset your password</h1>
          <div className="card">
            <p style={{ fontSize: 14 }}>
              This reset link is invalid or has expired — links only work once and go stale
              after a while.
            </p>
            <Link href="/forgot-password" className="btn" style={{ display: "inline-flex", marginTop: 10 }}>
              Request a New Link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Password updated</h1>
          <div className="card">
            <p style={{ fontSize: 14, marginBottom: 14 }}>
              Your password has been changed. You&apos;re already signed in with the new one.
            </p>
            <a href="/account/orders" className="btn" style={{ display: "inline-flex" }}>
              Go to My Orders
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="site-main">
      <div className="wrap">
        <h1>Choose a new password</h1>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button className="btn" type="submit" disabled={saving} style={{ marginTop: 14 }}>
              {saving ? "Saving…" : "Update Password"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}
