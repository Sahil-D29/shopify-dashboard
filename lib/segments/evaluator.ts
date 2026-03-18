import type { SegmentGroup, SegmentCondition, TimeWindow } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { ShopifyOrder } from '@/lib/types/shopify-order';

export interface CampaignLogEnrichment {
  totalReceived: number;
  totalOpened: number;
  totalClicked: number;
  lastMessageSentAt: number | null;
  lastCampaignId: string | null;
  lastTemplateId: string | null;
  // Extended campaign log details for sub-filters and per-campaign filtering
  logs?: Array<{
    campaignId: string;
    campaignName?: string;
    templateName?: string;
    campaignType?: string;
    status: string;
    createdAt: number;
    readAt: number | null;
    clickedAt: number | null;
    convertedAt: number | null;
    convertedAmount: number | null;
  }>;
}

export interface AbandonedCheckoutEnrichment {
  count: number;
  lastAbandonedAt: number | null;
}

export interface RFMEnrichment {
  recency: number;
  frequency: number;
  monetary: number;
}

export interface StorefrontEventEnrichment {
  productViewed: boolean;
  viewedProductIds: string[];
  productAddedToCart: boolean;
  addedToCartProductIds: string[];
  collectionViewed: boolean;
}

export interface JourneyEnrichment {
  enrollments: Array<{
    journeyId: string;
    journeyName?: string;
    status: string;
    currentNode: string | null;
    enrolledAt: number;
    completedAt: number | null;
  }>;
}

export interface FlowEnrichment {
  responses: Array<{
    flowId: string;
    flowName?: string;
    completedAt: number | null;
    responseData: Record<string, unknown>;
    createdAt: number;
  }>;
}

export interface ConversationEnrichment {
  conversations: Array<{
    id: string;
    status: string;
    assignedTo: string | null;
    lastMessageAt: number | null;
    closedAt: number | null;
    unreadCount: number;
  }>;
  totalInbound: number;
  totalOutbound: number;
  avgResponseTimeMinutes: number | null;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  lastMessageStatus: string | null;
}

export interface ContactEnrichment {
  source: string;
  optInStatus: string;
  optInAt: number | null;
  customFields: Record<string, unknown>;
  tags: string[];
  createdAt: number;
  shopifyCustomerId: string | null;
  email: string | null;
  phone: string | null;
}

export interface CustomerEnrichment {
  orders?: ShopifyOrder[];
  campaignLogs?: CampaignLogEnrichment;
  abandonedCheckouts?: AbandonedCheckoutEnrichment;
  rfm?: RFMEnrichment;
  storefrontEvents?: StorefrontEventEnrichment;
  journeys?: JourneyEnrichment;
  flows?: FlowEnrichment;
  conversations?: ConversationEnrichment;
  contact?: ContactEnrichment;
}

function getPrimaryAddress(customer: ShopifyCustomer) {
  if (!customer.addresses || customer.addresses.length === 0) return undefined;
  const def = customer.addresses.find(a => a.default);
  return def || customer.addresses[0];
}

type ConditionPrimitive = string | number | boolean | null | undefined;
type ConditionValue = ConditionPrimitive | ConditionPrimitive[];

const isString = (value: unknown): value is string => typeof value === 'string';
const normalizeString = (value: unknown): string | undefined =>
  isString(value) ? value.toLowerCase() : undefined;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toTimestamp = (value: unknown): number | undefined => {
  const date = value instanceof Date ? value : value ? new Date(String(value)) : null;
  const timestamp = date?.getTime();
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : undefined;
};

function timeWindowToMs(tw: TimeWindow): number {
  switch (tw.unit) {
    case 'days': return tw.amount * 86400000;
    case 'weeks': return tw.amount * 7 * 86400000;
    case 'months': return tw.amount * 30 * 86400000;
  }
}

