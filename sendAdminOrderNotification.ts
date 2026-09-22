// Sends a quick "you've got an order" notification to the owner's personal
// inbox every time a real order is created — whether that's a Zelle order
// (created immediately at checkout, before payment actually lands) or a
// Card order (created once Whop confirms payment via webhook — see
// finalizeOrder() in src/app/api/webhooks/whop/route.ts). Deliberately
// never throws: a failed internal notification should never fail the
// actual order, the same principle as sendOrderConfirmation.ts.
//
// The address is hardcoded rather than an env var, since it's one specific
// person's personal inbox rather than site configuration — change the
// constant below if that address ever needs to change.
import { wrapEmailHtml, BRAND } from "./emailLayout";

const ADMIN_NOTIFICATION_EMAIL = "colton.vayda@gmail.com";

type AdminOrderNotificationInput = {
  orderNumber: string;
  paymentMethod: "card" | "zelle";
  // Only ever true for Zelle — a card order is only created once Whop has
  // already confirmed the payment, so by the time this fires it's always
  // effectively paid.
  awaitingPayment: boolean;
  items: { productName: string; size: string; qty: number }[];
  // What the customer actually owes/paid, all discounts and shipping
  // already folded in — the one number worth seeing at a glance.
  amountDue: number;
  shipping: { name: string; city: string; state: string };
};

export async function sendAdminOrderNotification(input: AdminOrderNotificationInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — skipping admin order notification.");
    return false;
  }

  const itemLines = input.items.map((i) => `${i.productName} (${i.size}) x${i.qty}`).join(", ");
  const paymentLine =
    input.paymentMethod === "zelle"
      ? `Zelle${input.awaitingPayment ? " (awaiting payment)" : ""}`
      : "Card";

  const text = `New order — #${input.orderNumber}

Payment method: ${paymentLine}
Amount due: $${input.amountDue.toFixed(2)}

Items: ${itemLines}

Ship to: ${input.shipping.name} — ${input.shipping.city}, ${input.shipping.state}

View it at https://shoprealaminos.com/admin/orders`;

  const bodyHtml = `
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${
      BRAND.orangeDark
    };">
      New Order
    </p>
    <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND.ink};">#${input.orderNumber}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:${BRAND.ink};margin-bottom:14px;">
      ${input.items
        .map(
          (i) =>
            `<tr><td style="padding:4px 0;">${i.productName} (${i.size}) × ${i.qty}</td></tr>`
        )
        .join("")}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:${BRAND.ink};">
      <tr>
        <td style="padding:4px 0;color:${BRAND.muted};">Payment method</td>
        <td style="padding:4px 0;text-align:right;font-weight:700;">${paymentLine}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:${BRAND.muted};">Amount due</td>
        <td style="padding:4px 0;text-align:right;font-weight:700;">$${input.amountDue.toFixed(2)}</td>
      </tr>
    </table>
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid ${BRAND.line};">
      <p style="font-size:13px;font-weight:700;color:${BRAND.ink};margin:0 0 4px;">Ship to</p>
      <p style="font-size:14px;color:${BRAND.muted};margin:0;">
        ${input.shipping.name} — ${input.shipping.city}, ${input.shipping.state}
      </p>
    </div>
    <a
      href="https://shoprealaminos.com/admin/orders"
      style="display:inline-block;margin-top:18px;background:${
        BRAND.orange
      };color:#ffffff;font-weight:700;font-size:13.5px;text-decoration:none;padding:10px 18px;border-radius:8px;"
    >
      View on /admin/orders
    </a>
  `;

  const html = wrapEmailHtml({
    preheader: `New order #${input.orderNumber} — $${input.amountDue.toFixed(2)}`,
    bodyHtml,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Sent from the same verified domain as every other transactional
        // email in this codebase — Resend requires the `from` address to
        // be on a domain you've verified, so this can't just be the
        // owner's personal Gmail address; the ADMIN_NOTIFICATION_EMAIL
        // constant above is only ever the `to`.
        from: "RealAminos <confirmation@shoprealaminos.com>",
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New Order — #${input.orderNumber} ($${input.amountDue.toFixed(2)})`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend admin order notification failed:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Resend admin order notification threw:", err);
    return false;
  }
}
