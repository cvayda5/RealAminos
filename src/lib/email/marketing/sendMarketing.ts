// Renders one marketing template and sends it through Resend. Every message is
// individually addressed and carries its own signed unsubscribe link, the
// List-Unsubscribe headers (one-click unsubscribe in Gmail/Apple Mail), and the
// business postal address — all required for commercial email (CAN-SPAM).
import { wrapEmailHtml, BRAND } from "../emailLayout";
import { buildUnsubscribeUrl } from "./unsubscribeToken";
import type { MarketingTemplate } from "./templates";

const SITE = "https://shoprealaminos.com";
const FROM = process.env.MARKETING_FROM || "RealAminos <news@shoprealaminos.com>";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The business mailing address printed in every email's footer. */
export function postalAddress(): string | null {
  const a = process.env.MARKETING_POSTAL_ADDRESS?.trim();
  return a ? a : null;
}

export function renderMarketingEmail(t: MarketingTemplate, toEmail: string, address: string) {
  const unsubUrl = buildUnsubscribeUrl(toEmail);
  const ctaUrl = `${SITE}${t.ctaPath}?utm_source=email&utm_medium=marketing&utm_campaign=${encodeURIComponent(t.key)}`;

  const paragraphsHtml = t.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:${BRAND.muted};">${esc(p)}</p>`)
    .join("");
  const bulletsHtml = t.bullets
    ? `<ul style="margin:0 0 18px;padding-left:20px;font-size:14.5px;line-height:1.8;color:${BRAND.ink};">${t.bullets
        .map((b) => `<li>${esc(b)}</li>`)
        .join("")}</ul>`
    : "";

  const bodyHtml = `
    <h1 style="margin:0 0 14px;font-size:21px;color:${BRAND.ink};">${esc(t.heading)}</h1>
    ${paragraphsHtml}
    ${bulletsHtml}
    <a href="${ctaUrl}" style="display:inline-block;margin-top:6px;background:${BRAND.orange};color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">${esc(
      t.ctaLabel
    )}</a>
    <p style="margin:26px 0 0;font-size:11.5px;line-height:1.6;color:#9ca3af;">
      You're getting this because you signed up at shoprealaminos.com.<br />
      RealAminos &middot; ${esc(address)}<br />
      <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a>
    </p>
  `;

  const text = `${t.heading}

${t.paragraphs.join("\n\n")}
${t.bullets ? "\n" + t.bullets.map((b) => `- ${b}`).join("\n") + "\n" : ""}
${t.ctaLabel}: ${ctaUrl}

Research use only. Not for human or veterinary use.
You're getting this because you signed up at shoprealaminos.com.
RealAminos - ${address}
Unsubscribe: ${unsubUrl}`;

  return {
    subject: t.subject,
    html: wrapEmailHtml({ preheader: esc(t.preheader), bodyHtml }),
    text,
    unsubUrl,
  };
}

/**
 * Sends one template to up to 100 recipients through Resend's batch endpoint.
 * Returns true only if Resend accepted the whole batch. Never throws.
 */
export async function sendMarketingBatch(t: MarketingTemplate, recipients: string[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const address = postalAddress();
  if (!apiKey || !address || recipients.length === 0) return false;

  try {
    const payload = recipients.map((to) => {
      const m = renderMarketingEmail(t, to, address);
      return {
        from: FROM,
        to: [to],
        reply_to: "info@shoprealaminos.com",
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: {
          "List-Unsubscribe": `<${m.unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Resend marketing batch failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend marketing batch threw:", err);
    return false;
  }
}
