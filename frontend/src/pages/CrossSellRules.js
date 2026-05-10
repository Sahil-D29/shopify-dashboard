import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

export default function CrossSellRules() {
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    triggerType: "product_purchased",
    triggerProductIds: [],
    recommendedProductIds: [],
    emailTemplateId: "",
    delayHours: 48,
    discountPercent: 0,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [rulesRes, prodRes, tmplRes] = await Promise.all([
        axios.get(`${API}/cross-sell/rules`).catch(() => ({ data: { rules: [] } })),
        axios.get(`${API}/shopify/products`, { params: { limit: 50 } }).catch(() => ({ data: { products: [] } })),
        axios.get(`${API}/templates`).catch(() => ({ data: { templates: [] } })),
      ]);
      setRules(rulesRes.data?.rules || []);
      setProducts(prodRes.data?.products || []);
      setTemplates(tmplRes.data?.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getProductName(id) {
    const p = products.find((pr) => pr.id === id);
    return p ? p.title : id;
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (form.recommendedProductIds.length === 0) {
      toast.error("Select at least one product to recommend");
      return;
    }
    try {
      await axios.post(`${API}/cross-sell/rules`, {
        ...form,
        storeId: "tsg-api.myshopify.com",
      });
      toast.success("Cross-sell rule created!");
      setShowCreate(false);
      setForm({
        name: "",
        triggerType: "product_purchased",
        triggerProductIds: [],
        recommendedProductIds: [],
        emailTemplateId: "",
        delayHours: 48,
        discountPercent: 0,
      });
      fetchAll();
    } catch (err) {
      toast.error("Failed to create rule");
    }
  }

  async function handleToggle(rule) {
    try {
      await axios.put(`${API}/cross-sell/rules/${rule.id}`, { enabled: !rule.enabled });
      toast.success(rule.enabled ? "Rule disabled" : "Rule enabled");
      fetchAll();
    } catch (err) {
      toast.error("Failed to update rule");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this cross-sell rule?")) return;
    try {
      await axios.delete(`${API}/cross-sell/rules/${id}`);
      toast.success("Rule deleted");
      fetchAll();
    } catch (err) {
      toast.error("Failed to delete");
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e94560]" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cross-Sell Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Recommend products after purchase to increase average order value
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
        >
          + New Rule
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create Cross-Sell Rule</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Shirt buyers get belt recommendation"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  <option value="product_purchased">Specific product purchased</option>
                  <option value="any_purchase">Any purchase</option>
                </select>
              </div>
            </div>

            {form.triggerType === "product_purchased" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  When customer buys (trigger products)
                </label>
                <select
                  multiple
                  value={form.triggerProductIds}
                  onChange={(e) =>
                    setForm({ ...form, triggerProductIds: Array.from(e.target.selectedOptions, (o) => o.value) })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm h-28 focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recommend these products
              </label>
              <select
                multiple
                value={form.recommendedProductIds}
                onChange={(e) =>
                  setForm({ ...form, recommendedProductIds: Array.from(e.target.selectedOptions, (o) => o.value) })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm h-28 focus:ring-2 focus:ring-[#e94560] outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Template</label>
                <select
                  value={form.emailTemplateId}
                  onChange={(e) => setForm({ ...form, emailTemplateId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  <option value="">Default cross-sell email</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Send After (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={form.delayHours}
                  onChange={(e) => setForm({ ...form, delayHours: parseInt(e.target.value) || 48 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Include Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="bg-[#e94560] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#d63950] transition-colors">
                Create Rule
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="border text-gray-600 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <p className="mb-2">No cross-sell rules yet</p>
          <p className="text-sm">Create rules to automatically recommend products after customer purchases.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-gray-900">{rule.name}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        rule.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {rule.triggerType === "any_purchase" ? "Triggers on any purchase" : "Triggers when specific products are purchased"}
                      {" | "}{rule.delayHours}h delay
                      {rule.discountPercent > 0 && ` | ${rule.discountPercent}% discount`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        rule.enabled ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-sm text-gray-400 hover:text-red-500 px-2 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Trigger -> Recommend visualization */}
                <div className="flex items-center gap-3 flex-wrap">
                  {rule.triggerType === "product_purchased" && rule.triggerProductIds.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-gray-400">When buys:</span>
                      {rule.triggerProductIds.slice(0, 3).map((pid) => (
                        <span key={pid} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {getProductName(pid)}
                        </span>
                      ))}
                      {rule.triggerProductIds.length > 3 && (
                        <span className="text-xs text-gray-400">+{rule.triggerProductIds.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <span className="text-gray-300">→</span>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-400">Recommend:</span>
                    {rule.recommendedProductIds.slice(0, 3).map((pid) => (
                      <span key={pid} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        {getProductName(pid)}
                      </span>
                    ))}
                    {rule.recommendedProductIds.length > 3 && (
                      <span className="text-xs text-gray-400">+{rule.recommendedProductIds.length - 3} more</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
