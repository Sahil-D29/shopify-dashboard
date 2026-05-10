import path from "path";
import { readFileSafe, writeFileSafe } from "../utils/safeFileStore.js";
import { v4 as uuidv4 } from "uuid";
import { createShopifyClient } from "../config/shopify.js";

const file = path.join(process.cwd(), "backend", "data", "cross-sell-rules.json");

async function loadRules() {
  const data = await readFileSafe(file, { default: { rules: [] } });
  return data.rules || [];
}

async function saveRules(rules) {
  await writeFileSafe(file, { rules });
}

/**
 * Create a cross-sell rule
 * e.g. "When customer buys Product A, recommend Products B, C"
 */
export async function createRule(payload) {
  const rules = await loadRules();
  const rule = {
    id: `csr_${uuidv4()}`,
    storeId: payload.storeId,
    name: payload.name,
    triggerType: payload.triggerType || "product_purchased", // product_purchased, collection_purchased, any_purchase
    triggerProductIds: payload.triggerProductIds || [],
    triggerCollectionId: payload.triggerCollectionId || null,
    recommendedProductIds: payload.recommendedProductIds || [],
    emailTemplateId: payload.emailTemplateId || null,
    delayHours: payload.delayHours || 48,
    discountPercent: payload.discountPercent || 0,
    enabled: payload.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  rules.push(rule);
  await saveRules(rules);
  return rule;
}

export async function getRulesByStore(storeId) {
  const rules = await loadRules();
  return rules.filter((r) => r.storeId === storeId);
}

export async function getRuleById(id) {
  const rules = await loadRules();
  return rules.find((r) => r.id === id);
}

export async function updateRule(id, patch) {
  const rules = await loadRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Rule not found");
  rules[idx] = { ...rules[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveRules(rules);
  return rules[idx];
}

export async function deleteRule(id) {
  const rules = await loadRules();
  await saveRules(rules.filter((r) => r.id !== id));
}

/**
 * Get product recommendations for an order based on rules
 */
export async function getRecommendationsForOrder(orderLineItems, storeId) {
  const rules = await loadRules();
  const storeRules = rules.filter((r) => r.storeId === storeId && r.enabled);

  const purchasedProductIds = orderLineItems.map((item) => item.productId || item.product_id);
  const recommendations = [];

  for (const rule of storeRules) {
    let matches = false;

    if (rule.triggerType === "any_purchase") {
      matches = true;
    } else if (rule.triggerType === "product_purchased") {
      matches = rule.triggerProductIds.some((pid) => purchasedProductIds.includes(pid));
    }

    if (matches) {
      // Don't recommend products they already bought
      const filtered = rule.recommendedProductIds.filter((pid) => !purchasedProductIds.includes(pid));
      if (filtered.length > 0) {
        recommendations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          productIds: filtered,
          delayHours: rule.delayHours,
          discountPercent: rule.discountPercent,
          emailTemplateId: rule.emailTemplateId,
        });
      }
    }
  }

  return recommendations;
}

/**
 * Fetch product details from Shopify for recommendations
 */
export async function fetchProductDetails(productIds, storeId) {
  try {
    const client = await createShopifyClient(storeId);
    const products = [];

    for (const pid of productIds.slice(0, 10)) {
      try {
        const query = `
          query getProduct($id: ID!) {
            product(id: $id) {
              id title handle description
              featuredImage { url altText }
              variants(first: 1) {
                edges { node { id price compareAtPrice } }
              }
              priceRange { minVariantPrice { amount currencyCode } }
            }
          }
        `;
        const response = await client.query({ data: { query, variables: { id: pid } } });
        if (response.body.data.product) {
          products.push(response.body.data.product);
        }
      } catch {
        // Skip failed product fetches
      }
    }

    return products;
  } catch (err) {
    console.error("Failed to fetch product details:", err.message);
    return [];
  }
}
