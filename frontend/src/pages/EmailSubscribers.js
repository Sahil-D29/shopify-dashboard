import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

const STATUS_BADGES = {
  subscribed: "bg-green-100 text-green-700",
  unsubscribed: "bg-gray-100 text-gray-600",
  bounced: "bg-red-100 text-red-700",
  complained: "bg-orange-100 text-orange-700",
};

export default function EmailSubscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", firstName: "", lastName: "" });
  const [suppression, setSuppression] = useState([]);
  const [showSuppression, setShowSuppression] = useState(false);

  useEffect(() => {
    fetchSubscribers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  async function fetchSubscribers() {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get(`${API}/subscribers`, { params });
      setSubscribers(res.data.subscribers || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const res = await axios.post(`${API}/subscribers/sync`, {
        storeId: "tsg-api.myshopify.com",
      });
      toast.success(`Synced! ${res.data.added} new subscribers added (${res.data.total} total)`);
      fetchSubscribers();
    } catch (err) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await axios.post(`${API}/subscribers`, {
        ...addForm,
        storeId: "tsg-api.myshopify.com",
        source: "manual",
      });
      toast.success("Subscriber added!");
      setShowAdd(false);
      setAddForm({ email: "", firstName: "", lastName: "" });
      fetchSubscribers();
    } catch (err) {
      toast.error("Failed to add subscriber");
    }
  }

  async function fetchSuppression() {
    try {
      const res = await axios.get(`${API}/suppression`);
      setSuppression(res.data.entries || []);
      setShowSuppression(true);
    } catch (err) {
      toast.error("Failed to load suppression list");
    }
  }

  async function handleRemoveFromSuppression(email) {
    try {
      await axios.delete(`${API}/suppression/${encodeURIComponent(email)}`);
      toast.success("Removed from suppression list");
      fetchSuppression();
    } catch (err) {
      toast.error("Failed to remove");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subscribers</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total subscribers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSuppression}
            className="border text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Suppression List
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="border text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing..." : "Sync from Shopify"}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-[#e94560] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#d63950] transition-colors"
          >
            + Add Subscriber
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="font-semibold mb-3">Add Subscriber</h3>
          <form onSubmit={handleAdd} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Email *</label>
              <input
                type="email"
                required
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">First Name</label>
              <input
                type="text"
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Last Name</label>
              <input
                type="text"
                value={addForm.lastName}
                onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e94560]"
              />
            </div>
            <button type="submit" className="bg-[#e94560] text-white px-5 py-2 rounded-lg text-sm font-medium">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 mb-4">
        {["", "subscribed", "unsubscribed", "bounced", "complained"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-[#1a1a2e] text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Subscribers Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e94560] mx-auto" />
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscribers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    No subscribers found. Sync from Shopify or add manually.
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{sub.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {[sub.firstName, sub.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_BADGES[sub.status] || STATUS_BADGES.subscribed}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{sub.source}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} subscribers)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suppression List Modal */}
      {showSuppression && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSuppression(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Suppression List ({suppression.length})</h3>
              <button onClick={() => setShowSuppression(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              {suppression.length === 0 ? (
                <p className="p-8 text-center text-gray-400">No suppressed emails</p>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {suppression.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2 text-sm">{entry.email}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{entry.reason}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleRemoveFromSuppression(entry.email)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
