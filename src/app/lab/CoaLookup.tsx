"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CoaMatch {
  name: string;
  lot_number: string;
  coa_url: string;
  coa_purity_percent: number | null;
  coa_net_content_mg: number | null;
  coa_tested_at: string | null;
}

type Status = "idle" | "loading" | "found" | "not-found" | "error";

export default function CoaLookup() {
  const [lot, setLot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [match, setMatch] = useState<CoaMatch | null>(null);

  async function handleSearch() {
    const query = lot.trim();
    if (!query) {
      setStatus("idle");
      setMatch(null);
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("name, lot_number, coa_url, coa_purity_percent, coa_net_content_mg, coa_tested_at")
      .ilike("lot_number", query)
      .maybeSingle<CoaMatch>();

    if (error) {
      setStatus("error");
      return;
    }
    if (!data || !data.coa_url) {
      setStatus("not-found");
      setMatch(null);
      return;
    }
    setMatch(data);
    setStatus("found");
  }

  return (
    <div className="coa-search">
      <strong style={{ fontSize: 13, color: "white" }}>Look Up a Certificate of Analysis</strong>
      <input
        type="text"
        placeholder="Enter Lot Number (e.g. RA-26001)"
        value={lot}
        onChange={(e) => setLot(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
      />
      <button className="btn" style={{ width: "100%" }} onClick={handleSearch}>
        Search
      </button>

      {status === "loading" && <div className="coa-result">Searching…</div>}

      {status === "not-found" && (
        <div className="coa-result">
          No record found for lot &quot;{lot.trim()}&quot;. Double-check the lot number printed
          on your vial label, or contact support if you believe this is an error.
        </div>
      )}

      {status === "error" && (
        <div className="coa-result">Something went wrong looking that up — please try again.</div>
      )}

      {status === "found" && match && (
        <div className="coa-result" style={{ color: "white" }}>
          <strong>
            Lot {match.lot_number} — {match.name}
          </strong>
          <div style={{ marginTop: 6, color: "#cbd5e1" }}>
            Identity Confirmed · Purity {match.coa_purity_percent}%
            {match.coa_net_content_mg ? ` · Net Content ${match.coa_net_content_mg} mg` : ""}
            {match.coa_tested_at
              ? ` · Tested ${new Date(match.coa_tested_at + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "long", day: "numeric" }
                )}`
              : ""}
          </div>
          <a
            className="btn"
            href={match.coa_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 10,
              textDecoration: "none",
              fontSize: 12.5,
            }}
          >
            View Certificate of Analysis (PDF)
          </a>
        </div>
      )}
    </div>
  );
}
