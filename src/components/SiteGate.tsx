"use client";

import { useEffect, useState } from "react";

// Remembered for the current browser session (sessionStorage) rather than
// forever (localStorage would survive closing the browser entirely). That's
// the middle ground: agreeing once covers the rest of that visit — clicking
// between pages, logging in and out, checking out — without needing to
// re-agree on every full page reload, but a genuinely new visit (a fresh
// tab tomorrow, or the browser restarted) shows it again, same as the
// original prototype intended this to be a real gate, not a one-time thing
// for the life of the browser.
const STORAGE_KEY = "realaminos_gate_accepted_v1";

export default function SiteGate() {
  // "ready" stays false for one tick while we check sessionStorage (which
  // only exists in the browser, not during server rendering) — this avoids
  // briefly flashing the gate on every load before we know it was already
  // accepted this session.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  function handleEnter() {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  if (!ready || dismissed) return null;

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="mark">ra</div>
        <h2>Restricted Research Access</h2>
        <p>
          <strong>RealAminos</strong> supplies peptide and small-molecule research compounds
          exclusively to qualified researchers, laboratories, and institutions for in-vitro
          laboratory research. These products are{" "}
          <strong>not drugs, foods, dietary supplements, or cosmetics</strong>, and are not
          approved by the FDA or any regulatory body for use in humans or animals.
        </p>
        <ul>
          <li>You are at least 21 years of age.</li>
          <li>
            You are purchasing solely for laboratory research purposes — not for personal,
            clinical, veterinary, cosmetic, or any other use.
          </li>
          <li>
            You understand these compounds have not been evaluated for safety or efficacy in
            humans or animals, and are not intended to diagnose, treat, cure, or prevent any
            disease.
          </li>
        </ul>
        <div className="gate-agree">
          <input type="checkbox" id="gateCheck" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <label htmlFor="gateCheck">
            I have read, understood, and agree to the{" "}
            <a href="/legal" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
              Research Use Only Terms &amp; Purchaser Agreement
            </a>
            , and I confirm the statements above are true.
          </label>
        </div>
        <div className="gate-actions">
          <button className="btn" disabled={!checked} onClick={handleEnter}>
            Enter Site
          </button>
          <button className="btn-outline" onClick={() => (window.location.href = "https://www.google.com")}>
            Leave Site
          </button>
        </div>
      </div>
    </div>
  );
}
