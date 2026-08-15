"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, OrderWithItems } from "@/types/database";

export default function OrderRow({ order }: { order: OrderWithItems }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [saving, setSaving] = useState(false);

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

  const grandTotal = (order.total ?? order.subtotal) + order.shipping_fee;
  const hasDiscount = !!order.discount_code && order.discount_percent > 0;

  return (
    <tr>
      <td>
        <strong>{order.order_number}</strong>
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
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Shipping: {order.shipping_fee > 0 ? `$${order.shipping_fee.toFixed(2)}` : "Free"}
        </div>
        {order.points_redeemed > 0 && (
          <div style={{ fontSize: 11, color: "#059669" }}>Redeemed — {order.points_redeemed} pts</div>
        )}
      </td>
      <td>
        <select
          className="admin-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus)}
        >
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
        </select>
      </td>
      <td>
        <input
          className="admin-track-input"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="1Z..."
        />
        <button className="admin-save" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
