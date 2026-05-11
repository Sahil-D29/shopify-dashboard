import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

export default function BackInStock() {
  const [waitlist, setWaitlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("waitlist");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    productId: "",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [wlRes, histRes, prodRes] = await Promise.all([
        axios.get(`${API}/back-in-stock/waitlist`).catch(() => ({ data: { entries: [] } })),
        axios.get(`${API}/back-in-stock/history`).catch(() => ({ data: { history: [] } })),
        axios.get(`${API}/shopify/products`, { params: { limit: 50 } }).catch(() => ({ data: { products: [] } })),
      ]);
      setWaitlist(wlRes.data?.entries || []);
      setHistory(histRes.data?.history || []);
      setProducts(prodRes.data?.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.email || !form.productId) {
      toast.error("Email and product are required");
      return;
    }
    try {
      const res = await axios.post(`${API}/back-in-stock/waitlist`, {
        ...form,
        storeId: "tsg-api.myshopify.com",
      });
      if (res.data.success) {
        toast.success("Added to waitlist!");
        setShowAdd(false);
        setForm({ email: "", firstName: "", lastName: "", productId: "" });
        fetchAll();
      } else {
        toast.error(res.data.message || "Failed to add");
      }
    } catch (err) {
      toast.error("Failed to add to waitlist");
    }
  }

  async function handleRemove(id) {
    try {
      await axios.delete(`${API}/back-in-stock/waitlist/${id}`);
      toast.success("Removed from waitlist");
      fetchAll();
    } catch (err) {
      toast.error("Failed to remove");
    }
  }

  async function handleCheck() {
    try {
      setChecking(true);
      const res = await axios.post(`${API}/back-in-stock/check`, {
        storeId: "tsg-api.myshopify.com",
      });
      if (res.data.notified > 0) {
        toast.success(`${res.data.notified} customer(s) notified!`);
      } else {
        toast.success("No products back in stock yet");
      }
      fetchAll();
    } catch (err) {
      toast.error("Check failed");
    } finally {
      setChecking(false);
    }
  }

  function getProductName(productId) {
    const p = products.find((pr) => pr.id === productId);
    return p ? p.title : productId;
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
          <h1 className="text-2xl font-bold text-gray-800">Back-in-Stock Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Notify customers when out-of-stock products become available
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="border text-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {checking ? "Checking..." : "Check Inventory Now"}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-[#e94560] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d63950] transition-colors"
          >
            + Add to Waitlist
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="font-semibold mb-3">Add Customer to Waitlist</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Product *</label>
              <select
                required
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="bg-[#e94560] text-white px-5 py-2 rounded-lg text-sm font-medium">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "waitlist", label: `Waitlist (${waitlist.length})` },
          { key: "history", label: `Notified (${history.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? "bg-[#1a1a2e] text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {tab === "waitlist" ? "Joined" : "Notified"}
              </th>
              {tab === "waitlist" && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(tab === "waitlist" ? waitlist : history).length === 0 ? (
              <tr>
                <td colSpan={tab === "waitlist" ? 5 : 4} className="px-6 py-12 text-center text-gray-400">
                  {tab === "waitlist" ? "No one on the waitlist yet." : "No notifications sent yet."}
                </td>
              </tr>
            ) : (
              (tab === "waitlist" ? waitlist : history).map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{entry.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {[entry.firstName, entry.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{getProductName(entry.productId)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(tab === "waitlist" ? entry.createdAt : entry.notifiedAt).toLocaleDateString()}
                  </td>
                  {tab === "waitlist" && (
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleRemove(entry.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
