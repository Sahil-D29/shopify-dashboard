import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

export default function DiscountGenerator({ onInsert, onClose }) {
  const [form, setForm] = useState({
    title: "",
    discountType: "percentage",
    discountValue: 10,
    usageLimit: 1,
    minPurchase: 0,
    codePrefix: "",
    count: 1,
    endsAt: "",
    createInShopify: true,
  });
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate(e) {
    e.preventDefault();
    try {
      setGenerating(true);

      if (form.createInShopify) {
        const res = await axios.post(`${API}/discounts/generate`, {
          ...form,
          storeId: "tsg-api.myshopify.com",
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        });
        setGeneratedCodes(res.data.codes || []);
        const successCount = (res.data.results || []).filter((r) => r.success).length;
        if (successCount > 0) {
          toast.success(`${successCount} discount code(s) created in Shopify!`);
        } else if (res.data.note) {
          toast.success("Codes generated (not synced to Shopify)");
        } else {
          toast.error("Codes generated but failed to create in Shopify");
        }
      } else {
        const res = await axios.post(`${API}/discounts/codes-only`, {
          count: form.count,
          prefix: form.codePrefix,
        });
        setGeneratedCodes(res.data.codes || []);
        toast.success(`${res.data.codes.length} code(s) generated!`);
      }
    } catch (err) {
      toast.error("Failed to generate codes");
    } finally {
      setGenerating(false);
    }
  }

  function handleInsertCode(code) {
    if (onInsert) onInsert(code);
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Discount Code Generator</h3>
            <p className="text-xs text-gray-400">Generate unique discount codes for your campaigns</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 font-medium">Discount Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Summer Sale 10% Off"
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Type</label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                >
                  <option value="percentage">Percentage Off</option>
                  <option value="fixed_amount">Fixed Amount Off</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">
                  Value {form.discountType === "percentage" ? "(%)" : "($)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max={form.discountType === "percentage" ? 100 : 10000}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Code Prefix</label>
                <input
                  type="text"
                  value={form.codePrefix}
                  onChange={(e) => setForm({ ...form, codePrefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER"
                  maxLength={10}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Number of Codes</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.count}
                  onChange={(e) => setForm({ ...form, count: parseInt(e.target.value) || 1 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Usage Limit (per code)</label>
                <input
                  type="number"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: parseInt(e.target.value) || 1 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Min Purchase ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.minPurchase}
                  onChange={(e) => setForm({ ...form, minPurchase: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Expires On</label>
                <input
                  type="date"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.createInShopify}
                onChange={(e) => setForm({ ...form, createInShopify: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-700">Create in Shopify (auto-apply at checkout)</span>
            </label>

            <button
              type="submit"
              disabled={generating}
              className="w-full bg-[#e94560] text-white py-2.5 rounded-lg font-medium hover:bg-[#d63950] disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating..." : "Generate Codes"}
            </button>
          </form>

          {/* Generated Codes */}
          {generatedCodes.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Generated Codes ({generatedCodes.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-auto">
                {generatedCodes.map((code, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                    <code className="text-sm font-mono font-bold text-[#e94560]">{code}</code>
                    <div className="flex gap-2">
                      <button onClick={() => copyCode(code)} className="text-xs text-blue-600 hover:underline">
                        Copy
                      </button>
                      {onInsert && (
                        <button
                          onClick={() => handleInsertCode(code)}
                          className="text-xs text-[#e94560] hover:underline font-medium"
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