function getFieldValue(customer: ShopifyCustomer, field: string, enrichment?: CustomerEnrichment): ConditionValue {
  const addr = getPrimaryAddress(customer);
  switch (field) {
    // ─── Customer Attributes ───
    case 'customer_name':
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    case 'customer_email':
      return customer.email || '';
    case 'customer_phone':
      return customer.phone || '';
    case 'customer_tags':
      return customer.tags || '';
    case 'location_country':
      return addr?.country || '';
    case 'location_city':
      return addr?.city || '';
    case 'location_state':
      return addr?.province || '';
    case 'location_postal_code':
      return addr?.zip || '';
    case 'location_address':
      return addr ? `${(addr as any).address1 || ''} ${(addr as any).address2 || ''}`.trim() : '';
    case 'customer_since':
      return customer.created_at ? new Date(customer.created_at).getTime() : undefined;
    case 'marketing_opt_in':
    case 'accepts_marketing':
      return !!(customer as any).accepts_marketing || !!(customer as any).verified_email;
    case 'sms_opt_in':
      return false;
    case 'email_opt_in':
      return !!(customer as any).accepts_marketing || !!(customer as any).verified_email;

    // ─── Order History ───
    case 'total_orders':
      return Number(customer.orders_count || 0);
    case 'total_spent':
      return Number(customer.total_spent || 0);
    case 'average_order_value': {
      const orders = Number(customer.orders_count || 0);
      const spent = Number(customer.total_spent || 0);
      return orders > 0 ? spent / orders : 0;
    }
    case 'first_order_date': {
      if (enrichment?.orders?.length) {
        const sorted = [...enrichment.orders].sort((a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
        return sorted[0]?.created_at ? new Date(sorted[0].created_at).getTime() : undefined;
      }
      return customer.created_at ? new Date(customer.created_at).getTime() : undefined;
    }
    case 'last_order_date': {
      if (enrichment?.orders?.length) {
        const sorted = [...enrichment.orders].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        return sorted[0]?.created_at ? new Date(sorted[0].created_at).getTime() : undefined;
      }
      return customer.updated_at ? new Date(customer.updated_at).getTime() : undefined;
    }
    case 'days_since_last_order': {
      let lastOrderTs = 0;
      if (enrichment?.orders?.length) {
        const sorted = [...enrichment.orders].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        lastOrderTs = sorted[0]?.created_at ? new Date(sorted[0].created_at).getTime() : 0;
      } else {
        lastOrderTs = customer.updated_at ? new Date(customer.updated_at).getTime() : 0;
      }
      return lastOrderTs > 0 ? Math.floor((Date.now() - lastOrderTs) / 86400000) : 999;
    }
    case 'orders_in_last_x_days': {
      if (!enrichment?.orders?.length) return Number(customer.orders_count || 0);
      const now = Date.now();
      return enrichment.orders.filter(o => {
        const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
        return ts > 0 && (now - ts) < 86400000 * 365;
      }).length;
    }
    case 'total_items_purchased': {
      if (!enrichment?.orders?.length) return 0;
      return enrichment.orders.reduce((sum, order) => {
        return sum + (order.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0);
      }, 0);
    }
    case 'favorite_product_category':
      return '';
    case 'never_ordered':
      return Number(customer.orders_count || 0) === 0;
    case 'ordered_specific_product': {
      if (!enrichment?.orders?.length) return false;
      const allProducts = enrichment.orders.flatMap(o =>
        (o.line_items || []).map(li => li.title || li.name || '')
      );
      return allProducts.join(',');
    }
    case 'ordered_from_collection':
      return false;

    // ─── Advanced Order Filters ───
    case 'ordered_product_vendor': {
      if (!enrichment?.orders?.length) return '';
      const vendors = enrichment.orders.flatMap(o =>
        (o.line_items || []).map(li => (li as any).vendor || '')
      );
      return vendors.join(',');
    }
    case 'ordered_product_type': {
      if (!enrichment?.orders?.length) return '';
      const types = enrichment.orders.flatMap(o =>
        (o.line_items || []).map(li => (li as any).product_type || '')
      );
      return types.join(',');
    }
    case 'order_discount_code': {
      if (!enrichment?.orders?.length) return '';
      const codes = enrichment.orders.flatMap(o =>
        ((o as any).discount_codes || []).map((d: any) => d.code || '')
      );
      return codes.join(',');
    }
    case 'order_shipping_method': {
      if (!enrichment?.orders?.length) return '';
      const methods = enrichment.orders.flatMap(o =>
        ((o as any).shipping_lines || []).map((s: any) => s.title || '')
      );
      return methods.join(',');
    }
    case 'order_payment_method': {
      if (!enrichment?.orders?.length) return '';
      const gateways = enrichment.orders.flatMap(o =>
        (o as any).payment_gateway_names || []
      );
      return gateways.join(',');
    }
    case 'order_fulfillment_status': {
      if (!enrichment?.orders?.length) return '';
      return enrichment.orders[0]?.fulfillment_status || 'unfulfilled';
    }
    case 'order_financial_status': {
      if (!enrichment?.orders?.length) return '';
      return enrichment.orders[0]?.financial_status || '';
    }
    case 'clv_tier': {
      const totalSpent = Number(customer.total_spent || 0);
      if (totalSpent >= 10000) return 'premium';
      if (totalSpent >= 5000) return 'high';
      if (totalSpent >= 1000) return 'medium';
      return 'low';
    }
    case 'repeat_product_buyer': {
      if (!enrichment?.orders?.length) return false;
      const productCounts = new Map<string, number>();
      for (const order of enrichment.orders) {
        for (const li of order.line_items || []) {
          const key = li.title || li.name || '';
          if (key) productCounts.set(key, (productCounts.get(key) || 0) + 1);
        }
      }
      return Array.from(productCounts.values()).some(c => c >= 2);
    }
    case 'order_currency': {
      if (!enrichment?.orders?.length) return '';
      return (enrichment.orders[0] as any).currency || '';
    }

    // ─── WhatsApp Channel ───
    case 'wa_last_message_status':
      return enrichment?.conversations?.lastMessageStatus || '';
    case 'wa_conversation_state': {
      const convos = enrichment?.conversations?.conversations || [];
      const open = convos.find(c => c.status === 'OPEN');
      return open ? 'OPEN' : convos.length > 0 ? convos[0].status : '';
    }
    case 'wa_reply_rate': {
      const totalIn = enrichment?.conversations?.totalInbound ?? 0;
      const totalOut = enrichment?.conversations?.totalOutbound ?? 0;
      if (totalOut === 0) return 0;
      return Math.round((totalIn / totalOut) * 100);
    }
    case 'wa_avg_response_time':
      return enrichment?.conversations?.avgResponseTimeMinutes ?? 0;
    case 'wa_has_active_conversation': {
      const convos = enrichment?.conversations?.conversations || [];
      return convos.some(c => c.status === 'OPEN');
    }
    case 'wa_message_frequency':
      return (enrichment?.conversations?.totalInbound ?? 0) + (enrichment?.conversations?.totalOutbound ?? 0);
    case 'wa_last_inbound_message':
      return enrichment?.conversations?.lastInboundAt ?? undefined;
    case 'wa_last_outbound_message':
      return enrichment?.conversations?.lastOutboundAt ?? undefined;
    case 'wa_total_conversations':
      return enrichment?.conversations?.conversations?.length ?? 0;
    case 'wa_opted_in':
      return enrichment?.contact?.optInStatus === 'OPTED_IN';
    case 'wa_opt_in_date':
      return enrichment?.contact?.optInAt ?? undefined;
    case 'wa_contact_source':
      return enrichment?.contact?.source || '';

    // ─── Campaign Performance ───
    case 'campaign_received_specific':
      return enrichment?.campaignLogs?.lastCampaignId || '';
    case 'campaign_opened_specific': {
      const logs = enrichment?.campaignLogs?.logs || [];
      const opened = logs.filter(l => l.readAt !== null);
      return opened.length > 0 ? opened.map(l => l.campaignId).join(',') : '';
    }
    case 'campaign_clicked_specific': {
      const logs = enrichment?.campaignLogs?.logs || [];
      const clicked = logs.filter(l => l.clickedAt !== null);
      return clicked.length > 0 ? clicked.map(l => l.campaignId).join(',') : '';
    }
    case 'campaign_converted_specific': {
      const logs = enrichment?.campaignLogs?.logs || [];
      const converted = logs.filter(l => l.convertedAt !== null);
      return converted.length > 0 ? converted.map(l => l.campaignId).join(',') : '';
    }
    case 'campaign_total_received':
      return enrichment?.campaignLogs?.totalReceived ?? 0;
    case 'campaign_never_received':
      return (enrichment?.campaignLogs?.totalReceived ?? 0) === 0;
    case 'campaign_last_received_date':
      return enrichment?.campaignLogs?.lastMessageSentAt ?? undefined;
    case 'campaign_delivery_rate': {
      const total = enrichment?.campaignLogs?.totalReceived ?? 0;
      if (total === 0) return 0;
      const logs = enrichment?.campaignLogs?.logs || [];
      const delivered = logs.filter(l => l.status === 'DELIVERED' || l.status === 'READ' || l.status === 'CLICKED').length;
      return Math.round((delivered / total) * 100);
    }
    case 'campaign_read_rate': {
      const total = enrichment?.campaignLogs?.totalReceived ?? 0;
      if (total === 0) return 0;
      return Math.round(((enrichment?.campaignLogs?.totalOpened ?? 0) / total) * 100);
    }
    case 'campaign_last_converted_at': {
      const logs = enrichment?.campaignLogs?.logs || [];
      const converted = logs.filter(l => l.convertedAt !== null).sort((a, b) => (b.convertedAt || 0) - (a.convertedAt || 0));
      return converted[0]?.convertedAt ?? undefined;
    }

    // ─── Journey Status ───
    case 'journey_completed_specific': {
      const completed = (enrichment?.journeys?.enrollments || []).filter(e => e.status === 'COMPLETED');
      return completed.length > 0 ? completed.map(e => e.journeyId).join(',') : '';
    }
    case 'journey_active_in': {
      const active = (enrichment?.journeys?.enrollments || []).filter(e => e.status === 'ACTIVE');
      return active.length > 0 ? active.map(e => e.journeyId).join(',') : '';
    }
    case 'journey_dropped_off': {
      const dropped = (enrichment?.journeys?.enrollments || []).filter(e => e.status === 'FAILED' || e.status === 'DROPPED');
      return dropped.length > 0 ? dropped.map(e => e.journeyId).join(',') : '';
    }
    case 'journey_enrollment_count':
      return enrichment?.journeys?.enrollments?.length ?? 0;
    case 'journey_completion_rate': {
      const enrollments = enrichment?.journeys?.enrollments || [];
      if (enrollments.length === 0) return 0;
      const completed = enrollments.filter(e => e.status === 'COMPLETED').length;
      return Math.round((completed / enrollments.length) * 100);
    }
    case 'journey_enrolled_date': {
      const enrollments = enrichment?.journeys?.enrollments || [];
      if (enrollments.length === 0) return undefined;
      const sorted = [...enrollments].sort((a, b) => b.enrolledAt - a.enrolledAt);
      return sorted[0].enrolledAt;
    }
    case 'journey_never_enrolled':
      return (enrichment?.journeys?.enrollments?.length ?? 0) === 0;
    case 'journey_current_node': {
      const active = (enrichment?.journeys?.enrollments || []).find(e => e.status === 'ACTIVE');
      return active?.currentNode || '';
    }

    // ─── Flow Interactions ───
    case 'flow_completed_specific': {
      const completed = (enrichment?.flows?.responses || []).filter(r => r.completedAt !== null);
      return completed.length > 0 ? completed.map(r => r.flowId).join(',') : '';
    }
    case 'flow_started_specific': {
      const started = enrichment?.flows?.responses || [];
      return started.length > 0 ? started.map(r => r.flowId).join(',') : '';
    }
    case 'flow_dropout': {
      const dropped = (enrichment?.flows?.responses || []).filter(r => r.completedAt === null);
      return dropped.length > 0 ? dropped.map(r => r.flowId).join(',') : '';
    }
    case 'flow_response_value': {
      const responses = enrichment?.flows?.responses || [];
      return responses.map(r => JSON.stringify(r.responseData)).join(',');
    }
    case 'flow_total_completed':
      return (enrichment?.flows?.responses || []).filter(r => r.completedAt !== null).length;
    case 'flow_last_interaction': {
      const responses = enrichment?.flows?.responses || [];
      if (responses.length === 0) return undefined;
      return Math.max(...responses.map(r => r.createdAt));
    }

    // ─── Chat & Conversations ───
    case 'chat_has_open_conversation': {
      const convos = enrichment?.conversations?.conversations || [];
      return convos.some(c => c.status === 'OPEN');
    }
    case 'chat_assigned_to_agent': {
      const convos = enrichment?.conversations?.conversations || [];
      const assigned = convos.find(c => c.assignedTo);
      return assigned?.assignedTo || '';
    }
    case 'chat_conversation_count':
      return enrichment?.conversations?.conversations?.length ?? 0;
    case 'chat_avg_resolution_time':
      return enrichment?.conversations?.avgResponseTimeMinutes ? enrichment.conversations.avgResponseTimeMinutes / 60 : 0;
    case 'chat_last_conversation_date': {
      const convos = enrichment?.conversations?.conversations || [];
      if (convos.length === 0) return undefined;
      const maxTs = Math.max(...convos.map(c => c.lastMessageAt ?? 0));
      return maxTs > 0 ? maxTs : undefined;
    }
    case 'chat_unread_count': {
      const convos = enrichment?.conversations?.conversations || [];
      return convos.reduce((sum, c) => sum + c.unreadCount, 0);
    }
    case 'chat_last_closed_date': {
      const convos = enrichment?.conversations?.conversations || [];
      const closed = convos.filter(c => c.closedAt).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
      return closed[0]?.closedAt ?? undefined;
    }

    // ─── Contact Enrichment ───
    case 'contact_created_date':
      return enrichment?.contact?.createdAt ?? undefined;
    case 'contact_custom_field': {
      const fields = enrichment?.contact?.customFields || {};
      return Object.values(fields).join(',');
    }
    case 'contact_has_email':
      return !!(enrichment?.contact?.email || customer.email);
    case 'contact_has_shopify_link':
      return !!enrichment?.contact?.shopifyCustomerId;
    case 'contact_tags': {
      const tags = enrichment?.contact?.tags || [];
      return tags.join(',');
    }
    case 'contact_has_phone':
      return !!(enrichment?.contact?.phone || customer.phone);

    // ─── Engagement (from CampaignLog enrichment) ───
    case 'whatsapp_messages_received':
      return enrichment?.campaignLogs?.totalReceived ?? 0;
    case 'whatsapp_messages_opened':
    case 'campaign_opens':
      return enrichment?.campaignLogs?.totalOpened ?? 0;
    case 'whatsapp_messages_clicked':
    case 'campaign_clicks':
      return enrichment?.campaignLogs?.totalClicked ?? 0;
    case 'last_message_sent':
      return enrichment?.campaignLogs?.lastMessageSentAt ?? undefined;
    case 'engaged_campaign_id':
      return enrichment?.campaignLogs?.lastCampaignId ?? '';
    case 'received_template':
      return enrichment?.campaignLogs?.lastTemplateId ?? '';
    case 'journey_enrollment_status':
    case 'journey_completion_status':
      return '';

    // ─── Behavioral ───
    case 'cart_abandonment_count':
      return enrichment?.abandonedCheckouts?.count ?? 0;
    case 'last_abandoned_cart_date':
      return enrichment?.abandonedCheckouts?.lastAbandonedAt ?? undefined;
    case 'last_seen': {
      const lastMsg = enrichment?.campaignLogs?.lastMessageSentAt ?? 0;
      let lastOrd = 0;
      if (enrichment?.orders?.length) {
        const sorted = [...enrichment.orders].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        lastOrd = sorted[0]?.created_at ? new Date(sorted[0].created_at).getTime() : 0;
      }
      const max = Math.max(lastMsg, lastOrd);
      return max > 0 ? max : undefined;
    }
    case 'website_visits':
    case 'average_session_duration':
      return 0;

    // ─── RFM Analysis ───
    case 'rfm_recency_score':
      return enrichment?.rfm?.recency ?? 0;
    case 'rfm_frequency_score':
      return enrichment?.rfm?.frequency ?? 0;
    case 'rfm_monetary_score':
      return enrichment?.rfm?.monetary ?? 0;
    case 'rfm_segment':
      return '';

    // ─── Predictive ───
    case 'churn_risk': {
      const orderCount = Number(customer.orders_count || 0);
      if (orderCount === 0) return 100;
      let lastOrderTs = 0;
      if (enrichment?.orders?.length) {
        const sorted = [...enrichment.orders].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        lastOrderTs = sorted[0]?.created_at ? new Date(sorted[0].created_at).getTime() : 0;
      } else {
        lastOrderTs = customer.updated_at ? new Date(customer.updated_at).getTime() : 0;
      }
      const daysSince = lastOrderTs > 0 ? Math.floor((Date.now() - lastOrderTs) / 86400000) : 999;
      const customerAge = customer.created_at
        ? Math.max(Math.floor((Date.now() - new Date(customer.created_at).getTime()) / 86400000), 1)
        : 365;
      const avgInterval = customerAge / Math.max(orderCount, 1);
      if (daysSince > avgInterval * 3) return 90;
      if (daysSince > avgInterval * 2) return 70;
      if (daysSince > avgInterval * 1.5) return 50;
      return 20;
    }
    case 'lifetime_value_prediction': {
      const totalSpent = Number(customer.total_spent || 0);
      const numOrders = Number(customer.orders_count || 0);
      if (numOrders === 0) return 0;
      const aov = totalSpent / numOrders;
      const ageInDays = customer.created_at
        ? Math.max(Math.floor((Date.now() - new Date(customer.created_at).getTime()) / 86400000), 1)
        : 365;
      const ordersPerYear = (numOrders / ageInDays) * 365;
      return Math.round(aov * ordersPerYear * 3);
    }
    case 'next_purchase_probability':
      return 0;

    // ─── Shopify Events ───
    case 'event_order_created':
      return (enrichment?.orders?.length ?? Number(customer.orders_count || 0)) > 0;
    case 'event_order_paid':
      return (enrichment?.orders ?? []).some(o => o.financial_status === 'paid');
    case 'event_order_fulfilled':
      return (enrichment?.orders ?? []).some(o => o.fulfillment_status === 'fulfilled');
    case 'event_order_cancelled':
      return (enrichment?.orders ?? []).some(o => (o as any).cancelled_at != null);
    case 'event_order_refunded':
      return (enrichment?.orders ?? []).some(o =>
        o.financial_status === 'refunded' || o.financial_status === 'partially_refunded'
      );
    case 'event_checkout_started':
      return (enrichment?.abandonedCheckouts?.count ?? 0) > 0 || (enrichment?.orders?.length ?? Number(customer.orders_count || 0)) > 0;
    case 'event_checkout_abandoned':
      return (enrichment?.abandonedCheckouts?.count ?? 0) > 0;
    case 'event_customer_created':
      return true;
    case 'event_customer_updated': {
      const updTs = customer.updated_at ? new Date(customer.updated_at).getTime() : 0;
      return updTs > 0 ? updTs : undefined;
    }
    case 'event_product_viewed':
      return enrichment?.storefrontEvents?.productViewed ?? false;
    case 'viewed_product':
      return (enrichment?.storefrontEvents?.viewedProductIds ?? []).join(',');
    case 'event_product_added_to_cart':
      return enrichment?.storefrontEvents?.productAddedToCart ?? false;
    case 'added_product_to_cart':
      return (enrichment?.storefrontEvents?.addedToCartProductIds ?? []).join(',');
    case 'event_collection_viewed':
      return enrichment?.storefrontEvents?.collectionViewed ?? false;
    case 'event_subscription_created':
    case 'event_subscription_renewed':
    case 'event_subscription_cancelled':
      return false;

    // ─── Legacy ───
    case 'purchased_product':
    case 'purchased_category':
    case 'cart_abandoned':
    case 'email_opened':
    case 'email_clicked':
      return false;

    default:
      return undefined;
  }
}

function opCompare(value: ConditionValue, operator: string, target: ConditionValue): boolean {
  const valueLower = normalizeString(value);
  const targetLower = normalizeString(target);

  switch (operator) {
    case 'equals':
      return valueLower !== undefined && targetLower !== undefined ? valueLower === targetLower : value === target;
    case 'not_equals':
      return valueLower !== undefined && targetLower !== undefined ? valueLower !== targetLower : value !== target;
    case 'contains':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.includes(targetLower) : false;
    case 'not_contains':
      return valueLower !== undefined && targetLower !== undefined ? !valueLower.includes(targetLower) : false;
    case 'starts_with':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.startsWith(targetLower) : false;
    case 'ends_with':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.endsWith(targetLower) : false;
    case 'greater_than': {
      const vn = toNumber(value);
      const tn = toNumber(target);
      return vn !== undefined && tn !== undefined && vn > tn;
    }
    case 'less_than': {
      const vn = toNumber(value);
      const tn = toNumber(target);
      return vn !== undefined && tn !== undefined && vn < tn;
    }
    case 'greater_than_or_equal': {
      const vn = toNumber(value);
      const tn = toNumber(target);
      return vn !== undefined && tn !== undefined && vn >= tn;
    }
    case 'less_than_or_equal': {
      const vn = toNumber(value);
      const tn = toNumber(target);
      return vn !== undefined && tn !== undefined && vn <= tn;
    }
    case 'between': {
      const range = Array.isArray(target) ? target : String(target ?? '').split(',');
      if (range.length < 2) return false;
      const [min, max] = range.map(toNumber);
      const vn = toNumber(value);
      return vn !== undefined && min !== undefined && max !== undefined && vn >= min && vn <= max;
    }
    case 'is_empty':
      return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);
    case 'is_not_empty':
      return !(value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0));
    case 'is_true':
      return value === true || value === 'true' || value === 1;
    case 'is_false':
      return value === false || value === 'false' || value === 0 || value === undefined || value === null;
    case 'in_last_days': {
      const days = toNumber(target);
      if (days === undefined) return false;
      const since = Date.now() - days * 86400000;
      const vt = toTimestamp(value);
      return typeof since === 'number' && vt !== undefined && vt >= since;
    }
    case 'in_last_weeks': {
      const weeks = toNumber(target);
      if (weeks === undefined) return false;
      const since = Date.now() - weeks * 7 * 86400000;
      const vt = toTimestamp(value);
      return vt !== undefined && vt >= since;
    }
    case 'in_last_months': {
      const months = toNumber(target);
      if (months === undefined) return false;
      const since = Date.now() - months * 30 * 86400000;
      const vt = toTimestamp(value);
      return vt !== undefined && vt >= since;
    }
    case 'before_date':
      return (toTimestamp(value) ?? Number.POSITIVE_INFINITY) < (toTimestamp(target) ?? Number.NEGATIVE_INFINITY);
    case 'after_date':
      return (toTimestamp(value) ?? Number.NEGATIVE_INFINITY) > (toTimestamp(target) ?? Number.POSITIVE_INFINITY);
    case 'in': {
      const list = Array.isArray(target) ? target : String(target ?? '').split(',').map(s => s.trim());
      const v = normalizeString(value) ?? String(value ?? '');
      return list.some(item => normalizeString(item) === v || String(item) === String(value));
    }
    case 'not_in': {
      const list = Array.isArray(target) ? target : String(target ?? '').split(',').map(s => s.trim());
      const v = normalizeString(value) ?? String(value ?? '');
      return !list.some(item => normalizeString(item) === v || String(item) === String(value));
    }
    default:
      return false;
  }
}

