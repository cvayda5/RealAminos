"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // If the account has 2FA enrolled, Supabase requires a second step after
  // the password check succeeds (Assurance Level goes from aal1 to aal2).
  const [needsMfaCode, setNeedsMfaCode] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Check whether this session still needs a second factor before it's
    // fully trusted.
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

    router.push("/account/orders");
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

    router.push("/account/orders");
  }

  if (needsMfaCode) {
    return (
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
    );
  }

  return (
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

          <button className="btn" type="submit">Log In</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
