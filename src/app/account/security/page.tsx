"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: ask Supabase to generate a new TOTP factor (this is what
  // produces the QR code an authenticator app scans).
  async function startEnrollment() {
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) {
      setError(error.message);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  // Step 2: prove the enrollment worked by submitting one live code from
  // the app. Until this succeeds, the factor stays "unverified" and login
  // won't ask for it yet.
  async function confirmEnrollment(e: React.FormEvent) {
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
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setStatus("2FA enabled. You'll be asked for a code the next time you log in.");
    setQrCode(null);
  }

  return (
    <main className="site-main">
    <div className="wrap">
      <h1>Two-Factor Authentication</h1>
      <div className="card">
        {!qrCode && !status && (
          <>
            <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
              Add an authenticator app (Google Authenticator, Authy, 1Password, etc.) as a
              second login step.
            </p>
            <button className="btn" onClick={startEnrollment}>Set Up 2FA</button>
          </>
        )}

        {qrCode && (
          <>
            <p style={{ fontSize: 13.5 }}>Scan this in your authenticator app:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="2FA QR code" style={{ width: 200, height: 200 }} />
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Can&apos;t scan? Enter this key manually: <code>{secret}</code>
            </p>
            <form onSubmit={confirmEnrollment}>
              <label htmlFor="code">Enter the 6-digit code it shows</label>
              <input id="code" required value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn" type="submit">Confirm</button>
            </form>
          </>
        )}

        {status && <p style={{ color: "#047857", fontSize: 13.5 }}>{status}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
    </main>
  );
}
