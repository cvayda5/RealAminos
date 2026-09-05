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

  const total = order.order_items.reduce((sum, i) => sum + i.unit_price * i.qty, 0);

  return (
    <tr>
      <td>
        <strong>{order.order_number}</strong>
      </td>
      <td>
        {order.order_items.map((i) => (
          <div key={i.id}>{i.product_name} ({i.size}) ×{i.qty}</div>
        ))}
      </td>
      <td>${total.toFixed(2)}</td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
        </select>
      </td>
      <td>
        <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1Z..." />
        <button className="btn-outline" style={{ marginTop: 6 }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
