// Shared branded wrapper for every transactional email sent from this repo
// via Resend (order confirmation, order shipped, and any future one). Keeps
// the logo, card styling, and footer disclaimer in one place instead of
// duplicated across each email's file.
//
// Email clients (Outlook especially) don't render modern CSS reliably, so
// this deliberately sticks to inline styles, simple divs/tables, and widely-
// supported properties rather than flexbox/grid.
//
// The logo image is served from the live site itself — /public/email-logo.png
// deploys to https://shoprealaminos.com/email-logo.png — since email clients
// need a real hosted URL for images (they can't inline/base64 reliably, and
// most strip <style> blocks in <head>, so nothing here depends on that either).
const LOGO_URL = "https://shoprealaminos.com/email-logo.png";

export function wrapEmailHtml(opts: { preheader?: string; bodyHtml: string }): string {
  return `
<div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${
    opts.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}</div>`
      : ""
  }
  <div style="max-width:520px;margin:0 auto;">
    <div style="text-align:center;padding:4px 0 24px;">
      <img src="${LOGO_URL}" alt="RealAminos" height="36" style="height:36px;width:auto;border:0;display:inline-block;" />
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;">
      ${opts.bodyHtml}
    </div>
    <p style="text-align:center;font-size:11.5px;color:#9ca3af;line-height:1.6;margin:20px 8px 0;">
      RealAminos &middot; Products are for laboratory research use only and are not for human or
      veterinary use.<br />
      This email was sent because it's tied to an order or account on shoprealaminos.com.
    </p>
  </div>
</div>`;
}

// A small reusable pill for an order number, used the same way in both the
// confirmation and shipped emails so they visually match.
export function orderNumberPill(orderNumber: string): string {
  return `<span style="display:inline-block;background:#fff7ed;color:#c2540c;font-weight:700;font-size:13px;padding:4px 12px;border-radius:999px;">#${orderNumber}</span>`;
}

export const BRAND = {
  ink: "#111827",
  muted: "#6b7280",
  orange: "#f97316",
  orangeDark: "#c2540c",
  line: "#e5e7eb",
  green: "#059669",
};
