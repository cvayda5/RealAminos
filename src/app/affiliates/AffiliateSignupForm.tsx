"use client";

import { useState } from "react";

const MAX_CODE_LENGTH = 15;

export default function AffiliateSignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [email, setEmail] = useState("");
  const [preferredCode, setPreferredCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/affiliate-signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, instagramHandle, email, preferredCode }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong submitting your application.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="coa-search">
        <strong style={{ fontSize: 13 }}>You&apos;re In!</strong>
        <p style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
          Thanks{firstName ? `, ${firstName}` : ""} — we received your application and will reach
          out at <strong>{email}</strong> to get your code &quot;{preferredCode}&quot; set up.
        </p>
      </div>
    );
  }

  return (
    <form className="coa-search" onSubmit={handleSubmit}>
      <strong style={{ fontSize: 13 }}>Apply to Become an Affiliate</strong>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          required
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ width: "auto", flex: 1 }}
        />
        <input
          required
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ width: "auto", flex: 1 }}
        />
      </div>

      <input
        required
        placeholder="Instagram Handle (e.g. @yourname)"
        value={instagramHandle}
        onChange={(e) => setInstagramHandle(e.target.value)}
      />

      <input
        required
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        required
        placeholder="Preferred Discount Code"
        value={preferredCode}
        maxLength={MAX_CODE_LENGTH}
        onChange={(e) => setPreferredCode(e.target.value.toUpperCase())}
        style={{ marginBottom: 4 }}
      />
      <div style={{ fontSize: 11.5, color: "#9aa5b1", textAlign: "right", marginBottom: 10 }}>
        {preferredCode.length}/{MAX_CODE_LENGTH} characters
      </div>

      <button className="btn" type="submit" style={{ width: "100%", marginBottom: 0 }} disabled={saving}>
        {saving ? "Submitting…" : "Submit Application"}
      </button>
      {error && (
        <p className="error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </form>
  );
}
