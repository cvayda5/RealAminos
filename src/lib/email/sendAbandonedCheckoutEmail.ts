// The three checkout-abandonment reminder emails (stage 1 = 1 hour, 2 = 24
// hours, 3 = 72 hours after the customer last touched checkout). Sent by the
// cron job in /api/cron/abandoned-checkouts. Like the other emails here it
// never throws — it returns false on any failure so the caller can retry on
// the next run.
import { wrapEmailHtml, BRAND } from "./emailLayout";

export type AbandonedStage = 1 | 2 | 3;

export interface AbandonedItem {
  productName: string;
  size: string;
  qty: number;
  unitPrice: number;
}

const SITE = "https://shoprealaminos.com";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COPY: Record<AbandonedStage, { subject: string; heading: string; body: string }> = {
  1: {
    subject: "You left something in your cart",
    heading: "Still thinking it over?",
    body: "You were part of the way through checking out at RealAminos. Your items are still in your cart whenever you're ready to finish.",
  },
  2: {
    subject: "Your RealAminos cart is waiting",
    heading: "Your cart is still here",
    body: "Just a reminder that you have items waiting. Paying by Zelle takes an extra 5% off, and orders of $200 or more ship free. Questions about anything? Just reply to this email.",
  },
  3: {
    subject: "Last reminder about your cart",
    heading: "Last reminder",
    body: "This is our last note about your cart. Items in your cart aren't held for you, so popular products can sell out. If you still want them, you can finish checking out any time.",
  },
};

export async function sendAbandonedCheckoutEmail(input: {
  toEmail: string;
  firstName?: string | null;
  stage: AbandonedStage;
  items: AbandonedItem[];
  subtotal: number;
  unsubscribeToken: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — skipping abandoned checkout email.");
    return false;
  }

  const copy = COPY[input.stage];
  const unsubUrl = `${SITE}/api/abandoned-checkout/unsubscribe?t=${encodeURIComponent(input.unsubscribeToken)}`;
  const greeting = input.firstName ? `Hi ${esc(input.firstName)},` : "Hi,";

  const itemRows = input.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};">${esc(
          i.productName
        )} <span style="color:${BRAND.muted};">(${esc(i.size)}) × ${i.qty}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};text-align:right;">$${(
          i.unitPrice * i.qty
        ).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const text = `${greeting}

${copy.body}

${input.items.map((i) => `- ${i.productName} (${i.size}) x${i.qty}`).join("\n")}
Subtotal: $${input.subtotal.toFixed(2)}

Finish checking out: ${SITE}/shop

Don't want these reminders? Unsubscribe: ${unsubUrl}`;

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.ink};">${copy.heading}</h1>
    <p style="margin:0 0 6px;font-size:14.5px;line-height:1.6;color:${BRAND.ink};">${greeting}</p>
    <p style="margin:0 0 18px;font-size:14.5px;line-height:1.6;color:${BRAND.muted};">${copy.body}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">${itemRows}
      <tr>
        <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:${BRAND.ink};">Subtotal</td>
        <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:${BRAND.ink};text-align:right;">$${input.subtotal.toFixed(
          2
        )}</td>
      </tr>
    </table>
    <a href="${SITE}/shop" style="display:inline-block;margin-top:20px;background:${
      BRAND.orange
    };color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">
      Finish checking out
    </a>
    <p style="margin:24px 0 0;font-size:11.5px;color:#9ca3af;">
      Don't want these reminders? <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a>
    </p>
  `;

  const html = wrapEmailHtml({ preheader: copy.body.slice(0, 110), bodyHtml });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "RealAminos <confirmation@shoprealaminos.com>",
        to: input.toEmail,
        reply_to: "info@shoprealaminos.com",
        subject: copy.subject,
        text,
        html,
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend abandoned checkout email failed:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend abandoned checkout email threw:", err);
    return false;
  }
}
