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

import { wrapEmailHtml, orderNumberPill, BRAND } from "./emailLayout";

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

This confirms your payment went through and your order is now being processed. Products are for laboratory research use only and are not for human or veterinary use.`;

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:999px;background:#ecfdf5;color:${
        BRAND.green
      };font-size:22px;font-weight:700;margin-bottom:14px;">&#10003;</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:${BRAND.ink};">Your order is confirmed!</h1>
      <div>${orderNumberPill(input.orderNumber)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:${BRAND.ink};">
      ${itemRowsHtml}
      <tr><td style="padding-top:10px;color:${BRAND.muted};">Subtotal</td>
          <td style="padding-top:10px;text-align:right;">$${input.subtotal.toFixed(2)}</td></tr>
      ${discountLineHtml}
      ${shippingLineHtml}
      <tr><td style="padding-top:10px;font-weight:700;border-top:1px solid ${
        BRAND.line
      };">Total</td>
          <td style="padding-top:10px;font-weight:700;border-top:1px solid ${
            BRAND.line
          };text-align:right;">$${grandTotal.toFixed(2)}</td></tr>
    </table>
    <div style="margin-top:26px;padding-top:20px;border-top:1px solid ${BRAND.line};">
      <p style="font-size:13px;font-weight:700;color:${BRAND.ink};margin:0 0 6px;">Shipping to</p>
      <p style="font-size:14px;color:${BRAND.muted};margin:0;white-space:pre-line;line-height:1.5;">${addressText}</p>
    </div>
    <p style="font-size:13px;color:${BRAND.muted};margin:22px 0 0;line-height:1.6;">
      You can check your order status any time on the My Orders page. This confirms your
      payment went through and your order is now being processed.
    </p>
  `;

  const html = wrapEmailHtml({
    preheader: `Order #${input.orderNumber} confirmed — total $${grandTotal.toFixed(2)}`,
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
        // shoprealaminos.com is verified in Resend (SPF/DKIM), so we send
        // from our own domain instead of the onboarding@resend.dev test
        // sender. The 2FA/login-code emails use a separate address
        // (2fa@shoprealaminos.com) configured directly in Supabase's SMTP
        // settings, not here.
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