/** Get the underlying collection for fields that support sub-filters */
function getFieldCollection(
  customer: ShopifyCustomer,
  field: string,
  enrichment?: CustomerEnrichment
): Array<Record<string, unknown>> | null {
  switch (field) {
    // Order-based fields return order line items
    case 'ordered_specific_product':
    case 'ordered_from_collection':
    case 'ordered_product_vendor':
    case 'ordered_product_type':
    case 'order_discount_code': {
      if (!enrichment?.orders?.length) return null;
      return enrichment.orders.flatMap(order =>
        (order.line_items || []).map(li => ({
          product_name: li.title || li.name || '',
          product_price: Number(li.price || 0),
          product_vendor: (li as any).vendor || '',
          product_type: (li as any).product_type || '',
          order_total: Number((order as any).total_price || 0),
          discount_code: ((order as any).discount_codes || []).map((d: any) => d.code).join(','),
          quantity: li.quantity || 0,
          sku: (li as any).sku || '',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          timestamp: order.created_at ? new Date(order.created_at).getTime() : 0,
        }))
      );
    }
    // Campaign-based fields return campaign log entries
    case 'campaign_received_specific':
    case 'campaign_opened_specific':
    case 'campaign_clicked_specific':
    case 'campaign_converted_specific': {
      const logs = enrichment?.campaignLogs?.logs || [];
      return logs.map(l => ({
        template_name: l.templateName || '',
        campaign_type: l.campaignType || '',
        send_date: l.createdAt,
        delivery_status: l.status,
        timestamp: l.createdAt,
      }));
    }
    // Journey-based fields return enrollment entries
    case 'journey_completed_specific':
    case 'journey_active_in':
    case 'journey_dropped_off': {
      const enrollments = enrichment?.journeys?.enrollments || [];
      return enrollments.map(e => ({
        enrollment_date: e.enrolledAt,
        completion_date: e.completedAt,
        current_node: e.currentNode || '',
        journey_status: e.status,
        timestamp: e.enrolledAt,
      }));
    }
    // Flow-based fields return flow response entries
    case 'flow_completed_specific':
    case 'flow_started_specific':
    case 'flow_dropout': {
      const responses = enrichment?.flows?.responses || [];
      return responses.map(r => ({
        screen_id: '',
        response_value: JSON.stringify(r.responseData),
        completion_date: r.completedAt,
        timestamp: r.createdAt,
      }));
    }
    default:
      return null;
  }
}

