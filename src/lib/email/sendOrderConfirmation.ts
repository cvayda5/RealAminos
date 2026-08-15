// Sends the "your order is confirmed" email via Resend's HTTP API directly
// (not through Supabase Auth's email system — that's only for login/signup/
// password-reset emails). This reuses the same Resend account already set
// up for SMTP (see README's "How order confirmation emails work"), so no
// new account or domain verification is needed — same API key, different
// use.
//
// Deliberately never throws: a failed confirmation email should not fail
// the order itself, since the order is already written to the database by
// the time this runs. Callers should log/ignore the boolean result.

type OrderConfirmationInput = {
  toEmail: string;
  orderNumber: string;
  items: { productName: string; size: string; qty: number; unitPrice: number }[];
  subtotal: number;
  discountCode?: string | null;
  discountPercent?: number;
  total: number;
  // Flat shipping charge, already computed server-side (0 if the order
  // hit the free-shipping threshold) — added on top of `total` for the
  // grand total shown here, same as everywhere else this order appears.
  shippingFee: number;
  shipping: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
  };
};

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY is not set — skipping order confirmation email. See README's " +
        "'How order confirmation emails work' section."
    );
    return false;
  }

  const itemRowsText = input.items
    .map((i) => `  - ${i.productName} (${i.size}) x${i.qty} — $${(i.unitPrice * i.qty).toFixed(2)}`)
    .join("\n");

  const itemRowsHtml = input.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.productName} (${i.size}) × ${i.qty}</td><td style="padding:6px 0;text-align:right;">$${(
          i.unitPrice * i.qty
        ).toFixed(2)}</td></tr>`
    )
    .join("");

  const addressText = `${input.shipping.name}\n${input.shipping.addressLine1}${
    input.shipping.addressLine2 ? ", " + input.shipping.addressLine2 : ""
  }\n${input.shipping.city}, ${input.shipping.state} ${input.shipping.zip}`;

  const hasDiscount = !!input.discountCode && !!input.discountPercent;
  const discountLineText = hasDiscount
    ? `Discount (${input.discountCode}, -${input.discountPercent}%): -$${(input.subtotal - input.total).toFixed(2)}\n`
    : "";
  const discountLineHtml = hasDiscount
    ? `<tr><td style="padding:6px 0;color:#059669;">Discount (${input.discountCode}, -${
        input.discountPercent
      }%)</td><td style="padding:6px 0;text-align:right;color:#059669;">-$${(input.subtotal - input.total).toFixed(
        2
      )}</td></tr>`
    : "";

  const grandTotal = input.total + input.shippingFee;
  const shippingLineText = `Shipping: ${input.shippingFee > 0 ? "$" + input.shippingFee.toFixed(2) : "FREE"}\n`;
  const shippingLineHtml = `<tr><td style="padding-top:6px;">Shipping</td><td style="padding-top:6px;text-align:right;">${
    input.shippingFee > 0 ? "$" + input.shippingFee.toFixed(2) : "FREE"
  }</td></tr>`;

  const text = `Your order is confirmed!

Order #${input.orderNumber}

${itemRowsText}

Subtotal: $${input.subtotal.toFixed(2)}
${discountLineText}${shippingLineText}Total: $${grandTotal.toFixed(2)}

Shipping to:
${addressText}

You can check your order status any time on the My Orders page.

This confirms your order was received — no payment has been charged yet, since payment processing isn't connected yet. Products are for laboratory research use only and are not for human or veterinary use.`;

  const html = `
    <div style="font-family:sans-serif;color:#111827;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">Your order is confirmed!</h2>
      <p style="color:#6b7280;font-size:14px;margin-top:0;">Order #${input.orderNumber}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${itemRowsHtml}
        <tr><td style="padding-top:10px;">Subtotal</td>
            <td style="padding-top:10px;text-align:right;">$${input.subtotal.toFixed(2)}</td></tr>
        ${discountLineHtml}
        ${shippingLineHtml}
        <tr><td style="padding-top:6px;font-weight:700;border-top:1px solid #e5e7eb;">Total</td>
            <td style="padding-top:6px;font-weight:700;border-top:1px solid #e5e7eb;text-align:right;">$${grandTotal.toFixed(
              2
            )}</td></tr>
      </table>
      <p style="font-size:14px;margin-top:22px;margin-bottom:4px;"><strong>Shipping to:</strong></p>
      <p style="font-size:14px;margin-top:0;white-space:pre-line;">${addressText}</p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px;">
        You can check your order status any time on the My Orders page. This confirms your order
        was received — no payment has been charged yet, since payment processing isn't connected
        yet. Products are for laboratory research use only and are not for human or veterinary use.
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
        // resend.dev is Resend's built-in test sender — no domain
        // verification needed, same one already used for the SMTP login
        // codes. Swap this to a verified sender on your own domain
        // (e.g. orders@realaminos.com) once one is set up in Resend.
        from: "RealAminos <confirmation@shoprealaminos.com>",
        to: input.toEmail,
        subject: `Order Confirmed — #${input.orderNumber}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend order confirmation email failed:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Resend order confirmation email threw:", err);
    return false;
  }
}
