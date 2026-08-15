"use client";

import { useState } from "react";

// This is a mock lookup — there's no real Certificate of Analysis table or
// testing-lab data feed wired up yet. Kept honest about that in the result,
// same as the design prototype. A real version would query a `coa_results`
// table (or an external lab's API) by lot number.
export default function CoaLookup() {
  const [lot, setLot] = useState("");
  const [result, setResult] = useState<string | null>(null);

  function handleSearch() {
    if (!lot.trim()) {
      setResult("Enter a lot number to search.");
      return;
    }
    setResult(
      `Lot ${lot.trim()}: Sample result — Identity Confirmed, Purity 99.2%, Endotoxin Pass. (Demo data — connect to a real COA database before launch.)`
    );
  }

  return (
    <div className="coa-search">
      <strong style={{ fontSize: 13, color: "white" }}>Look Up a Certificate of Analysis</strong>
      <input
        type="text"
        placeholder="Enter Lot Number (e.g. RA-24081)"
        value={lot}
        onChange={(e) => setLot(e.target.value)}
      />
      <button className="btn" style={{ width: "100%" }} onClick={handleSearch}>
        Search
      </button>
      {result && <div className="coa-result">{result}</div>}
    </div>
  );
}
