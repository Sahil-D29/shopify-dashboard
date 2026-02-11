export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;

  // Order stats
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: number;
  firstOrderDate?: number;

  // Engagement
  tags: string[];
  acceptsMarketing: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;

  // Location
  country?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // Lifecycle
  customerSince: number;
  lifetimeValue: number;
  orderFrequency?: 'first-time' | 'repeat' | 'loyal';
  riskLevel?: 'low' | 'medium' | 'high';

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;

  // Segment info
  segments?: string[];
}

export interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  totalRevenue: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
  churnRate: number;
}


