"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { createClient } from "@/lib/supabase/client";
import type { ShippingDetails } from "@/types/database";
import { calculateShippingFee, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/rate";

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
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 'cart' shows the line items + waiver. 'shipping' collects where the
  // order actually ships to. There's no payment processor wired up yet, but
  // every real order still needs a real destination, so this step is
  // required before the order is created.
  const [step, setStep] = useState<"cart" | "shipping">("cart");
  const [shipping, setShipping] = useState<ShippingDetails>(EMPTY_SHIPPING);

  // Discount code — "applied" only ever reflects what the server confirmed
  // via /api/discount-codes/validate. The percent shown here is purely
  // informational for the customer; the order route re-validates the code
  // and re-derives the percent itself, so nothing here has to be trusted.
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percentOff: number } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const discountAmount = appliedDiscount ? subtotal * (appliedDiscount.percentOff / 100) : 0;
  const total = subtotal - discountAmount;

  // Free at $200+ of raw subtotal, otherwise a flat zone rate based on the
  // shipping state — same function the server calls in /api/orders, so
  // this preview always matches what actually gets charged. Only shown on
  // the shipping step, since there's no state to estimate from yet on the
  // cart step.
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

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPlacing(true);

    // Kicks off a Whop-hosted checkout rather than creating the order
    // directly — the cart/points reservations aren't touched at all here.
    // The real order only gets created once Whop confirms payment via
    // webhook (see /api/webhooks/whop); this just redirects the browser to
    // go pay.
    const res = await fetch("/api/checkout/whop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          productName: i.productName,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unitPrice,
          pointTransactionId: i.pointTransactionId,
        })),
        shipping,
        discountCode: appliedDiscount?.code,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setPlacing(false);
      setError(body.error ?? "Something went wrong starting checkout.");
      return;
    }

    // Full redirect (not client-side navigation) — this is leaving the site
    // entirely to go pay on Whop's hosted checkout page.
    window.location.href = body.purchaseUrl;
  }

  function handleClose() {
    // Closing the drawer mid-shipping-form shouldn't strand the customer on
    // the shipping step next time they open it with an empty cart view.
    setStep("cart");
    closeDrawer();
  }

  return (
    <>
      <div className={`overlay ${isDrawerOpen ? "show" : ""}`} onClick={handleClose} />
      <div className={`drawer ${isDrawerOpen ? "show" : ""}`}>
        <div className="drawer-head">
          <h3>{step === "shipping" ? "Shipping Info" : "Your Cart"}</h3>
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
                      {item.isReward && (
                        <>
                          <br />
                          <span style={{ color: "#059669" }}>Redeemed with {item.pointsCost} points</span>
                        </>
                      )}
                      <br />
                      <button className="link-btn" onClick={() => removeItem(item)}>
                        Remove
                      </button>
                    </div>
                    <div className="amt">{money(item.unitPrice * item.qty)}</div>
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
                {appliedDiscount && (
                  <div className="subtotal-row" style={{ color: "#059669" }}>
                    <span>Discount ({appliedDiscount.percentOff}%)</span>
                    <span>-{money(discountAmount)}</span>
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
        ) : (
          <form onSubmit={handlePlaceOrder} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div className="drawer-body">
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
                We just need to know where this ships to — you&apos;ll enter payment details on
                the next screen.
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
              {appliedDiscount && (
                <div className="subtotal-row" style={{ color: "#059669" }}>
                  <span>Discount ({appliedDiscount.code}, -{appliedDiscount.percentOff}%)</span>
                  <span>-{money(discountAmount)}</span>
                </div>
              )}
              <div className="subtotal-row">
                <span>Shipping{!shipping.state.trim() && " (enter state below)"}</span>
                <span style={shippingFee === 0 ? { color: "#059669", fontWeight: 700 } : undefined}>
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
                  disabled={placing}
                >
                  Back to Cart
                </button>
                <button type="submit" className="btn" style={{ flex: 2 }} disabled={placing}>
                  {placing ? "Redirecting to payment…" : "Continue to Payment"}
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
