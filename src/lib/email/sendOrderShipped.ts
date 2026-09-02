// Sends the "your order has shipped" email via Resend's HTTP API — same
// pattern and sender domain as sendOrderConfirmation.ts. Deliberately never
// throws: a failed shipping-notice email should not fail the status update
// itself, since the order's already been saved as Shipped by the time this
// runs. Callers should log/ignore the boolean result.

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
    ? `<p style="font-size:14px;margin:16px 0 4px;"><strong>Tracking Number:</strong> ${input.trackingNumber}</p>`
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

  const html = `
    <div style="font-family:sans-serif;color:#111827;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">Your order has shipped!</h2>
      <p style="color:#6b7280;font-size:14px;margin-top:0;">Order #${input.orderNumber}</p>
      <p style="font-size:14px;margin:18px 0 4px;"><strong>What shipped:</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${itemRowsHtml}
      </table>
      ${trackingLineHtml}
      <p style="font-size:14px;margin-top:22px;margin-bottom:4px;"><strong>Shipping to:</strong></p>
      <p style="font-size:14px;margin-top:0;white-space:pre-line;">${addressText}</p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px;">
        You can check your order status any time on the My Orders page. Products are for
        laboratory research use only and are not for human or veterinary use.
      </p>
    </div>
  `;

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
