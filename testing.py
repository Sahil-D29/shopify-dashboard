import requests
import json

# ====== 🔐 CONFIGURATION ======
SHOP_URL = "sai-laxmi-dev.myshopify.com"
ACCESS_TOKEN = "YOUR_SHOPIFY_ACCESS_TOKEN_HERE"   # ⚠️ Replace with your active token
API_VERSION = "2025-10"  # Shopify API version (update as needed)

# ====== 🧠 HELPER FUNCTION ======
def shopify_get(endpoint):
    """Helper to GET any Shopify Admin API endpoint"""
    url = f"https://{SHOP_URL}/admin/api/{API_VERSION}/{endpoint}.json"
    headers = {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Error {response.status_code} while fetching {endpoint}")
        print(response.text)
        return None


# ====== 🏪 1. SHOP DETAILS ======
print("🛍️  SHOP INFORMATION  ======================")
shop_info = shopify_get("shop")
if shop_info:
    print(json.dumps(shop_info["shop"], indent=4))

# ====== 📦 2. PRODUCTS ======
print("\n📦  PRODUCTS LIST  ======================")
products = shopify_get("products")
if products:
    all_products = products.get("products", [])
    if all_products:
        for p in all_products:
            print(f"- {p['title']} | ID: {p['id']} | Price: ₹{p['variants'][0]['price']}")
    else:
        print("No products found.")
else:
    print("Could not fetch products.")

# ====== 👤 3. CUSTOMERS ======
print("\n👤  CUSTOMERS LIST  ======================")
customers = shopify_get("customers")
if customers:
    all_customers = customers.get("customers", [])
    if all_customers:
        for c in all_customers:
            print(f"- {c['first_name']} {c['last_name']} | Email: {c['email']}")
    else:
        print("No customers found.")
else:
    print("Could not fetch customers.")

# ====== 🧾 4. ORDERS ======
print("\n🧾  ORDERS LIST  ======================")
orders = shopify_get("orders")
if orders:
    all_orders = orders.get("orders", [])
    if all_orders:
        for o in all_orders:
            print(f"- Order #{o['order_number']} | Total: ₹{o['total_price']} | Status: {o['financial_status']}")
    else:
        print("No orders found.")
else:
    print("Could not fetch orders.")

# ====== 📍 5. INVENTORY LOCATIONS ======
print("\n📍  INVENTORY LOCATIONS  ======================")
locations = shopify_get("locations")
if locations:
    all_locations = locations.get("locations", [])
    if all_locations:
        for loc in all_locations:
            print(f"- {loc['name']} | ID: {loc['id']} | Country: {loc['country_code']}")
    else:
        print("No locations found.")
else:
    print("Could not fetch locations.")

print("\n✅  Data fetched successfully!")
