import type { SegmentGroup } from '@/lib/types/segment';
import { matchesGroups } from '@/lib/segments/evaluator';
import { readJsonFile } from './json-storage';

export interface FileBasedSegmentStatsOptions {
  segmentId?: string;
  conditionGroups?: SegmentGroup[];
  storeId?: string;
  forceRefresh?: boolean;
}

export interface FileBasedSegmentStats {
  customerCount: number;
  totalValue: number;
  totalOrders: number;
  avgOrderValue: number;
  lastUpdated: number;
}

/**
 * Calculate segment stats from file-based customer data
 * No Shopify API dependency - pure file-based calculation
 */
export async function calculateSegmentStatsFromFiles(
  options: FileBasedSegmentStatsOptions
): Promise<FileBasedSegmentStats> {
  try {
    // Read customers from file
    const customers = readJsonFile<any>('customers.json');
    
    if (!customers || customers.length === 0) {
      // No customers in file - return zeros
      return {
        customerCount: 0,
        totalValue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        lastUpdated: Date.now(),
      };
    }

    const conditionGroups = options.conditionGroups || [];
    const hasConditions = conditionGroups.length > 0 && 
      conditionGroups.some(group => (group.conditions || []).length > 0);

    // Filter customers based on segment conditions
    let filteredCustomers = customers;
    
    if (hasConditions) {
      console.log('[SegmentStats] Filtering customers with conditions:', {
        conditionGroupsCount: conditionGroups.length,
        conditions: conditionGroups.map(g => ({
          operator: g.groupOperator,
          conditions: g.conditions?.map(c => ({ field: c.field, operator: c.operator, value: c.value })),
        })),
      });
      
      // Normalize customer format for evaluator (convert to ShopifyCustomer-like format)
      const normalizedCustomers = customers.map((customer: any) => {
        return {
          ...customer,
          // Map common field variations to Shopify format
          first_name: customer.firstName || customer.first_name || '',
          last_name: customer.lastName || customer.last_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          total_spent: customer.totalSpent || customer.total_spent || customer.total_spending || 0,
          orders_count: customer.ordersCount || customer.orders_count || customer.total_orders || 0,
          tags: customer.tags || '',
          created_at: customer.createdAt || customer.created_at,
          updated_at: customer.lastOrderDate || customer.updated_at || customer.createdAt,
          accepts_marketing: customer.acceptsMarketing !== undefined ? customer.acceptsMarketing : true,
          verified_email: customer.emailVerified !== undefined ? customer.emailVerified : false,
        };
      });
      
      // Filter using normalized customers (for evaluator compatibility)
      const matchingIndices: number[] = [];
      normalizedCustomers.forEach((normalizedCustomer: any, index: number) => {
        try {
          const matches = matchesGroups(normalizedCustomer, conditionGroups);
          if (matches) {
            matchingIndices.push(index);
            console.log('[SegmentStats] Customer matches:', { id: normalizedCustomer.id, email: normalizedCustomer.email });
          }
        } catch (error) {
          console.warn('[SegmentStats] Failed to evaluate customer', normalizedCustomer.id, error);
        }
      });
      
      // Use original customer data (not normalized) for calculations
      filteredCustomers = matchingIndices.map(index => customers[index]);
      
      console.log('[SegmentStats] Filtered customers:', {
        total: customers.length,
        filtered: filteredCustomers.length,
      });
    } else {
      console.log('[SegmentStats] No conditions - using all customers');
      filteredCustomers = customers;
    }

    // Calculate metrics from filtered customers (using original data)
    const customerCount = filteredCustomers.length;
    
    console.log('[SegmentStats] Calculating metrics:', {
      customerCount,
      customersToProcess: filteredCustomers.length,
    });
    
    // Calculate total value from customer spending (use original customer data)
    const totalValue = filteredCustomers.reduce((sum: number, customer: any) => {
      // Try different possible field names for total spent
      const spent = parseFloat(
        String(customer.total_spent || 
        customer.totalSpent || 
        customer.total_spending ||
        customer.revenue ||
        0)
      );
      return sum + (isNaN(spent) ? 0 : spent);
    }, 0);

    // Calculate total orders
    const totalOrders = filteredCustomers.reduce((sum: number, customer: any) => {
      const orders = parseInt(
        customer.orders_count || 
        customer.ordersCount || 
        customer.total_orders ||
        0
      );
      return sum + (isNaN(orders) ? 0 : orders);
    }, 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

    const result = {
      customerCount,
      totalValue,
      totalOrders,
      avgOrderValue,
      lastUpdated: Date.now(),
    };
    
    console.log('[SegmentStats] Calculated stats:', result);
    
    return result;
  } catch (error) {
    console.error('[SegmentStats] Error calculating from files:', error);
    // Return zeros on error
    return {
      customerCount: 0,
      totalValue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      lastUpdated: Date.now(),
    };
  }
}

