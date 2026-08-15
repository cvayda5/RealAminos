"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!submitted || cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [submitted, cooldown]);

  // Sends the actual reset email. Supabase's own rate limiting is the real
  // backstop against abuse; the visible cooldown timer just stops someone
  // from mashing the button and assuming it's broken when nothing changes.
  async function sendResetEmail() {
    setSending(true);
    setError(null);
    setResendMessage(null);

    const supabase = createClient();
    // redirectTo carries a "next" param through /auth/callback so it knows
    // to land on the "choose a new password" screen, not the normal
    // post-login page.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setSending(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (submitted) {
      setResendMessage("Reset email sent again — check your inbox (and spam folder).");
    }
    setSubmitted(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendResetEmail();
  }

  if (submitted) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Check your email</h1>
          <div className="card">
            <p style={{ fontSize: 14 }}>
              If an account exists for <strong>{email}</strong>, we sent a link to reset your
              password. Click it to choose a new one.
            </p>

            <button className="btn" onClick={sendResetEmail} disabled={sending || cooldown > 0}>
              {sending
                ? "Sending…"
                : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Resend Reset Email"}
            </button>

            {resendMessage && (
              <p style={{ color: "#047857", fontSize: 13, marginTop: 10 }}>{resendMessage}</p>
            )}
            {error && <p className="error">{error}</p>}

            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 16 }}>
              <Link href="/login">Back to Log In</Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="site-main">
      <div className="wrap">
        <h1>Reset your password</h1>
        <div className="card">
          <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
            Enter the email on your account and we&apos;ll send you a link to choose a new
            password.
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <button className="btn" type="submit" disabled={sending} style={{ marginTop: 14 }}>
              {sending ? "Sending…" : "Send Reset Link"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 16 }}>
            <Link href="/login">Back to Log In</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
