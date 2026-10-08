"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart/CartContext";
import { createClient } from "@/lib/supabase/client";
import type { ShippingDetails } from "@/types/database";
import { calculateShippingFee, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/rate";
import ZellePaymentStatus from "@/components/ZellePaymentStatus";
import ZelleNoteGuide from "@/components/ZelleNoteGuide";
import { getBulkPercent, bulkLineTotal } from "@/lib/promotions/bulkPricing";

// Kept in sync by eye with ZELLE_DISCOUNT_RATE in
// src/app/api/checkout/zelle/route.ts — this is display-only (the server
// recomputes the real discount itself), so a mismatch here would just show
// the wrong preview number, not actually charge the wrong amount.
const ZELLE_DISCOUNT_PERCENT = 5;

interface ZelleOrderResult {
  orderId: string;
  orderNumber: string;
  amountDue: number;
  createdAt: string;
}

interface BitcoinOrderResult {
  orderId: string;
  orderNumber: string;
  amountDue: number;
  checkoutUrl: string;
}

const EMPTY_SHIPPING: ShippingDetails = {
  name: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
};

export default function CartDrawer() {
  const { items, removeItem, clear, subtotal, isDrawerOpen, closeDrawer } = useCart();
  const router = useRouter();
  const [waiverChecked, setWaiverChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `100dvh` (globals.css) reacts to Safari's OWN chrome collapsing
  // (address bar/tab bar) but not to the on-screen keyboard, which is why
  // the checkout button could still end up covered while typing.
  //
  // An earlier attempt at fixing this also tracked window.visualViewport's
  // offsetTop and used it to move the drawer's `top`, which backfired badly
  // — offsetTop can read as a stray nonzero value for reasons that have
  // nothing to do with the keyboard (scroll position, address-bar animation
  // mid-flight, etc.), and shifting a position:fixed element by that amount
  // pushed the whole drawer down and off the bottom of the screen even with
  // no keyboard open at all. That's reverted.
  //
  // This only ever shrinks the drawer's height, never repositions it
  // (`top` stays a plain 0 in globals.css) — and only when
  // visualViewport.height is CLEARLY smaller than the window (a real
  // keyboard covering a meaningful chunk of the screen, not just the small
  // few-pixel wobble Safari's chrome can cause on its own). Anything short
  // of that threshold falls straight back to the existing 100dvh behavior.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function syncViewport() {
      const shrunkBy = window.innerHeight - vv!.height;
      // 150px is comfortably more than any address-bar/chrome wobble, and
      // comfortably less than a real keyboard (which is normally 250px+ on
      // an iPhone) — so this only ever engages for an actual keyboard.
      if (shrunkBy > 150) {
        document.documentElement.style.setProperty("--vv-height", `${vv!.height}px`);
      } else {
        document.documentElement.style.removeProperty("--vv-height");
      }
    }

    syncViewport();
    vv.addEventListener("resize", syncViewport);
    return () => {
      vv.removeEventListener("resize", syncViewport);
      document.documentElement.style.removeProperty("--vv-height");
    };
  }, [isDrawerOpen]);

  // 'cart' shows the line items + waiver. 'shipping' collects where the
  // order actually ships to. 'payment' is where the customer pays — Zelle
  // is the only payment method (card checkout through Whop was removed after
  // that account was banned). Once shipping info is in, the order number
  // they'd need for the Zelle payment note can be generated (Zelle creates
  // the real order immediately).
  const [step, setStep] = useState<"cart" | "shipping" | "payment">("cart");
  const [shipping, setShipping] = useState<ShippingDetails>(EMPTY_SHIPPING);

  // Zelle is the only payment method, so it's selected by default. Once it
  // has actually created its (unpaid) order, the result is cached in
  // zelleOrder so re-opening this step doesn't create a second order.
  const [paymentMethod, setPaymentMethod] = useState<"zelle" | "bitcoin" | null>("zelle");
  const [zelleOrder, setZelleOrder] = useState<ZelleOrderResult | null>(null);
  const [bitcoinOrder, setBitcoinOrder] = useState<BitcoinOrderResult | null>(null);
  const [bitcoinLoading, setBitcoinLoading] = useState(false);
  const [bitcoinError, setBitcoinError] = useState<string | null>(null);
  const [zelleLoading, setZelleLoading] = useState(false);
  const [zelleError, setZelleError] = useState<string | null>(null);

  // Discount code — "applied" only ever reflects what the server confirmed
  // via /api/discount-codes/validate. The percent shown here is purely
  // informational for the customer; the order route re-validates the code
  // and re-derives the percent itself, so nothing here has to be trusted.
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percentOff: number } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // `subtotal` (from useCart()) is the sum of each line's real unit price
  // (with the quantity/bulk discount already applied — see
  // lib/promotions/bulkPricing.ts) — that's also exactly what's charged (see
  // 0025_restore_original_prices.sql — any "was" price is display-only,
  // shown struck through on the product pages, and never affects the real
  // price a line was added to the cart at). A typed discount code applies
  // on top of that, mirroring exactly what both checkout routes compute
  // server-side so this preview never disagrees with what's actually
  // charged.
  const codePercent = appliedDiscount?.percentOff ?? 0;
  const codeDiscountAmount = subtotal * (codePercent / 100);
  const total = subtotal - codeDiscountAmount;

  // Free at $200+ of the real subtotal, otherwise a flat zone rate based on
  // the shipping state — same function + same base amount the server uses
  // in both checkout routes, so this preview always matches what actually
  // gets charged. Only shown on the shipping step, since there's no state
  // to estimate from yet on the cart step.
  const shippingFee = calculateShippingFee(subtotal, shipping.state);
  const grandTotal = total + shippingFee;

  // A cart made entirely of points-redeemed rewards can't check out on its
  // own — enforced again server-side in /api/orders, this just gives the
  // customer an explanation before they get all the way to the shipping
  // step.
  const hasPaidItem = items.some((i) => !i.isReward);

  function money(n: number) {
    return "$" + n.toFixed(2);
  }

  async function handleApplyDiscount() {
    const code = discountInput.trim();
    if (!code) return;

    setApplyingDiscount(true);
    setDiscountError(null);

    const res = await fetch("/api/discount-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));

    setApplyingDiscount(false);

    if (!res.ok) {
      setAppliedDiscount(null);
      setDiscountError(body.error ?? "That code didn't work.");
      return;
    }

    setAppliedDiscount({ code: body.code, percentOff: body.percentOff });
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountInput("");
    setDiscountError(null);
  }

  function updateShipping<K extends keyof ShippingDetails>(field: K, value: ShippingDetails[K]) {
    setShipping((s) => ({ ...s, [field]: value }));
  }

  async function handleContinueToShipping() {
    setError(null);

    // Checkout requires a real, logged-in account — that's what lets an
    // order be tied to a specific customer under Row Level Security,
    // instead of trusting a typed-in email address the way the design
    // prototype's mock checkout did.
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      closeDrawer();
      router.push("/login?next=/account/orders");
      return;
    }

    if (!hasPaidItem) {
      setError("Add at least one item you're paying for to check out — a cart can't be only free, points-redeemed rewards.");
      return;
    }

    // Prefill the email with the account's own email so it's one less thing
    // to type, but leave it editable in case shipping confirmation should go
    // to a different inbox.
    setShipping((s) => ({ ...s, email: s.email || user.email || "" }));
    setStep("shipping");
  }

  // Shipping form submit no longer places the order directly — it just
  // moves on to picking a payment method, since Zelle needs to create its
  // (unpaid) order right at selection time rather than at a final submit.
  function handleContinueToPayment(e: React.FormEvent) {
    e.preventDefault();
    setStep("payment");
  }

  const cartPayload = () => ({
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      size: i.size,
      qty: i.qty,
      unitPrice: i.unitPrice,
      pointTransactionId: i.pointTransactionId,
    })),
    shipping,
    discountCode: appliedDiscount?.code,
  });

  // Selecting Zelle immediately creates the real (unpaid) order — there's no
  // external checkout session to send the customer to, and they need the
  // order number right away to put in the Zelle payment note. Cached in
  // zelleOrder so it doesn't create a second order for the same cart.
  async function handleSelectZelle() {
    setPaymentMethod("zelle");
    if (zelleOrder || zelleLoading) return;

    setZelleLoading(true);
    setZelleError(null);

    const res = await fetch("/api/checkout/zelle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cartPayload()),
    });
    const body = await res.json().catch(() => ({}));
    setZelleLoading(false);

    if (!res.ok) {
      setZelleError(body.error ?? "Something went wrong starting checkout.");
      return;
    }

    setZelleOrder({
      orderId: body.orderId,
      orderNumber: body.orderNumber,
      amountDue: body.amountDue,
      createdAt: body.createdAt,
    });

    // The order is now real (unpaid, but real — any redeemed reward points
    // are already spent/linked to it) — clear the cart rather than leaving
    // these items sitting in the drawer looking like they still need
    // checking out.
    clear();
  }

  // Bitcoin: creates the real (unpaid) order plus a BTCPay invoice, then shows
  // a button that opens BTCPay's hosted payment page. The order finalizes
  // itself when BTCPay's webhook reports the payment confirmed — the customer
  // doesn't need to come back and press anything.
  async function handleSelectBitcoin() {
    if (bitcoinOrder || bitcoinLoading || zelleOrder) return;

    setBitcoinLoading(true);
    setBitcoinError(null);

    const res = await fetch("/api/checkout/bitcoin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cartPayload()),
    });
    const body = await res.json().catch(() => ({}));
    setBitcoinLoading(false);

    if (!res.ok) {
      setBitcoinError(body.error ?? "Something went wrong starting checkout.");
      return;
    }

    setBitcoinOrder({
      orderId: body.orderId,
      orderNumber: body.orderNumber,
      amountDue: body.amountDue,
      checkoutUrl: body.checkoutUrl,
    });

    clear();
  }

  function handleClose() {
    // Closing the drawer mid-checkout shouldn't strand the customer
    // mid-flow next time they open it with an empty cart view.
    setStep("cart");
    setPaymentMethod("zelle");
    setZelleOrder(null);
    setZelleError(null);
    setBitcoinOrder(null);
    setBitcoinError(null);
    closeDrawer();
  }

  return (
    <>
      <div className={`overlay ${isDrawerOpen ? "show" : ""}`} onClick={handleClose} />
      <div className={`drawer ${isDrawerOpen ? "show" : ""}`}>
        <div className="drawer-head">
          <h3>
            {step === "shipping" ? "Shipping Info" : step === "payment" ? "Payment" : "Your Cart"}
          </h3>
          <button className="drawer-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {step === "cart" ? (
          <>
            <div className="drawer-body">
              {items.length === 0 ? (
                <div className="empty-cart">
                  Your cart is empty.
                  <br />
                  Browse the shop to add research compounds.
                </div>
              ) : (
                items.map((item) => (
                  <div className="cart-line" key={item.pointTransactionId ?? `${item.productId}-${item.size}`}>
                    <div className="thumb-sm">{item.isReward ? "🎁" : "🧪"}</div>
                    <div className="info">
                      <h5>{item.productName}</h5>
                      <span>
                        {item.size} × {item.qty}
                      </span>
                      {!item.isReward && !item.pointTransactionId && getBulkPercent(item.qty) > 0 && (
                        <>
                          <br />
                          <span style={{ color: "var(--ok)", fontWeight: 700 }}>
                            {getBulkPercent(item.qty)}% bulk discount applied
                          </span>
                        </>
                      )}
                      {item.isReward && (
                        <>
                          <br />
                          <span style={{ color: "var(--ok)" }}>Redeemed with {item.pointsCost} points</span>
                        </>
                      )}
                      <br />
                      <button className="link-btn" onClick={() => removeItem(item)}>
                        Remove
                      </button>
                    </div>
                    <div className="amt">
                      {money(
                        item.isReward || item.pointTransactionId
                          ? item.unitPrice * item.qty
                          : bulkLineTotal(item.unitPrice, item.qty)
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="drawer-foot">
                <div className="discount-box">
                  {appliedDiscount ? (
                    <div className="discount-applied">
                      <span>
                        Code <strong>{appliedDiscount.code}</strong> applied (-{appliedDiscount.percentOff}%)
                      </span>
                      <button type="button" className="link-btn" onClick={removeDiscount}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="discount-input-row">
                      <input
                        placeholder="Discount code"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyDiscount();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleApplyDiscount}
                        disabled={applyingDiscount || !discountInput.trim()}
                      >
                        {applyingDiscount ? "Checking…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {discountError && <p className="error" style={{ marginTop: 6 }}>{discountError}</p>}
                </div>

                <div className="subtotal-row">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                {appliedDiscount && codeDiscountAmount > 0 && (
                  <div className="subtotal-row" style={{ color: "var(--ok)" }}>
                    <span>Code {appliedDiscount.code}</span>
                    <span>-{money(codeDiscountAmount)}</span>
                  </div>
                )}
                <div className="subtotal-row" style={{ fontWeight: 800 }}>
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
                <div className="waiver-box">
                  <label>
                    <input type="checkbox" checked={waiverChecked} onChange={(e) => setWaiverChecked(e.target.checked)} />
                    I confirm I am 21+, purchasing solely for laboratory research use, and agree to the{" "}
                    <a
                      href="/legal"
                      onClick={handleClose}
                      style={{ color: "var(--orange-dark)", fontWeight: 700, textDecoration: "underline" }}
                    >
                      RUO Purchaser Agreement
                    </a>
                    .
                  </label>
                </div>
                {!hasPaidItem && (
                  <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                    Add at least one paid item to check out — a cart can&apos;t be only free,
                    points-redeemed rewards.
                  </p>
                )}
                <button
                  className="btn"
                  style={{ width: "100%" }}
                  disabled={!waiverChecked || !hasPaidItem}
                  onClick={handleContinueToShipping}
                >
                  Continue to Shipping
                </button>
                {error && <p className="error">{error}</p>}
              </div>
            )}
          </>
        ) : step === "shipping" ? (
          <form onSubmit={handleContinueToPayment} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div className="drawer-body">
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 6px" }}>
                We just need to know where this ships to — you&apos;ll pick how to pay on the
                next screen.
              </p>

              <label htmlFor="ship-name">Full Name</label>
              <input
                id="ship-name"
                required
                value={shipping.name}
                onChange={(e) => updateShipping("name", e.target.value)}
              />

              <label htmlFor="ship-phone">Phone Number</label>
              <input
                id="ship-phone"
                type="tel"
                required
                value={shipping.phone}
                onChange={(e) => updateShipping("phone", e.target.value)}
              />

              <label htmlFor="ship-email">Email</label>
              <input
                id="ship-email"
                type="email"
                required
                value={shipping.email}
                onChange={(e) => updateShipping("email", e.target.value)}
              />

              <label htmlFor="ship-address1">Address Line 1</label>
              <input
                id="ship-address1"
                required
                value={shipping.addressLine1}
                onChange={(e) => updateShipping("addressLine1", e.target.value)}
              />

              <label htmlFor="ship-address2">Address Line 2 (optional)</label>
              <input
                id="ship-address2"
                value={shipping.addressLine2}
                onChange={(e) => updateShipping("addressLine2", e.target.value)}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 2 }}>
                  <label htmlFor="ship-city">City</label>
                  <input
                    id="ship-city"
                    required
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="ship-state">State</label>
                  <input
                    id="ship-state"
                    required
                    value={shipping.state}
                    onChange={(e) => updateShipping("state", e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="ship-zip">ZIP</label>
                  <input
                    id="ship-zip"
                    required
                    value={shipping.zip}
                    onChange={(e) => updateShipping("zip", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="drawer-foot">
              <div className="subtotal-row">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {appliedDiscount && codeDiscountAmount > 0 && (
                <div className="subtotal-row" style={{ color: "var(--ok)" }}>
                  <span>Code {appliedDiscount.code}</span>
                  <span>-{money(codeDiscountAmount)}</span>
                </div>
              )}
              <div className="subtotal-row">
                <span>Shipping{!shipping.state.trim() && " (enter state below)"}</span>
                <span style={shippingFee === 0 ? { color: "var(--ok)", fontWeight: 700 } : undefined}>
                  {shippingFee === 0 ? "FREE" : money(shippingFee)}
                </span>
              </div>
              {shippingFee > 0 && (
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "-4px 0 8px" }}>
                  Free shipping on orders of {money(FREE_SHIPPING_THRESHOLD)}+ before discounts.
                </p>
              )}
              <div className="subtotal-row" style={{ fontWeight: 800 }}>
                <span>Total</span>
                <span>{money(grandTotal)}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setStep("cart")}
                >
                  Back to Cart
                </button>
                <button type="submit" className="btn" style={{ flex: 2 }}>
                  Continue to Payment
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div className="drawer-body">
              <div className="subtotal-row" style={{ fontWeight: 800, marginBottom: 14 }}>
                <span>Total Due</span>
                <span>{money(grandTotal)}</span>
              </div>

              <div
                className={`payment-option ${paymentMethod === "zelle" ? "selected" : ""}`}
                onClick={() => {
                  if (!bitcoinOrder) setPaymentMethod("zelle");
                }}
                style={{
                  border: `2px solid ${paymentMethod === "zelle" ? "var(--orange)" : "var(--line)"}`,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 12,
                  cursor: "pointer",
                }}
              >
                <strong>🏦 Zelle</strong>{" "}
                <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 12.5 }}>Save {ZELLE_DISCOUNT_PERCENT}%</span>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {money(grandTotal * (1 - ZELLE_DISCOUNT_PERCENT / 100))} — manual payment, confirmed by staff
                </div>
              </div>

              <div
                className={`payment-option ${paymentMethod === "bitcoin" ? "selected" : ""}`}
                onClick={() => {
                  if (!zelleOrder) setPaymentMethod("bitcoin");
                }}
                style={{
                  border: `2px solid ${paymentMethod === "bitcoin" ? "var(--orange)" : "var(--line)"}`,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 12,
                  cursor: "pointer",
                }}
              >
                <strong>₿ Bitcoin</strong>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {money(bitcoinOrder?.amountDue ?? grandTotal)} — confirms automatically, no manual steps
                </div>
              </div>

              {paymentMethod === "bitcoin" && (
                <div
                  style={{
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-line)",
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 4,
                  }}
                >
                  {!bitcoinOrder ? (
                    <>
                      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                        You&apos;ll pay <strong>{money(grandTotal)}</strong> in Bitcoin on a secure payment page.
                        The amount is locked in US dollars at checkout, and your order moves to Processing on
                        its own once the payment confirms — usually within about an hour.
                      </p>
                      <button
                        type="button"
                        className="btn"
                        style={{ width: "100%" }}
                        onClick={handleSelectBitcoin}
                        disabled={bitcoinLoading}
                      >
                        {bitcoinLoading ? "Creating your invoice…" : "Continue with Bitcoin"}
                      </button>
                      {bitcoinError && (
                        <p className="error" style={{ marginTop: 8 }}>
                          {bitcoinError}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 4px", fontSize: 13.5 }}>
                        Order number: <strong>{bitcoinOrder.orderNumber}</strong>
                      </p>
                      <p style={{ margin: "0 0 12px", fontSize: 13.5 }}>
                        Amount due: <strong>{money(bitcoinOrder.amountDue)}</strong>
                      </p>
                      <a
                        className="btn"
                        href={bitcoinOrder.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                      >
                        Pay with Bitcoin →
                      </a>
                      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                        The payment page opens in a new tab and expires after 60 minutes. Once your payment
                        confirms, this order updates automatically — track it anytime on the My Orders page.
                      </p>
                    </>
                  )}
                </div>
              )}

              {paymentMethod === "zelle" && (
                <div
                  style={{
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-line)",
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 4,
                  }}
                >
                  {!zelleOrder && (
                    <ZelleNoteGuide onContinue={handleSelectZelle} loading={zelleLoading} error={zelleError} />
                  )}
                  {zelleOrder && (
                    <>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <Image
                          src="/zelle-qr.jpg"
                          alt="Zelle QR code"
                          width={130}
                          height={130}
                          style={{ borderRadius: 8, background: "#fff", padding: 6 }}
                        />
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 13.5 }}>
                            Send <strong>{money(zelleOrder.amountDue)}</strong> via Zelle using the QR code.
                          </p>
                          <p style={{ margin: "0 0 4px", fontSize: 13.5 }}>
                            Order number: <strong>{zelleOrder.orderNumber}</strong>
                          </p>
                        </div>
                      </div>
                      <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-2)" }}>
                        Using phone? Zelle to the email <strong>info@shoprealaminos.com</strong>.
                      </p>
                      <p style={{ margin: "10px 0 0", fontSize: 12.5, fontWeight: 800, color: "var(--danger)" }}>
                        You MUST put {zelleOrder.orderNumber} in the Zelle payment note, or your payment
                        will be refunded instead of fulfilled.
                      </p>
                      <ZellePaymentStatus orderId={zelleOrder.orderId} createdAt={zelleOrder.createdAt} onPaid={handleClose} />
                      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
                        You can also find these instructions and the button above anytime on the My
                        Orders page, as long as you&apos;re still inside the 20-minute window.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="drawer-foot">
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setStep("shipping")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 2 }}
                  onClick={handleClose}
                  disabled={!zelleOrder && !bitcoinOrder}
                >
                  Done
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
