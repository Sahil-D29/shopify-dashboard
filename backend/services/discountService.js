import { createShopifyClient } from "../config/shopify.js";
import voucherCodes from "voucher-code-generator";

/**
 * Generate unique discount codes and create them in Shopify
 */
export async function createDiscountCode(options) {
  const {
    storeId,
    title,
    discountType = "percentage", // percentage | fixed_amount
    discountValue = 10,
    usageLimit = 1,
    minPurchase = 0,
    startsAt = new Date().toISOString(),
    endsAt = null,
    codePrefix = "",
    count = 1,
  } = options;

  // Generate unique codes
  const codes = voucherCodes.generate({
    length: 8,
    count: count,
    prefix: codePrefix ? `${codePrefix}-` : "",
    charset: voucherCodes.charset("alphanumeric"),
  });

  try {
    const client = await createShopifyClient(storeId);

    const results = [];
    for (const code of codes) {
      const mutation = `
        mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  codes(first: 1) {
                    edges { node { code } }
                  }
                  startsAt
                  endsAt
                  usageLimit
                  customerSelection { ... on DiscountCustomerAll { allCustomers } }
                }
              }
            }
            userErrors { field message }
          }
        }
      `;

      const variables = {
        basicCodeDiscount: {
          title: title || `Discount ${code}`,
          code: code,
          startsAt: startsAt,
          endsAt: endsAt,
          usageLimit: usageLimit,
          customerSelection: { all: true },
          customerGets: {
            value: discountType === "percentage"
              ? { percentage: discountValue / 100 }
              : { discountAmount: { amount: discountValue, appliesOnEachItem: false } },
            items: { all: true },
          },
          minimumRequirement: minPurchase > 0
            ? { subtotal: { greaterThanOrEqualToSubtotal: minPurchase.toString() } }
            : null,
        },
      };

      try {
        const response = await client.query({ data: { query: mutation, variables } });
        const result = response.body.data.discountCodeBasicCreate;

        if (result.userErrors && result.userErrors.length > 0) {
          results.push({ code, success: false, errors: result.userErrors });
        } else {
          results.push({
            code,
            success: true,
            id: result.codeDiscountNode?.id,
          });
        }
      } catch (err) {
        results.push({ code, success: false, errors: [{ message: err.message }] });
      }
    }

    return { codes, results };
  } catch (err) {
    // If Shopify API fails, still return the generated codes (they can be manually created)
    return {
      codes,
      results: codes.map((code) => ({ code, success: false, errors: [{ message: err.message }] })),
      note: "Codes generated but could not be created in Shopify. You can create them manually.",
    };
  }
}

/**
 * Generate codes without creating in Shopify (for use in merge tags)
 */
export function generateCodes(count = 1, prefix = "") {
  return voucherCodes.generate({
    length: 8,
    count,
    prefix: prefix ? `${prefix}-` : "",
    charset: voucherCodes.charset("alphanumeric"),
  });
}