/** Evaluate a condition with sub-filters, time windows, and frequency qualifiers */
function evaluateConditionWithSubFilters(
  customer: ShopifyCustomer,
  condition: SegmentCondition,
  enrichment?: CustomerEnrichment
): boolean {
  const hasSubFilters = condition.subFilters && condition.subFilters.length > 0;
  const hasTimeWindow = condition.timeWindow && condition.timeWindow.amount > 0;
  const hasFrequency = condition.frequency && condition.frequency.count > 0;

  // If no advanced features, use standard evaluation
  if (!hasSubFilters && !hasTimeWindow && !hasFrequency) {
    return evaluateCondition(customer, condition, enrichment);
  }

  // Get the collection for this field
  const collection = getFieldCollection(customer, condition.field, enrichment);

  if (!collection) {
    // Scalar field — use standard evaluation (time window/frequency not applicable)
    return evaluateCondition(customer, condition, enrichment);
  }

  let filtered = collection;

  // Apply time window filter
  if (hasTimeWindow && condition.timeWindow) {
    const cutoff = Date.now() - timeWindowToMs(condition.timeWindow);
    filtered = filtered.filter(item => {
      const ts = toNumber(item.timestamp);
      return ts !== undefined && ts >= cutoff;
    });
  }

  // Apply the main condition value filter (e.g., specific product match)
  if (condition.value && condition.value !== '' && condition.operator !== 'is_true' && condition.operator !== 'is_false') {
    const mainValue = getFieldValue(customer, condition.field, enrichment);
    if (!opCompare(mainValue, condition.operator, condition.value)) {
      // If the main condition doesn't match at all, return false
      // But we need to check per-item for collection fields
    }
  }

  // Apply sub-filters to each item
  if (hasSubFilters && condition.subFilters) {
    filtered = filtered.filter(item => {
      const results = condition.subFilters!.map(sf => {
        const itemValue = item[sf.property];
        return opCompare(itemValue as ConditionValue, sf.operator, sf.value);
      });
      return condition.subFilterOperator === 'OR'
        ? results.some(Boolean)
        : results.every(Boolean);
    });
  }

  // Apply frequency qualifier
  if (hasFrequency && condition.frequency) {
    const count = filtered.length;
    switch (condition.frequency.type) {
      case 'at_least': return count >= condition.frequency.count;
      case 'at_most': return count <= condition.frequency.count;
      case 'exactly': return count === condition.frequency.count;
    }
  }

  // Default: match if any item passes
  return filtered.length > 0;
}

