import path from "path";
import { readFileSafe, writeFileSafe } from "../utils/safeFileStore.js";
import { v4 as uuidv4 } from "uuid";
import { createShopifyClient } from "../config/shopify.js";
import { sendEmail } from "./emailService.js";
import { getTemplatesByCategory } from "./emailTemplateService.js";
import { personalizeMergeTags } from "../utils/emailRenderer.js";

const file = path.join(process.cwd(), "backend", "data", "back-in-stock.json");

async function loadAlerts() {
  const data = await readFileSafe(file, { default: { alerts: [], waitlist: [] } });
  return data;
}

async function saveAlerts(data) {
  await writeFileSafe(file, data);
}

/**
 * Add customer to waitlist for a product
 */
export async function addToWaitlist({ email, productId, variantId, storeId, firstName, lastName }) {
  const data = await loadAlerts();
  data.waitlist = data.waitlist || [];

  // Check if already on waitlist
  const existing = data.waitlist.find(
    (w) => w.email === email && w.productId === productId && w.variantId === (variantId || null)
  );
  if (existing) {
    return { success: false, message: "Already on waitlist" };
  }

  const entry = {
    id: `bis_${uuidv4()}`,
    email,
    firstName: firstName || "",
    lastName: lastName || "",
    productId,
    variantId: variantId || null,
    storeId,
    status: "waiting", // waiting, notified
    createdAt: new Date().toISOString(),
    notifiedAt: null,
  };

  data.waitlist.push(entry);
  await saveAlerts(data);

  return { success: true, entry };
}

/**
 * Remove from waitlist
 */
export async function removeFromWaitlist(id) {
  const data = await loadAlerts();
  data.waitlist = (data.waitlist || []).filter((w) => w.id !== id);
  await saveAlerts(data);
}

/**
 * Get waitlist entries for a product
 */
export async function getWaitlistByProduct(productId) {
  const data = await loadAlerts();
  return (data.waitlist || []).filter((w) => w.productId === productId && w.status === "waiting");
}

/**
 * Get all waitlist entries for a store
 */
export async function getWaitlistByStore(storeId) {
  const data = await loadAlerts();
  return (data.waitlist || []).filter((w) => w.storeId === storeId);
}

/**
 * Check inventory and notify waitlisted customers
 */
export async function checkAndNotify(storeId) {
  const data = await loadAlerts();
  const waiting = (data.waitlist || []).filter((w) => w.storeId === storeId && w.status === "waiting");

  if (waiting.length === 0) return { notified: 0 };

  // Get unique product IDs
  const productIds = [...new Set(waiting.map((w) => w.productId))];

  let notifiedCount = 0;

  try {
    const client = await createShopifyClient(storeId);

    for (const productId of productIds) {
      try {
        const query = `
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              featuredImage { url }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }
        `;
        const response = await client.query({ data: { query, variables: { id: productId } } });
        const product = response.body.data.product;
        if (!product) continue;

        const variants = product.variants.edges.map((e) => e.node);

        // Find waitlisted entries for this product that are now in stock
        const entries = waiting.filter((w) => w.productId === productId);

        for (const entry of entries) {
          let inStock = false;

          if (entry.variantId) {
            const variant = variants.find((v) => v.id === entry.variantId);
            inStock = variant && variant.inventoryQuantity > 0;
          } else {
            inStock = variants.some((v) => v.inventoryQuantity > 0);
          }

          if (inStock) {
            // Send notification email
            const variant = entry.variantId
              ? variants.find((v) => v.id === entry.variantId)
              : variants.find((v) => v.inventoryQuantity > 0);

            try {
              const templates = await getTemplatesByCategory("notification", storeId);
              const template = templates[0]; // Use first notification template

              const htmlBody = template
                ? personalizeMergeTags(template.htmlBody, {
                    first_name: entry.firstName,
                    last_name: entry.lastName,
                    email: entry.email,
                    product_title: product.title,
                    product_price: variant?.price || "",
                    product_image: product.featuredImage?.url || "",
                    product_url: `https://${storeId}/products/${product.handle}`,
                  })
                : `<html><body>
                    <h2>Great news! ${product.title} is back in stock!</h2>
                    <p>Hi ${entry.firstName || "there"},</p>
                    <p>The item you were waiting for is now available.</p>
                    <p><a href="https://${storeId}/products/${product.handle}">Shop Now</a></p>
                  </body></html>`;

              await sendEmail({
                to: entry.email,
                subject: `${product.title} is back in stock!`,
                htmlBody,
              });

              entry.status = "notified";
              entry.notifiedAt = new Date().toISOString();
              notifiedCount++;
            } catch (emailErr) {
              console.error(`Failed to notify ${entry.email}:`, emailErr.message);
            }
          }
        }
      } catch (productErr) {
        console.error(`Failed to check product ${productId}:`, productErr.message);
      }
    }
  } catch (err) {
    console.error("Back-in-stock check failed:", err.message);
  }

  await saveAlerts(data);
  return { notified: notifiedCount };
}

/**
 * Get alert history
 */
export async function getAlertHistory(storeId) {
  const data = await loadAlerts();
  return (data.waitlist || [])
    .filter((w) => w.storeId === storeId && w.status === "notified")
    .sort((a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt));
}
