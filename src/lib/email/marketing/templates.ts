// The rotating marketing emails. One goes out per campaign (every 2 days by
// default), in this order, then it starts over. To change what's sent, edit
// the text below, add a new entry, or reorder them — no database change
// needed.
//
// Keep it compliant: these are research-use-only products, so never describe
// what a compound does to a person, never mention dosing or human use, and
// never promise results. Offers, prices, shipping and testing facts only.
import { FREE_BAC_THRESHOLD } from "@/lib/promotions/freeBacWater";
import { BULK_TIERS } from "@/lib/promotions/bulkPricing";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/rate";
import {
  LOCAL_DELIVERY_ORIGIN_LABEL,
  LOCAL_DELIVERY_RADIUS_MILES,
  LOCAL_DELIVERY_TIMEFRAME,
} from "@/lib/shipping/localDeliveryConfig";

export interface MarketingTemplate {
  key: string;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  ctaLabel: string;
  // Path on shoprealaminos.com the button goes to.
  ctaPath: string;
}

const bulkBullets = BULK_TIERS.map((t, i) => {
  const next = BULK_TIERS[i + 1];
  const range = next ? (next.minQty - 1 === t.minQty ? `${t.minQty} units` : `${t.minQty}–${next.minQty - 1} units`) : `${t.minQty}+ units`;
  return `${range}: ${t.percentOff}% off each`;
});

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    key: "free-bac-water",
    subject: `Free bacteriostatic water with every $${FREE_BAC_THRESHOLD} you spend`,
    preheader: `Spend $${FREE_BAC_THRESHOLD}, add a free bacteriostatic water at checkout.`,
    heading: "A free bacteriostatic water on us",
    paragraphs: [
      `For every $${FREE_BAC_THRESHOLD} you spend at RealAminos, you can add a free bacteriostatic water to your order. Spend $${FREE_BAC_THRESHOLD * 2} and you can add two.`,
      "Once your cart qualifies, you'll see a card in your cart with a button to add it. It's applied before you pay.",
    ],
    ctaLabel: "Shop now",
    ctaPath: "/shop/all",
  },
  {
    key: "bulk-pricing",
    subject: "The more you buy, the less each one costs",
    preheader: "Quantity discounts on every product, applied automatically in your cart.",
    heading: "Quantity discounts on everything",
    paragraphs: ["Buy more of the same product and size, and every unit gets cheaper. The discount is applied automatically in your cart:"],
    bullets: bulkBullets,
    ctaLabel: "See the catalog",
    ctaPath: "/shop/all",
  },
  {
    key: "coming-soon",
    subject: "New research compounds are on the way",
    preheader: "Wolverine Blend, KLOW, GLOW, CJC-1295 (no DAC), MOTS-c and GLP3 (RT) are coming to the catalog.",
    heading: "Expanding the catalog",
    paragraphs: [
      "Our beta launch went well, and we're adding to the catalog. These are coming soon:",
    ],
    bullets: [
      "Wolverine Blend 10 mg",
      "KLOW 80 mg",
      "GLOW 70 mg",
      "CJC-1295 (no DAC) 5 mg",
      "MOTS-c 10 mg",
      "GLP3 (RT) 20 mg",
    ],
    ctaLabel: "See what's coming",
    ctaPath: "/shop/all",
  },
  {
    key: "free-shipping",
    subject: `Free shipping on orders over $${FREE_SHIPPING_THRESHOLD}`,
    preheader: `Your order ships free when your product total reaches $${FREE_SHIPPING_THRESHOLD}.`,
    heading: "Free shipping at $" + FREE_SHIPPING_THRESHOLD,
    paragraphs: [
      `Orders with a product total of $${FREE_SHIPPING_THRESHOLD} or more ship free. Stack it with quantity discounts and a free bacteriostatic water with every $${FREE_BAC_THRESHOLD}, and a bigger order goes a long way.`,
    ],
    ctaLabel: "Start an order",
    ctaPath: "/shop/all",
  },
  {
    key: "local-delivery",
    subject: "Free local delivery in Arizona",
    preheader: `${LOCAL_DELIVERY_TIMEFRAME} delivery within ${LOCAL_DELIVERY_RADIUS_MILES} miles of ${LOCAL_DELIVERY_ORIGIN_LABEL}.`,
    heading: "Free local delivery",
    paragraphs: [
      `Live in Arizona within ${LOCAL_DELIVERY_RADIUS_MILES} miles of ${LOCAL_DELIVERY_ORIGIN_LABEL}? We deliver your order ourselves, free, ${LOCAL_DELIVERY_TIMEFRAME.toLowerCase()}.`,
      "Choose local delivery at checkout. We'll confirm your address qualifies before you pay.",
    ],
    ctaLabel: "Order for local delivery",
    ctaPath: "/shop/all",
  },
  {
    key: "testing",
    subject: "Check the Certificate of Analysis before you order",
    preheader: "Lot-specific test results are on our product pages.",
    heading: "Know what's in the vial",
    paragraphs: [
      "We publish a Certificate of Analysis for the lot of each research compound we stock, so you can review the testing before you buy. Look for the COA on the product page.",
      "Questions about a lot or a result? Just reply to this email.",
    ],
    ctaLabel: "Browse products",
    ctaPath: "/shop/all",
  },
  {
    key: "payment-options",
    subject: "Pay the way you prefer: card, Zelle or Bitcoin",
    preheader: "Three ways to pay at checkout.",
    heading: "Your choice of payment",
    paragraphs: [
      "At checkout you can pay by card, by Zelle, or with Bitcoin. Same prices on all three. Pick whichever is easiest for you.",
    ],
    ctaLabel: "Shop now",
    ctaPath: "/shop/all",
  },
  {
    key: "points",
    subject: "You earn points on every order",
    preheader: "Points from your orders can be redeemed toward free products.",
    heading: "Points on every order",
    paragraphs: [
      "Every order earns points on your RealAminos account, and points can be redeemed toward free products at checkout. Sign in to see your balance.",
    ],
    ctaLabel: "See what you can redeem",
    ctaPath: "/shop/all",
  },
  {
    key: "affiliates",
    subject: "Earn with the RealAminos affiliate program",
    preheader: "Get your own discount code to share.",
    heading: "Become an affiliate",
    paragraphs: [
      "Run a page or community? Apply to the RealAminos affiliate program for your own discount code to share with your audience.",
    ],
    ctaLabel: "Apply now",
    ctaPath: "/affiliates",
  },
];
