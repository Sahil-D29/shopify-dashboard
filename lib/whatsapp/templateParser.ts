/**
 * Template Variable Parser
 * Extracts variables from WhatsApp template body and provides smart suggestions
 */

export interface TemplateVariable {
  variable: string; // "{{1}}" or "{{customer_name}}"
  position: number; // Order in template
  suggestedSource: string; // Auto-suggested data source
  suggestedProperty: string; // Auto-suggested property
  suggestedFallback: string; // Auto-suggested fallback
}

/**
 * Extract variables from WhatsApp template body
 * Supports both {{1}} and {{variable_name}} formats
 */
export function extractTemplateVariables(templateBody: string): TemplateVariable[] {
  if (!templateBody) return [];

  // Regex to match WhatsApp template variables: {{1}} or {{variable_name}}
  const regex = /\{\{(\d+|[a-zA-Z_]+)\}\}/g;
  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();
  let match;
  let position = 1;

  while ((match = regex.exec(templateBody)) !== null) {
    const variable = match[0]; // Full match: "{{1}}"
    const varName = match[1]; // Inside: "1" or "customer_name"

    // Skip duplicates
    if (seen.has(variable)) continue;
    seen.add(variable);

    variables.push({
      variable,
      position,
      suggestedSource: suggestDataSource(varName, position),
      suggestedProperty: suggestProperty(varName, position),
      suggestedFallback: suggestFallback(varName, position),
    });

    position++;
  }

  return variables;
}

/**
 * Smart suggestion for data source based on variable name/position
 */
function suggestDataSource(varName: string, position: number): string {
  const lowerName = varName.toLowerCase();

  // Numeric variables - position-based suggestion
  if (/^\d+$/.test(varName)) {
    if (position === 1) return 'customer'; // First variable usually name
    if (position === 2) return 'order'; // Second often order-related
    if (position === 3) return 'product'; // Third often product
    return 'customer'; // Default
  }

  // Named variables - keyword-based
  const customerKeywords = ['name', 'first', 'last', 'customer', 'user', 'email', 'phone', 'mobile'];
  const orderKeywords = ['order', 'invoice', 'total', 'amount', 'status', 'delivery', 'tracking', 'shipment'];
  const productKeywords = ['product', 'item', 'sku', 'price', 'title', 'vendor'];

  if (customerKeywords.some((kw) => lowerName.includes(kw))) return 'customer';
  if (orderKeywords.some((kw) => lowerName.includes(kw))) return 'order';
  if (productKeywords.some((kw) => lowerName.includes(kw))) return 'product';

  return 'customer'; // Default
}

/**
 * Smart suggestion for property based on variable name
 */
function suggestProperty(varName: string, position: number): string {
  const lowerName = varName.toLowerCase();

  const propertyMap: Record<string, string> = {
    // Customer properties
    name: 'firstName',
    '1': 'firstName',
    first_name: 'firstName',
    customer_name: 'firstName',
    firstname: 'firstName',
    last_name: 'lastName',
    lastname: 'lastName',
    email: 'email',
    phone: 'phone',
    mobile: 'phone',
    city: 'city',
    country: 'country',

    // Order properties
    order_number: 'orderNumber',
    order_id: 'id',
    '2': 'orderNumber', // Common second variable
    invoice: 'invoiceNumber',
    total: 'totalAmount',
    amount: 'totalAmount',
    status: 'status',
    delivery: 'deliveryDate',
    delivery_date: 'deliveryDate',
    tracking: 'trackingNumber',
    tracking_number: 'trackingNumber',
    shipment: 'trackingNumber',

    // Product properties
    product_name: 'title',
    product: 'title',
    title: 'title',
    price: 'price',
    sku: 'sku',
    vendor: 'vendor',
  };

  return propertyMap[lowerName] || '';
}

/**
 * Smart suggestion for fallback value
 */
function suggestFallback(varName: string, position: number): string {
  const lowerName = varName.toLowerCase();

  const fallbackMap: Record<string, string> = {
    name: 'Customer',
    '1': 'Customer',
    first_name: 'Customer',
    customer_name: 'Valued Customer',
    firstname: 'Customer',
    last_name: '',
    lastname: '',

    order_number: 'Your Order',
    order_id: 'Order',
    '2': 'Your Order',
    invoice: 'Invoice',
    total: '$0.00',
    amount: '$0.00',
    status: 'Processing',
    delivery: 'Soon',
    delivery_date: 'Soon',

    product_name: 'Product',
    product: 'Item',
    title: 'Product',
    price: '$0.00',
    sku: 'N/A',
    vendor: 'Store',
  };

  return fallbackMap[lowerName] || 'Value';
}

/**
 * Escape regex special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace variables in template body with values
 */
export function replaceVariablesInTemplate(
  templateBody: string,
  mappings: Array<{ variable: string; value: string }>,
): string {
  let result = templateBody;

  mappings.forEach((mapping) => {
    const escaped = escapeRegex(mapping.variable);
    result = result.replace(new RegExp(escaped, 'g'), mapping.value);
  });

  return result;
}


