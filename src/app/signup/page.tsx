"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Once signUp() succeeds we swap the form out for a "check your email"
  // screen with a resend option, rather than showing both at once.
  const [submitted, setSubmitted] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Ticks the cooldown down to 0 once a second while it's running. Supabase
  // itself also rate-limits this endpoint, but a visible countdown is what
  // stops someone from mashing the button and wondering why nothing happens.
  useEffect(() => {
    if (!submitted || cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [submitted, cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    // This is what actually creates the row in Supabase's internal
    // auth.users table; our public.profiles row is created automatically
    // by the on_auth_user_created trigger in the SQL migration.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSubmitted(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setResending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setResendMessage("Confirmation email resent — check your inbox (and spam folder).");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  if (submitted) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Check your email</h1>
          <div className="card">
            <p style={{ fontSize: 14 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it, then come back
              and log in.
            </p>

            <button className="btn" onClick={handleResend} disabled={resending || cooldown > 0}>
              {resending
                ? "Resending…"
                : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Resend Confirmation Email"}
            </button>

            {resendMessage && (
              <p style={{ color: "#047857", fontSize: 13, marginTop: 10 }}>{resendMessage}</p>
            )}
            {error && <p className="error">{error}</p>}

            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 16 }}>
              Wrong email address?{" "}
              <button
                className="link-btn"
                style={{ fontSize: 12.5 }}
                onClick={() => {
                  setSubmitted(false);
                  setResendMessage(null);
                  setError(null);
                }}
              >
                Start over
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="site-main">
      <div className="wrap">
        <h1>Create an account</h1>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="btn" type="submit">Sign Up</button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}
