export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
  tags: string;
}

export interface Order {
  id: number;
  order_number: number;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: LineItem[];
  gateway: string;
}

export interface LineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  product_id: number;
}

export interface Product {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string;
  status: string;
  variants: ProductVariant[];
  images: ProductImage[];
  tags: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  inventory_management: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  src: string;
  width: number;
  height: number;
}

export interface AbandonedCheckout {
  id: number;
  token: string;
  cart_token: string;
  email: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_checkout_url: string;
  line_items: LineItem[];
  total_price: string;
  currency: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  abandonedCarts: number;
  abandonedCartsValue: number;
  revenueGrowth: number;
  ordersGrowth: number;
}

// Segment types
export interface SegmentFilter {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | number[] | [number, number];
  logicalOperator?: 'AND' | 'OR';
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  filters: {
    operator: 'AND' | 'OR';
    conditions: SegmentFilter[];
  };
  customerCount?: number;
  createdAt: Date;
  updatedAt: Date;
  lastCalculated?: Date;
}

export interface SegmentPreview {
  count: number;
  customers: Array<{
    id: number;
    name: string;
    email: string;
  }>;
}
