"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

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
    } else {
      setMessage("Check your email for a confirmation link, then log in.");
    }
  }

  return (
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
          {message && <p style={{ color: "#047857", fontSize: 13, marginTop: 10 }}>{message}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
