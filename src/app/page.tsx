export default function Home() {
  return (
    <div className="wrap">
      <h1>realaminos backend starter</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        This is a minimal but real backend: Supabase Postgres for storage, Supabase Auth
        for login + 2FA, and Next.js route handlers for the orders API. It&apos;s meant
        to be read, run locally, and extended — not a finished product.
      </p>
      <div className="card">
        <strong>Try it in this order:</strong>
        <ol style={{ lineHeight: 1.8, fontSize: 14 }}>
          <li>Follow README.md to connect a free Supabase project and run the migration.</li>
          <li>Sign up for an account.</li>
          <li>Visit Security / 2FA and enroll an authenticator app.</li>
          <li>Use &quot;My Orders&quot; to place a test order (no payment yet — see README).</li>
          <li>
            Promote yourself to admin (one SQL command, in README), then check the
            Admin page to update its status and tracking number.
          </li>
        </ol>
      </div>
    </div>
  );
}
