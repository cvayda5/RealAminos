import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NewOrderPayload, PointTransaction } from "@/types/database";
import { calculateShippingFee } from "@/lib/shipping/rate";
import { resolveVariant } from "@/lib/inventory/resolveVariant";
import { resolveDiscount } from "@/lib/checkout/resolveDiscount";
import { bulkUnitPrice } from "@/lib/promotions/bulkPricing";
import { sendAdminOrderNotification } from "@/lib/email/sendAdminOrderNotification";

// 5% off for choosing Zelle over a card — in exchange for us not getting
// instant payment confirmation the way Whop gives us. See the big comment
// on 0013_zelle_payments.sql for how this fits into the order lifecycle.
const ZELLE_DISCOUNT_RATE = 0.05;

// POST /api/checkout/zelle — validates the cart exactly the same way
// /api/checkout/whop does (same stock check, same reward-reservation
// re-verification, same server-side discount-code/shipping recomputation —
// never trust the client for any of this). The difference from Whop: there's
// no external checkout session to redirect to, so this creates a REAL
// `orders` row immediately, under the customer's own session (same RLS
// pattern the old /api/orders used), with status "Awaiting Payment". Stock,
// earned points, and the confirmation email are all deferred until staff
// confirm the Zelle payment actually arrived and click "Mark Paid & Fulfill"
// — see /api/admin/orders/[id]/mark-paid.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json()) as NewOrderPayload;
  if (!body.items?.length) {
    return NextResponse.json({ error: "Order must include at least one item." }, { status: 400 });
  }

  const hasPaidItem = body.items.some((i) => !i.pointTransactionId);
  if (!hasPaidItem) {
    return NextResponse.json(
      { error: "Add at least one item you're paying for to check out — a cart can't be only free, points-redeemed rewards." },
      { status: 400 }
    );
  }

  const shipping = body.shipping;
  const required: (keyof typeof shipping)[] = ["name", "phone", "email", "addressLine1", "city", "state", "zip"];
  const missing = shipping ? required.filter((field) => !shipping[field]?.toString().trim()) : required;
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required shipping info: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Same point-in-time stock check as /api/checkout/whop — see that file's
  // comment for why this isn't a hold/reservation. Also resolve+cache each
  // line's real product_id here so the order_items insert below doesn't
  // have to re-query for it.
  const resolvedProductIdByLine = new Map<string, string>();
  // Real, current unit price per line, read straight from the database —
  // never trusted from whatever price the client happened to send. This is
  // just the variant's real stored price (see
  // 0025_restore_original_prices.sql — any "was" price is display-only via
  // compare_at_price and never affects what's actually charged), so what's
  // charged always matches what the product page showed.
  const realUnitPriceByLine = new Map<string, number>();
  for (const item of body.items) {
    const variant = await resolveVariant(admin, item);
    if (!variant) {
      return NextResponse.json(
        { error: `${item.productName} (${item.size}) is no longer available.` },
        { status: 400 }
      );
    }
    if (variant.stock < item.qty) {
      return NextResponse.json(
        {
          error:
            variant.stock === 0
              ? `${item.productName} (${item.size}) is currently out of stock.`
              : `Only ${variant.stock} left of ${item.productName} (${item.size}) — lower the quantity in your cart.`,
        },
        { status: 400 }
      );
    }
    const lineKey = item.pointTransactionId ?? `${item.productId}::${item.size}`;
    resolvedProductIdByLine.set(lineKey, variant.product_id);
    realUnitPriceByLine.set(lineKey, variant.price);
  }

  const rewardTxIds = [...new Set(body.items.map((i) => i.pointTransactionId).filter(Boolean))] as string[];
  const reservationById = new Map<string, PointTransaction>();

  if (rewardTxIds.length > 0) {
    const { data: reservations, error: resError } = await admin
      .from("point_transactions")
      .select("*")
      .in("id", rewardTxIds)
      .returns<PointTransaction[]>();

    if (resError) {
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    for (const id of rewardTxIds) {
      const found = reservations?.find((r) => r.id === id);
      if (!found || found.user_id !== user.id || found.type !== "redeemed" || found.order_id || found.voided) {
        return NextResponse.json(
          { error: "One of your redeemed rewards is no longer valid — remove it from your cart and try again." },
          { status: 400 }
        );
      }
      reservationById.set(id, found);
    }
  }

  const normalizedItems = body.items.map((i) => {
    if (i.pointTransactionId) return { ...i, unitPrice: 0 };
    const lineKey = i.pointTransactionId ?? `${i.productId}::${i.size}`;
    // The variant's real database price, then the quantity (bulk) discount
    // for this line's qty — recomputed here from scratch so the charged
    // price never depends on anything the browser sent. Same function the
    // cart uses to show the customer their price (lib/promotions/bulkPricing.ts).
    const basePrice = realUnitPriceByLine.get(lineKey) ?? i.unitPrice;
    return { ...i, unitPrice: bulkUnitPrice(basePrice, i.qty) };
  });

  const subtotal = normalizedItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const pointsRedeemedTotal = [...reservationById.values()].reduce((sum, r) => sum + Math.abs(r.points), 0);
  const shippingFee = calculateShippingFee(subtotal, shipping.state);

  // A customer-typed discount code, if any, applies on top of the subtotal
  // above — which already reflects the site-wide sale, if one's running,
  // via the real per-line prices computed above. See resolveDiscount.ts;
  // this is also what /api/checkout/whop uses, so both payment paths
  // always land on the exact same total for the same cart.
  let discountCode: string | null;
  let discountPercent: number;
  try {
    const resolved = await resolveDiscount(admin, body.discountCode);
    discountCode = resolved.code;
    discountPercent = resolved.percent;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That discount code is no longer valid." },
      { status: 400 }
    );
  }

  const total = Math.round(subtotal * (1 - discountPercent / 100) * 100) / 100;
  const preZelleGrandTotal = Math.round((total + shippingFee) * 100) / 100;
  const zelleDiscountAmount = Math.round(preZelleGrandTotal * ZELLE_DISCOUNT_RATE * 100) / 100;
  const amountDue = Math.round((preZelleGrandTotal - zelleDiscountAmount) * 100) / 100;

  // Insert under the customer's own session — orders_insert_own (see
  // 0001_init.sql) is what actually enforces user_id can't be spoofed. This
  // is a REAL order row, not a pending one, unlike the Whop flow — there's
  // no external payment session to wait on before we know "the customer
  // committed to this," just a promise to Zelle the money with the order
  // number in the note.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      subtotal,
      discount_code: discountCode,
      discount_percent: discountPercent,
      total,
      points_redeemed: pointsRedeemedTotal,
      shipping_fee: shippingFee,
      payment_method: "zelle",
      zelle_discount_amount: zelleDiscountAmount,
      status: "Awaiting Payment",
      shipping_name: shipping.name,
      shipping_phone: shipping.phone,
      shipping_email: shipping.email,
      shipping_address_line1: shipping.addressLine1,
      shipping_address_line2: shipping.addressLine2 || null,
      shipping_city: shipping.city,
      shipping_state: shipping.state,
      shipping_zip: shipping.zip,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    normalizedItems.map((i) => ({
      order_id: order.id,
      product_name: i.productName,
      size: i.size,
      qty: i.qty,
      unit_price: i.unitPrice,
      product_id: resolvedProductIdByLine.get(i.pointTransactionId ?? `${i.productId}::${i.size}`) ?? null,
    }))
  );

  if (itemsError) {
    // Best-effort cleanup so a failed item insert doesn't leave an empty
    // "ghost" order sitting in Awaiting Payment forever.
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Link the reservations to the real order right away (unlike Whop, which
  // waits for payment confirmation) — this order already exists for real,
  // it's just unpaid. Known tradeoff, not fixed in this pass: if this
  // specific Zelle order is never paid and never fulfilled, these points
  // are gone rather than automatically refunded — same as if the reward had
  // actually been used. A "Cancel & Refund" admin action would close that
  // gap later if it comes up.
  if (rewardTxIds.length > 0) {
    await admin.from("point_transactions").update({ order_id: order.id }).in("id", rewardTxIds);
  }

  // Fire-and-forget — a failed notification email should never fail the
  // order itself (sendAdminOrderNotification already never throws).
  await sendAdminOrderNotification({
    orderNumber: order.order_number,
    paymentMethod: "zelle",
    awaitingPayment: true,
    items: normalizedItems.map((i) => ({ productName: i.productName, size: i.size, qty: i.qty })),
    amountDue,
    shipping: { name: shipping.name, city: shipping.city, state: shipping.state },
  });

  return NextResponse.json(
    {
      orderId: order.id,
      orderNumber: order.order_number,
      // Server timestamp, not Date.now() on the client — this is what the
      // customer's 20-minute "I've Sent My Zelle Payment" countdown
      // (ZellePaymentStatus.tsx) anchors to, so it always matches exactly
      // what /api/orders/[id]/mark-paid itself checks server-side.
      createdAt: order.created_at,
      amountDue,
      zelleDiscountAmount,
      grandTotalBeforeDiscount: preZelleGrandTotal,
    },
    { status: 201 }
  );
}
