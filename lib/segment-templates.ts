import { SegmentTemplate } from './types/segment';

export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  {
    id: 'vip_customers',
    name: 'VIP Customers',
    description: 'Customers who spent more than $1000',
    icon: '👑',
    conditionGroups: [{
      id: 'group1',
      conditions: [{
        id: 'cond1',
        field: 'total_spent',
        operator: 'greater_than',
        value: 1000,
        logicalOperator: 'AND',
      }],
      groupOperator: 'AND',
    }],
  },
  {
    id: 'new_customers',
    name: 'New Customers',
    description: 'Customers who joined in last 30 days',
    icon: '🆕',
    conditionGroups: [{
      id: 'group1',
      conditions: [{
        id: 'cond1',
        field: 'first_order_date',
        operator: 'in_last_days',
        value: 30,
        logicalOperator: 'AND',
      }],
      groupOperator: 'AND',
    }],
  },
  {
    id: 'at_risk',
    name: 'At Risk Customers',
    description: 'Haven\'t ordered in 90 days',
    icon: '⚠️',
    conditionGroups: [{
      id: 'group1',
      conditions: [{
        id: 'cond1',
        field: 'days_since_last_order',
        operator: 'greater_than',
        value: 90,
        logicalOperator: 'AND',
      }],
      groupOperator: 'AND',
    }],
  },
  {
    id: 'repeat_customers',
    name: 'Repeat Customers',
    description: 'Placed 2 or more orders',
    icon: '🔁',
    conditionGroups: [{
      id: 'group1',
      conditions: [{
        id: 'cond1',
        field: 'total_orders',
        operator: 'greater_than',
        value: 1,
        logicalOperator: 'AND',
      }],
      groupOperator: 'AND',
    }],
  },
  {
    id: 'cart_abandoners',
    name: 'Cart Abandoners',
    description: 'Customers with abandoned carts',
    icon: '🛒',
    conditionGroups: [{
      id: 'group1',
      conditions: [{
        id: 'cond1',
        field: 'cart_abandoned',
        operator: 'equals',
        value: 'true',
        logicalOperator: 'AND',
      }],
      groupOperator: 'AND',
    }],
  },
];

