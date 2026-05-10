import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api";

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email Only" },
  { value: "whatsapp", label: "WhatsApp Only" },
  { value: "mixed", label: "Email + WhatsApp" },
];

const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "email",
    segmentIds: [],
    templateId: "",
    subject: "",
    sendingSpeed: "MEDIUM",
    scheduledAt: "",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [campRes, segRes, tmplRes] = await Promise.all([
        axios.get(`${API}/campaigns`).catch(() => ({ data: { campaigns: [] } })),
        axios.get(`${API}/segments`).catch(() => ({ data: { segments: [] } })),
        axios.get(`${API}/email/templates`).catch(() => ({ data: { templates: [] } })),
      ]);
      setCampaigns(campRes.data?.campaigns || campRes.data || []);
      setSegments(segRes.data?.segments || segRes.data || []);
      setTemplates(tmplRes.data?.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        channel: form.channel,
        segmentIds: form.segmentIds,
        sendingSpeed: form.sendingSpeed,
        storeId: "tsg-api.myshopify.com",
        emailContent: {
          subject: form.subject,
          templateId: form.templateId,
          htmlBody: templates.find((t) => t.id === form.templateId)?.htmlBody || "",
        },
      };

      await axios.post(`${API}/campaigns`, payload);
      toast.success("Campaign created!");
      setShowCreate(false);
      setForm({ name: "", channel: "email", segmentIds: [], templateId: "", subject: "", sendingSpeed: "MEDIUM", scheduledAt: "" });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create campaign");
    }
  }

  async function handlePublish(id) {
    try {
      const scheduledAt = new Date().toISOString();
      await axios.post(`${API}/campaigns/${id}/publish`, { scheduledAt });
      toast.success("Campaign scheduled!");
      fetchAll();
    } catch (err) {
      toast.error("Failed to schedule campaign");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this campaign?")) return;
    try {
      await axios.delete(`${API}/campaigns/${id}`);
      toast.success("Campaign deleted");
      fetchAll();
    } catch (err) {
      toast.error("Failed to delete campaign");
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
          <h1 className="text-2xl font-bold text-gray-800">Email Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage multi-channel campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Create Campaign Form */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create New Campaign</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] focus:border-transparent outline-none"
                  placeholder="e.g. Summer Sale Launch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(form.channel === "email" || form.channel === "mixed") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                    placeholder="e.g. {{first_name}}, check out our summer sale!"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Template</label>
                  <select
                    value={form.templateId}
                    onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                  >
                    <option value="">Select a template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Segments</label>
                <select
                  multiple
                  value={form.segmentIds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      segmentIds: Array.from(e.target.selectedOptions, (o) => o.value),
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm h-24 focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sending Speed</label>
                <select
                  value={form.sendingSpeed}
                  onChange={(e) => setForm({ ...form, sendingSpeed: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  <option value="SLOW">Slow (2s between messages)</option>
                  <option value="MEDIUM">Medium (1s between messages)</option>
                  <option value="FAST">Fast (no delay)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-[#e94560] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
              >
                Create Campaign
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="border text-gray-600 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                  No campaigns yet. Create your first campaign!
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {c.channel || "whatsapp"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT}`}>
                      {c.status || "DRAFT"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.metrics?.sent || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.metrics?.delivered || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {c.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handlePublish(c.id)}
                          className="text-sm text-[#e94560] hover:underline font-medium"
                        >
                          Send Now
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-sm text-gray-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {c.status === "COMPLETED" && (
                      <button
                        onClick={() => navigate(`/email/analytics?campaign=${c.id}`)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Analytics
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
