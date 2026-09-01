"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CoaProduct {
  id: string;
  name: string;
  lot_number: string;
  coa_url: string;
  coa_preview_url: string | null;
  coa_purity_percent: number | null;
  coa_net_content_mg: number | null;
  coa_tested_at: string | null;
}

export default function CoaProductList() {
  const [products, setProducts] = useState<CoaProduct[] | null>(null);
  const [selected, setSelected] = useState<CoaProduct | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("id, name, lot_number, coa_url, coa_preview_url, coa_purity_percent, coa_net_content_mg, coa_tested_at")
      .not("coa_url", "is", null)
      .order("name")
      .then(({ data }) => setProducts((data as CoaProduct[]) ?? []));
  }, []);

  return (
    <div style={{ marginBottom: 60 }}>
      <div className="section-head">
        <div>
          <h2>Browse by Product</h2>
          <p>Every currently tested lot, listed by compound — click one to view its COA.</p>
        </div>
      </div>

      {products === null && <p style={{ color: "var(--muted)" }}>Loading products…</p>}

      {products !== null && products.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No published Certificates of Analysis yet.</p>
      )}

      {products !== null && products.length > 0 && (
        <div className="coa-product-grid">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`coa-product-item${selected?.id === p.id ? " active" : ""}`}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}
            >
              <span className="coa-product-name">{p.name}</span>
              <span className="coa-product-lot">Lot {p.lot_number}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="coa-detail">
          <button
            type="button"
            className="coa-detail-close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="coa-detail-layout">
            {selected.coa_preview_url && (
              <a href={selected.coa_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.coa_preview_url}
                  alt={`Certificate of Analysis for ${selected.name}, lot ${selected.lot_number}`}
                  className="coa-detail-img"
                />
              </a>
            )}
            <div>
              <h4 style={{ margin: "0 0 10px" }}>
                {selected.name} — Lot {selected.lot_number}
              </h4>
              <table className="spec-table">
                <tbody>
                  <tr>
                    <td>Identity</td>
                    <td>Confirmed (LC-MS)</td>
                  </tr>
                  <tr>
                    <td>Purity (HPLC-UV)</td>
                    <td>{selected.coa_purity_percent}%</td>
                  </tr>
                  {selected.coa_net_content_mg && (
                    <tr>
                      <td>Net Content</td>
                      <td>{selected.coa_net_content_mg} mg</td>
                    </tr>
                  )}
                  {selected.coa_tested_at && (
                    <tr>
                      <td>Tested</td>
                      <td>
                        {new Date(selected.coa_tested_at + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <a
                className="btn"
                href={selected.coa_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 14, textDecoration: "none" }}
              >
                View Certificate of Analysis (PDF)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