export function evaluateCondition(customer: ShopifyCustomer, condition: SegmentCondition, enrichment?: CustomerEnrichment): boolean {
  const value = getFieldValue(customer, condition.field, enrichment);
  return opCompare(value, condition.operator, condition.value);
}

export function matchesGroups(customer: ShopifyCustomer, groups: SegmentGroup[], enrichment?: CustomerEnrichment): boolean {
  if (!groups || groups.length === 0) return true;
  return groups.every(group => {
    const { conditions, groupOperator } = group;
    if (!conditions || conditions.length === 0) return true;
    if (groupOperator === 'OR') {
      return conditions.some(c => evaluateConditionWithSubFilters(customer, c, enrichment));
    }
    return conditions.every(c => evaluateConditionWithSubFilters(customer, c, enrichment));
  });
}

/** Check if any condition in the groups requires order-level data */
export function needsOrderEnrichment(groups: SegmentGroup[]): boolean {
  const orderFields = new Set([
    'ordered_specific_product', 'orders_in_last_x_days', 'total_items_purchased',
    'first_order_date', 'last_order_date', 'ordered_from_collection',
    'days_since_last_order', 'last_seen', 'churn_risk',
    'event_order_created', 'event_order_paid', 'event_order_fulfilled',
    'event_order_cancelled', 'event_order_refunded', 'event_checkout_started',
    // Advanced order fields
    'ordered_product_vendor', 'ordered_product_type', 'order_discount_code',
    'order_shipping_method', 'order_payment_method', 'order_fulfillment_status',
    'order_financial_status', 'clv_tier', 'repeat_product_buyer', 'order_currency',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => orderFields.has(c.field))
  );
}

