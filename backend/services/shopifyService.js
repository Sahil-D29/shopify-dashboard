import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json",
  },
});

export const getProducts = async (req, res) => {
  try {
    const { data } = await shopify.get("/products.json?limit=10");
    res.json(data.products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const { data } = await shopify.get("/customers.json?limit=10");
    res.json(data.customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { data } = await shopify.get("/orders.json?limit=10");
    res.json(data.orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAbandonedCheckouts = async (req, res) => {
  try {
    const { data } = await shopify.get("/checkouts.json?limit=10");
    res.json(data.checkouts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

