"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, OrderWithItems } from "@/types/database";

// Mirrors ShippingRate in src/lib/shipping/shippo.ts — kept as a separate,
// plain type here since that module is server-only (reads SHIPPO_API_KEY)
// and shouldn't be imported into a Client Component's bundle.
interface ShippingRateOption {
  objectId: string;
  amount: string;
  currency: string;
  provider: string;
  serviceLevelName: string;
  estimatedDays: number | null;
}

export default function OrderRow({ order }: { order: OrderWithItems }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Staff type this in lbs (matches how Shippo itself shows package weight)
  // — converted to ounces right at the API boundary below, since the
  // backend/DB (package_weight_oz, shippo.ts's mass_unit:"oz") stays in oz
  // either way. 0.25 lbs = 4oz, the same default this used before the
  // lbs/oz switch.
  const [weightLbs, setWeightLbs] = useState("0.25");
  const [rates, setRates] = useState<ShippingRateOption[] | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [gettingRates, setGettingRates] = useState(false);
  const [buyingLabel, setBuyingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  async function getRates() {
    setGettingRates(true);
    setLabelError(null);
    setRates(null);
    setSelectedRateId(null);
    const res = await fetch(`/api/admin/orders/${order.id}/shipping-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightOz: Number(weightLbs) * 16 }),
    });
    const body = await res.json().catch(() => ({}));
    setGettingRates(false);
    if (!res.ok) {
      setLabelError(body.error ?? "Couldn't get rates.");
      return;
    }
    setRates(body.rates);
    if (body.rates?.[0]) setSelectedRateId(body.rates[0].objectId);
  }

  async function buyLabel() {
    const rate = rates?.find((r) => r.objectId === selectedRateId);
    if (!rate) return;
    setBuyingLabel(true);
    setLabelError(null);
    const res = await fetch(`/api/admin/orders/${order.id}/buy-label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rateObjectId: rate.objectId,
        carrier: rate.provider,
        serviceLevelName: rate.serviceLevelName,
        weightOz: Number(weightLbs) * 16,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBuyingLabel(false);
    if (!res.ok) {
      setLabelError(body.error ?? "Couldn't buy this label.");
      return;
    }
    setRates(null);
    if (body.labelUrl) window.open(body.labelUrl, "_blank");
    router.refresh();
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, trackingNumber: tracking }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(body.error ?? "Couldn't delete this order.");
      return;
    }
    router.refresh();
  }

  async function markPaid() {
    setMarkingPaid(true);
    setMarkPaidError(null);
    const res = await fetch(`/api/admin/orders/${order.id}/mark-paid`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setMarkingPaid(false);
    if (!res.ok) {
      setMarkPaidError(body.error ?? "Couldn't mark this order paid.");
      return;
    }
    router.refresh();
  }

  const isZelle = order.payment_method === "zelle";
  const isAwaitingPayment = order.status === "Awaiting Payment";
  const grandTotal = (order.total ?? order.subtotal) + order.shipping_fee - (order.zelle_discount_amount ?? 0);
  const hasDiscount = !!order.discount_code && order.discount_percent > 0;

  return (
    <tr>
      <td>
        <strong>{order.order_number}</strong>
        {isZelle && (
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#c2540c", letterSpacing: ".03em", marginTop: 2 }}>
            ZELLE
          </div>
        )}
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
        {new Date(order.created_at).toLocaleDateString()}
      </td>
      <td>
        {order.order_items.map((i) => (
          <div key={i.id}>
            {i.product_name} ({i.size}) ×{i.qty}
          </div>
        ))}
      </td>
      <td style={{ fontSize: 12.5 }}>
        {order.shipping_name ? (
          <>
            <strong>{order.shipping_name}</strong>
            <br />
            {order.shipping_address_line1}
            {order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ""}
            <br />
            {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
            <br />
            {order.shipping_phone}
            <br />
            {order.shipping_email}
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>— no shipping info (pre-migration order) —</span>
        )}
      </td>
      <td>
        {hasDiscount && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "line-through" }}>
            ${order.subtotal.toFixed(2)}
          </div>
        )}
        <strong>${grandTotal.toFixed(2)}</strong>
        {hasDiscount && (
          <div style={{ fontSize: 11, color: "#059669" }}>
            {order.discount_code} (-{order.discount_percent}%)
          </div>
        )}
        {isZelle && order.zelle_discount_amount > 0 && (
          <div style={{ fontSize: 11, color: "#059669" }}>Zelle discount (-5%): -${order.zelle_discount_amount.toFixed(2)}</div>
        )}
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Shipping: {order.shipping_fee > 0 ? `$${order.shipping_fee.toFixed(2)}` : "Free"}
        </div>
        {order.points_redeemed > 0 && (
          <div style={{ fontSize: 11, color: "#059669" }}>Redeemed — {order.points_redeemed} pts</div>
        )}
        {isAwaitingPayment && (
          <div style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            Verify note says {order.order_number} before marking paid
          </div>
        )}
        {order.status === "Processing" && order.zelle_marked_paid_by === "customer" && (
          <div style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            Customer self-confirmed — verify Zelle before shipping
          </div>
        )}
      </td>
      <td>
        {isAwaitingPayment ? (
          <button className="admin-save" onClick={markPaid} disabled={markingPaid} style={{ width: "100%" }}>
            {markingPaid ? "Marking Paid…" : "Mark Paid & Fulfill"}
          </button>
        ) : (
          <select
            className="admin-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
          >
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        )}
        {markPaidError && <p className="error" style={{ fontSize: 11.5, marginTop: 4 }}>{markPaidError}</p>}
      </td>
      <td>
        {isAwaitingPayment ? (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>— awaiting payment —</span>
        ) : (
          <>
            {order.label_url && (
              <div className="label-bought">
                <div>
                  <strong>{order.shipping_carrier}</strong> {order.shipping_service}
                </div>
                <a href={order.label_url} target="_blank" rel="noreferrer">
                  View / print label →
                </a>
              </div>
            )}

            <div className="label-buy-widget">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  className="admin-track-input"
                  style={{ width: 56 }}
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                  placeholder="lbs"
                  title="Package weight, in pounds"
                />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>lbs</span>
                <button className="admin-save" onClick={getRates} disabled={gettingRates} style={{ marginTop: 0 }}>
                  {gettingRates ? "Getting Rates…" : order.label_url ? "Re-quote" : "Get Rates"}
                </button>
              </div>

              {rates && rates.length > 0 && (
                <div className="label-rate-list">
                  {rates.map((r) => (
                    <label key={r.objectId} className="label-rate-option">
                      <input
                        type="radio"
                        name={`rate-${order.id}`}
                        checked={selectedRateId === r.objectId}
                        onChange={() => setSelectedRateId(r.objectId)}
                      />
                      <span>
                        <strong>${parseFloat(r.amount).toFixed(2)}</strong> — {r.provider}{" "}
                        {r.serviceLevelName}
                        {r.estimatedDays ? ` (~${r.estimatedDays}d)` : ""}
                      </span>
                    </label>
                  ))}
                  <button
                    className="admin-save"
                    onClick={buyLabel}
                    disabled={buyingLabel || !selectedRateId}
                  >
                    {buyingLabel ? "Buying…" : "Buy Label"}
                  </button>
                </div>
              )}

              {rates && rates.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>
                  No rates came back — check the ship-from address is set up correctly.
                </p>
              )}

              {labelError && <p className="error" style={{ fontSize: 11, marginTop: 4 }}>{labelError}</p>}
            </div>

            <div style={{ marginTop: 8 }}>
              <input
                className="admin-track-input"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="1Z... (manual override)"
              />
              <button className="admin-save" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </td>
      <td>
        {!confirmingDelete ? (
          <button
            className="btn-outline"
            style={{ fontSize: 11.5, padding: "6px 10px", borderColor: "#b91c1c", color: "#b91c1c" }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 150 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c" }}>
              Delete {order.order_number}? Can&apos;t be undone — stock and any purchased label
              aren&apos;t reversed.
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="admin-save"
                style={{ background: "#b91c1c", marginTop: 0 }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                className="btn-outline"
                style={{ fontSize: 11.5, padding: "6px 10px" }}
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {deleteError && <p className="error" style={{ fontSize: 11, marginTop: 4 }}>{deleteError}</p>}
      </td>
    </tr>
  );
}