/** Check if any condition requires CampaignLog engagement data */
export function needsEngagementEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'whatsapp_messages_received', 'whatsapp_messages_opened', 'whatsapp_messages_clicked',
    'last_message_sent', 'campaign_opens', 'campaign_clicks',
    'engaged_campaign_id', 'received_template', 'last_seen',
    // Campaign performance fields
    'campaign_received_specific', 'campaign_opened_specific', 'campaign_clicked_specific',
    'campaign_converted_specific', 'campaign_total_received', 'campaign_never_received',
    'campaign_last_received_date', 'campaign_delivery_rate', 'campaign_read_rate',
    'campaign_last_converted_at',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires abandoned checkout data */
export function needsAbandonedCheckoutEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'cart_abandonment_count', 'last_abandoned_cart_date',
    'event_checkout_started', 'event_checkout_abandoned',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires RFM scoring */
export function needsRFMEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'rfm_recency_score', 'rfm_frequency_score', 'rfm_monetary_score',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires storefront event tracking data */
export function needsStorefrontEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'event_product_viewed', 'viewed_product',
    'event_product_added_to_cart', 'added_product_to_cart',
    'event_collection_viewed',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires journey enrollment data */
export function needsJourneyEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'journey_completed_specific', 'journey_active_in', 'journey_dropped_off',
    'journey_enrollment_count', 'journey_completion_rate', 'journey_enrolled_date',
    'journey_never_enrolled', 'journey_current_node',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires WhatsApp flow response data */
export function needsFlowEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'flow_completed_specific', 'flow_started_specific', 'flow_dropout',
    'flow_response_value', 'flow_total_completed', 'flow_last_interaction',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires conversation/chat data */
export function needsConversationEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'wa_last_message_status', 'wa_conversation_state', 'wa_reply_rate',
    'wa_avg_response_time', 'wa_has_active_conversation', 'wa_message_frequency',
    'wa_last_inbound_message', 'wa_last_outbound_message', 'wa_total_conversations',
    'chat_has_open_conversation', 'chat_assigned_to_agent', 'chat_conversation_count',
    'chat_avg_resolution_time', 'chat_last_conversation_date', 'chat_unread_count',
    'chat_last_closed_date',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}

/** Check if any condition requires contact enrichment data */
export function needsContactEnrichment(groups: SegmentGroup[]): boolean {
  const fields = new Set([
    'wa_opted_in', 'wa_opt_in_date', 'wa_contact_source',
    'contact_created_date', 'contact_custom_field', 'contact_has_email',
    'contact_has_shopify_link', 'contact_tags', 'contact_has_phone',
  ]);
  return (groups || []).some(g =>
    (g.conditions || []).some(c => fields.has(c.field))
  );
}
