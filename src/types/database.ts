// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you add columns/tables later, update this file to match — or generate
// it automatically with `supabase gen types typescript`.

export type OrderStatus = "Awaiting Payment" | "Processing" | "Shipped" | "Delivered";

export type PaymentMethod = "card" | "zelle";

export interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  cas_number: string | null;
  category: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  // Certificate of Analysis for the lot currently in stock — see
  // 0014_coa.sql. All null for a product with no tested batch yet (e.g.
  // BAC Water, which isn't a peptide and has no lot/COA).
  lot_number: string | null;
  coa_url: string | null;
  coa_purity_percent: number | null;
  coa_net_content_mg: number | null;
  coa_tested_at: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  price: number;
  sort_order: number;
  // Units on hand for this exact product+size. 0 means "out of stock —
  // coming soon" on the storefront — see /admin/inventory, where staff set
  // this by hand, and 0011_inventory.sql's decrement_variant_stock(), which
  // lowers it automatically every time a real order finalizes.
  stock: number;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
}

// A single line the cart keeps client-side (see lib/cart/CartContext.tsx).
// A "reward" line (redeemed with points) is always unitPrice 0, qty 1, and
// carries the id of the point_transactions row that reserved the points for
// it — that id is what lets removing it from the cart refund those points,
// and what lets checkout link the reservation to the finished order.
export interface CartLine {
  productId: string;
  productName: string;
  size: string;
  unitPrice: number;
  qty: number;
  isReward?: boolean;
  pointsCost?: number;
  pointTransactionId?: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  tracking_number: string | null;
  subtotal: number;
  waiver_accepted_at: string;
  created_at: string;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_email: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  discount_code: string | null;
  discount_percent: number;
  // Null only for orders placed before 0005_discount_codes.sql — treat a
  // null total as "same as subtotal" (no discount existed yet).
  total: number | null;
  // How many points were spent redeeming this specific order for a free
  // vial. 0 for every normal, paid-for order.
  points_redeemed: number;
  // Flat shipping charge for this order — 0 if it hit the free-shipping
  // threshold. `total` keeps meaning "product cost after discount" (so
  // Revenue Reports/Affiliate Sales don't need to change); what the
  // customer actually paid is total + shipping_fee. See
  // src/lib/shipping/rate.ts.
  shipping_fee: number;
  // 'card' (Whop) or 'zelle'. Defaults to 'card' for every order placed
  // before this column existed.
  payment_method: PaymentMethod;
  // How much the 5% Zelle discount knocked off (total + shipping_fee) for
  // this order. Always 0 for a 'card' order. Subtract this from
  // total + shipping_fee to get what the customer actually owes/paid via
  // Zelle — see src/app/api/checkout/zelle/route.ts.
  zelle_discount_amount: number;
}

// A single row in a customer's points ledger — see 0007_points.sql and
// 0008_points_redeem_to_cart.sql. Balance is always the sum of a user's
// rows here (voided or not — see the `voided` doc comment in the
// migration), never a stored counter.
export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  type: "earned" | "redeemed";
  order_id: string | null;
  description: string | null;
  // True once a reserved-but-not-yet-checked-out redemption has been
  // refunded (removed from the cart). Guards against refunding the same
  // reservation twice — see /api/points/refund.
  voided: boolean;
  created_at: string;
}

// A discount code staff create/manage from /admin/discounts.
export interface DiscountCode {
  id: string;
  code: string;
  percent_off: number;
  is_active: boolean;
  created_at: string;
}

// The shipping details collected at checkout — same shape whether the order
// came from the real cart or the manual test-order form.
export interface ShippingDetails {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  size: string;
  qty: number;
  unit_price: number;
  // The real product_variants row's product id, resolved once at
  // order-creation time (see resolveVariant.ts). Null only for order_items
  // rows created before 0013_zelle_payments.sql added this column.
  product_id: string | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

// An application submitted from the public /affiliates signup page, and
// reviewed by staff on /admin/affiliate-signups.
export interface AffiliateSignup {
  id: string;
  first_name: string;
  last_name: string;
  instagram_handle: string;
  email: string;
  preferred_code: string;
  contacted: boolean;
  created_at: string;
}

// A checkout in flight through Whop — see 0010_whop_checkout.sql and
// src/app/api/checkout/whop/route.ts. Frozen pricing, not recomputed once
// the webhook finalizes it into a real order.
export interface PendingCheckout {
  id: string;
  user_id: string;
  items: {
    productId: string;
    productName: string;
    size: string;
    qty: number;
    unitPrice: number;
    pointTransactionId?: string;
  }[];
  shipping: ShippingDetails;
  discount_code: string | null;
  discount_percent: number;
  subtotal: number;
  shipping_fee: number;
  total: number;
  points_redeemed: number;
  reward_tx_ids: string[];
  status: "pending" | "completed" | "failed";
  whop_checkout_id: string | null;
  created_at: string;
}

// Shape the cart posts to checkout — see src/app/api/checkout/whop/route.ts
export interface NewOrderPayload {
  items: {
    // For a normal paid line this is the product's id (product_variants is
    // then looked up by productId + size). For a reward line redeemed with
    // points this is actually the *variant's* id instead — see
    // RedeemProductGrid.tsx, which only ever has the variant id on hand
    // when it builds the cart line. src/lib/inventory/resolveVariant.ts is
    // what untangles the two shapes back into one real variant either way.
    productId: string;
    productName: string;
    size: string;
    qty: number;
    unitPrice: number;
    // Present only for a reward line redeemed with points. The API looks
    // this transaction up itself and forces the item's price to $0 server
    // side — a tampered unitPrice in the request body is never trusted for
    // a reward line, same reasoning as the discount code below.
    pointTransactionId?: string;
  }[];
  shipping: ShippingDetails;
  // Optional — only the code string is trusted from the client. The API
  // route looks the code up itself and derives the percent server-side, so
  // a tampered/forged percentage in the request body can never be honored.
  discountCode?: string;
}
