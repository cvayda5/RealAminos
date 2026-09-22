// Sends the "your order has shipped" email via Resend's HTTP API — same
// pattern and sender domain as sendOrderConfirmation.ts. Deliberately never
// throws: a failed shipping-notice email should not fail the status update
// itself, since the order's already been saved as Shipped by the time this
// runs. Callers should log/ignore the boolean result.

import { wrapEmailHtml, orderNumberPill, BRAND } from "./emailLayout";

type OrderShippedInput = {
  toEmail: string;
  orderNumber: string;
  items: { productName: string; size: string; qty: number }[];
  trackingNumber?: string | null;
  shipping: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
  };
};

export async function sendOrderShippedEmail(input: OrderShippedInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY is not set — skipping order shipped email. See README's " +
        "'How order confirmation emails work' section."
    );
    return false;
  }

  const itemRowsText = input.items.map((i) => `  - ${i.productName} (${i.size}) x${i.qty}`).join("\n");
  const itemRowsHtml = input.items
    .map((i) => `<tr><td style="padding:6px 0;">${i.productName} (${i.size}) × ${i.qty}</td></tr>`)
    .join("");

  const addressText = `${input.shipping.name}\n${input.shipping.addressLine1}${
    input.shipping.addressLine2 ? ", " + input.shipping.addressLine2 : ""
  }\n${input.shipping.city}, ${input.shipping.state} ${input.shipping.zip}`;

  const hasTracking = !!input.trackingNumber && input.trackingNumber.trim().length > 0;
  const trackingLineText = hasTracking ? `\nTracking Number: ${input.trackingNumber}\n` : "";
  const trackingLineHtml = hasTracking
    ? `<p style="font-size:14px;margin:16px 0 4px;color:${BRAND.ink};"><strong>Tracking Number:</strong> ${input.trackingNumber}</p>`
    : "";

  const text = `Your order has shipped!

Order #${input.orderNumber}

What shipped:
${itemRowsText}
${trackingLineText}
Shipping to:
${addressText}

You can check your order status any time on the My Orders page.

Products are for laboratory research use only and are not for human or veterinary use.`;

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:999px;background:#fff7ed;color:${
        BRAND.orangeDark
      };font-size:20px;margin-bottom:14px;">&#128230;</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:${BRAND.ink};">Your order has shipped!</h1>
      <div>${orderNumberPill(input.orderNumber)}</div>
    </div>
    <p style="font-size:13px;font-weight:700;color:${BRAND.ink};margin:0 0 8px;">What shipped</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:${BRAND.ink};margin-bottom:4px;">
      ${itemRowsHtml}
    </table>
    ${trackingLineHtml}
    <div style="margin-top:22px;padding-top:20px;border-top:1px solid ${BRAND.line};">
      <p style="font-size:13px;font-weight:700;color:${BRAND.ink};margin:0 0 6px;">Shipping to</p>
      <p style="font-size:14px;color:${BRAND.muted};margin:0;white-space:pre-line;line-height:1.5;">${addressText}</p>
    </div>
    <p style="font-size:13px;color:${BRAND.muted};margin:22px 0 0;line-height:1.6;">
      You can check your order status any time on the My Orders page.
    </p>
  `;

  const html = wrapEmailHtml({
    preheader: `Order #${input.orderNumber} has shipped${hasTracking ? " — tracking included" : ""}`,
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
        from: "RealAminos <confirmation@shoprealaminos.com>",
        to: input.toEmail,
        subject: `Your Order Has Shipped — #${input.orderNumber}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend order shipped email failed:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Resend order shipped email threw:", err);
    return false;
  }
}
