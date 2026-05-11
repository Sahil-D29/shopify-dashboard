import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api/email";

/**
 * Shopify Product Picker - search and select products to insert into email templates
 */
export default function ProductPicker({ onSelect, onClose }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts(query) {
    try {
      setLoading(true);
      const params = { limit: 20 };
      if (query) params.search = query;
      const res = await axios.get(`${API}/shopify/products`, { params });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchProducts(search);
  }

  function toggleProduct(product) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      return [...prev, product];
    });
  }

  function handleInsert() {
    if (onSelect) onSelect(selected);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Shopify Product Picker</h3>
            <p className="text-xs text-gray-400">
              Select products to insert into your email template
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#e94560] outline-none"
            />
            <button
              type="submit"
              className="bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e94560]" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No products found. Try a different search.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {products.map((product) => {
                const isSelected = selected.find((p) => p.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#e94560] bg-red-50 ring-1 ring-[#e94560]"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{product.title}</h4>
                    <p className="text-sm font-semibold text-[#e94560] mt-1">
                      ${parseFloat(product.price).toFixed(2)} {product.currency}
                    </p>
                    {product.variants?.length > 1 && (
                      <p className="text-xs text-gray-400">{product.variants.length} variants</p>
                    )}
                    {isSelected && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-[#e94560] font-medium">
                        <span>Selected</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-500">
            {selected.length} product{selected.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="border text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={selected.length === 0}
              className="bg-[#e94560] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#d63950] disabled:opacity-50 transition-colors"
            >
              Insert {selected.length > 0 ? `(${selected.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate MJML product block for a single product
 */
export function generateProductMjml(product, storeUrl = "tsg-api.myshopify.com") {
  const price = product.price ? `$${parseFloat(product.price).toFixed(2)}` : "";
  const compareAt = product.variants?.[0]?.compareAtPrice;

  return `<mj-section background-color="#ffffff" padding="20px">
  <mj-column width="40%">
    <mj-image src="${product.image || ""}" alt="${product.title}" border-radius="8px" />
  </mj-column>
  <mj-column width="60%">
    <mj-text font-size="18px" font-weight="700" color="#1a1a2e">${product.title}</mj-text>
    <mj-text font-size="16px" color="#e94560" font-weight="600">${price}${compareAt ? ` <span style="text-decoration:line-through;color:#999;font-size:14px;">$${parseFloat(compareAt).toFixed(2)}</span>` : ""}</mj-text>
    <mj-button background-color="#e94560" color="#ffffff" font-size="14px" border-radius="6px" href="https://${storeUrl}/products/${product.handle}">Shop Now</mj-button>
  </mj-column>
</mj-section>`;
}
