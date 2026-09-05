// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you add columns/tables later, update this file to match — or generate
// it automatically with `supabase gen types typescript`.

export type OrderStatus = "Processing" | "Shipped" | "Delivered";

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
  is_active: boolean;
  created_at: string;
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
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  size: string;
  qty: number;
  unit_price: number;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

// Shape the checkout form/API posts — see src/app/api/orders/route.ts
export interface NewOrderPayload {
  items: { productName: string; size: string; qty: number; unitPrice: number }[];
}
