"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const destination = searchParams.get("next") || "/account/orders";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Step 2 (only for accounts that enrolled an authenticator app on the
  // Security page — most accounts skip straight from password to the email
  // code below).
  const [needsMfaCode, setNeedsMfaCode] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  // Step 3: every account, every login, gets emailed a one-time code before
  // it's actually let in — this is the new "email 2FA."
  const [needsEmailCode, setNeedsEmailCode] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!needsEmailCode || cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [needsEmailCode, cooldown]);

  // Sends the actual login code to the account's email. Supabase's own OTP
  // system generates and emails this — nothing here handles the sending
  // itself, which means it inherits Supabase's own expiry and one-time-use
  // rules instead of us having to build and secure that ourselves.
  async function sendEmailCode() {
    setSendingEmailCode(true);
    setError(null);
    setResendMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setSendingEmailCode(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (needsEmailCode) {
      setResendMessage("New code sent — check your inbox (and spam folder).");
    }
    setNeedsEmailCode(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Check whether this account also has an authenticator app enrolled —
    // if so, that step comes first, before the emailed code.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
        setNeedsMfaCode(true);
        return;
      }
    }

    await sendEmailCode();
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!factorId) return;

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: mfaCode,
    });
    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setNeedsMfaCode(false);
    await sendEmailCode();
  }

  async function handleEmailCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: emailCode, type: "email" });
    if (error) {
      setError(error.message);
      return;
    }

    // Full page load on purpose — see the note further down for why.
    window.location.href = destination;
  }

  if (needsEmailCode) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Enter your login code</h1>
          <div className="card">
            <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
              We emailed a 6-digit code to <strong>{email}</strong>. Enter it below to finish
              logging in.
            </p>
            <form onSubmit={handleEmailCodeSubmit}>
              <label htmlFor="emailCode">6-digit code from your email</label>
              <input
                id="emailCode"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
              />
              <button className="btn" type="submit" style={{ marginTop: 14 }}>Verify</button>
              {error && <p className="error">{error}</p>}
            </form>

            <button
              className="link-btn"
              style={{ marginTop: 14 }}
              onClick={sendEmailCode}
              disabled={sendingEmailCode || cooldown > 0}
            >
              {sendingEmailCode
                ? "Resending…"
                : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Resend code"}
            </button>
            {resendMessage && (
              <p style={{ color: "#047857", fontSize: 13, marginTop: 8 }}>{resendMessage}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (needsMfaCode) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Enter your 2FA code</h1>
          <div className="card">
            <form onSubmit={handleMfaSubmit}>
              <label htmlFor="mfaCode">6-digit code from your authenticator app</label>
              <input id="mfaCode" required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
              <button className="btn" type="submit">Verify</button>
              {error && <p className="error">{error}</p>}
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="site-main">
      <div className="wrap">
        <h1>Log in</h1>
        <div className="card">
          <form onSubmit={handlePasswordSubmit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ textAlign: "right", marginTop: 6 }}>
              <Link href="/forgot-password" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Forgot password?
              </Link>
            </div>

            <button className="btn" type="submit" style={{ marginTop: 14 }}>Log In</button>
            {error && <p className="error">{error}</p>}
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              After your password, we&apos;ll email you a one-time code to finish logging in. For
              your security, you&apos;ll be automatically logged out after 8 hours and will need
              to sign in again.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

// A full page load (window.location.href, not router.push) is used for the
// final redirect on purpose. The header lives in a shared layout that
// Next.js's client-side navigation deliberately reuses instead of
// re-rendering — great for speed, but it means a client-side navigation
// right after login can still show the logged-out header. A full page load
// forces the browser to make a brand new request to the server, which
// re-runs everything (middleware, layout, header) from scratch with the new
// session cookie already in place — no race, no stale cache.
