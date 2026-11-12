"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  enabled: boolean;
  intervalHours: number;
  sendHour: number;
  hasOpenCampaign: boolean;
  addressSet: boolean;
  templates: { key: string; subject: string }[];
}

export default function EmailMarketingControls(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [intervalHours, setIntervalHours] = useState(String(p.intervalHours));
  const [sendHour, setSendHour] = useState(String(p.sendHour));
  const [testIndex, setTestIndex] = useState("0");

  async function call(payload: Record<string, unknown>, okText: (j: Record<string, unknown>) => string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: j.error ?? "Something went wrong.", error: true });
      } else {
        setMessage({ text: okText(j), error: false });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error — try again.", error: true });
    }
    setBusy(false);
  }

  const box: React.CSSProperties = {
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  };
  const label: React.CSSProperties = { display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 };
  const input: React.CSSProperties = { width: 90 };

  return (
    <div>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong style={{ fontSize: 15 }}>Sending is {p.enabled ? "ON" : "OFF"}</strong>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
              {p.enabled
                ? "The next email goes out automatically when it's due."
                : "Nothing will be sent until you turn this on."}
            </div>
          </div>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              call({ action: "settings", enabled: !p.enabled }, () => (p.enabled ? "Sending turned off." : "Sending turned on."))
            }
          >
            {p.enabled ? "Turn off" : "Turn on"}
          </button>
        </div>
        {!p.addressSet && (
          <p className="error" style={{ marginTop: 10 }}>
            MARKETING_POSTAL_ADDRESS isn&apos;t set in Vercel yet. Every marketing email must show your mailing address, so
            sending can&apos;t be turned on until you add it.
          </p>
        )}
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={label}>Hours between emails (48 = every 2 days)</label>
            <input style={input} type="number" min={1} max={720} value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} />
          </div>
          <div>
            <label style={label}>Earliest send hour (Arizona time, 0–20)</label>
            <input style={input} type="number" min={0} max={20} value={sendHour} onChange={(e) => setSendHour(e.target.value)} />
          </div>
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() =>
              call(
                { action: "settings", intervalHours: Number(intervalHours), sendHour: Number(sendHour) },
                () => "Schedule saved."
              )
            }
          >
            Save schedule
          </button>
        </div>
      </div>

      <div style={box}>
        <label style={label}>Send yourself a test of any email</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={testIndex} onChange={(e) => setTestIndex(e.target.value)} style={{ maxWidth: 420 }}>
            {p.templates.map((t, i) => (
              <option key={t.key} value={i}>
                {i + 1}. {t.subject}
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() => call({ action: "test", templateIndex: Number(testIndex) }, (j) => `Test sent to ${String(j.sentTo)}.`)}
          >
            Send test to me
          </button>
        </div>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ color: "var(--muted)", fontSize: 13.5, maxWidth: 520 }}>
            Don&apos;t want to wait for the schedule? Start the next email in the rotation now. It goes to everyone on the
            list within about 10 minutes.
          </div>
          <button
            className="btn btn-outline"
            disabled={busy || !p.enabled || p.hasOpenCampaign}
            onClick={() =>
              call({ action: "start-now" }, (j) => `Started: ${String(j.template)}. It will begin sending shortly.`)
            }
          >
            Send next email now
          </button>
        </div>
      </div>

      {message && (
        <p className={message.error ? "error" : undefined} style={message.error ? undefined : { color: "var(--ok)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
