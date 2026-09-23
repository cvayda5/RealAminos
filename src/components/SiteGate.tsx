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

// Four separate, individually-required statements instead of one combined
// checkbox — each is its own row so a researcher has to actually engage
// with every claim being made (age, research-only use, who they're buying
// for, and the legal terms) rather than one general "I agree to
// everything" checkbox that's easy to click without reading any of it.
interface GateChecks {
  age: boolean;
  researchOnly: boolean;
  businessPurpose: boolean;
  terms: boolean;
}

const EMPTY_CHECKS: GateChecks = {
  age: false,
  researchOnly: false,
  businessPurpose: false,
  terms: false,
};

export default function SiteGate() {
  // "ready" stays false for one tick while we check sessionStorage (which
  // only exists in the browser, not during server rendering) — this avoids
  // briefly flashing the gate on every load before we know it was already
  // accepted this session.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checks, setChecks] = useState<GateChecks>(EMPTY_CHECKS);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  function toggle(key: keyof GateChecks) {
    setChecks((c) => ({ ...c, [key]: !c[key] }));
  }

  function handleEnter() {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  if (!ready || dismissed) return null;

  const allChecked = checks.age && checks.researchOnly && checks.businessPurpose && checks.terms;

  return (
    <div className="gate">
      <div className="gate-wordmark">
        real<span>aminos</span>
      </div>

      <div className="gate-card">
        <div className="gate-eyebrow">RealAminos</div>
        <h2>Research-grade peptide supplier</h2>
        <p>
          Materials on this site are for laboratory research use only — not for human,
          therapeutic, or consumer use. Please confirm each statement to continue.
        </p>

        <div className="gate-check-list">
          <label className={`gate-check-item ${checks.age ? "is-checked" : ""}`}>
            <input type="checkbox" checked={checks.age} onChange={() => toggle("age")} />
            <span>
              I am <strong>21 years of age or older</strong>
            </span>
          </label>

          <label className={`gate-check-item ${checks.researchOnly ? "is-checked" : ""}`}>
            <input type="checkbox" checked={checks.researchOnly} onChange={() => toggle("researchOnly")} />
            <span>
              I am accessing this site for <strong>laboratory research purposes only</strong> —
              not for human use
            </span>
          </label>

          <label className={`gate-check-item ${checks.businessPurpose ? "is-checked" : ""}`}>
            <input
              type="checkbox"
              checked={checks.businessPurpose}
              onChange={() => toggle("businessPurpose")}
            />
            <span>
              I am acting for a <strong>business, laboratory, or institutional research
              purpose</strong>
            </span>
          </label>

          <label className={`gate-check-item ${checks.terms ? "is-checked" : ""}`}>
            <input type="checkbox" checked={checks.terms} onChange={() => toggle("terms")} />
            <span>
              I agree to the <a href="/legal">RUO Purchaser Agreement</a>
            </span>
          </label>
        </div>

        <button className="btn gate-enter" disabled={!allChecked} onClick={handleEnter}>
          Enter
        </button>

        <p className="gate-disclaimer">
          By selecting Enter you confirm the statements above are true and agree to the RUO
          Purchaser Agreement. Materials are not for human or animal use, not for use in
          diagnostic or therapeutic procedures, and have not been evaluated by the U.S. Food and
          Drug Administration.
        </p>
      </div>

      <button className="gate-leave" onClick={() => (window.location.href = "https://www.google.com")}>
        Not here for research? <span>Leave</span>
      </button>
    </div>
  );
}
