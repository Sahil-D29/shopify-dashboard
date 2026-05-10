import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  running: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

const CRITERIA_LABELS = {
  open_rate: "Open Rate",
  click_rate: "Click Rate",
  conversion_rate: "Conversion Rate",
};

export default function ABTesting() {
  const [tests, setTests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "subject",
    winnerCriteria: "open_rate",
    autoSelectAfterHours: 24,
    variants: [
      { label: "Variant A", subject: "", templateId: "", percentage: 50 },
      { label: "Variant B", subject: "", templateId: "", percentage: 50 },
    ],
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [testRes, tmplRes] = await Promise.all([
        axios.get(`${API}/ab-tests`).catch(() => ({ data: { tests: [] } })),
        axios.get(`${API}/templates`).catch(() => ({ data: { templates: [] } })),
      ]);
      setTests(testRes.data?.tests || []);
      setTemplates(tmplRes.data?.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addVariant() {
    if (form.variants.length >= 4) return;
    const letter = String.fromCharCode(65 + form.variants.length);
    const evenPct = Math.floor(100 / (form.variants.length + 1));
    const variants = [
      ...form.variants.map((v) => ({ ...v, percentage: evenPct })),
      { label: `Variant ${letter}`, subject: "", templateId: "", percentage: evenPct },
    ];
    const remainder = 100 - evenPct * variants.length;
    variants[0].percentage += remainder;
    setForm({ ...form, variants });
  }

  function removeVariant(idx) {
    if (form.variants.length <= 2) return;
    const variants = form.variants.filter((_, i) => i !== idx);
    const evenPct = Math.floor(100 / variants.length);
    variants.forEach((v) => (v.percentage = evenPct));
    const remainder = 100 - evenPct * variants.length;
    variants[0].percentage += remainder;
    setForm({ ...form, variants });
  }

  function updateVariant(idx, field, value) {
    const variants = [...form.variants];
    variants[idx] = { ...variants[idx], [field]: value };
    setForm({ ...form, variants });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Test name is required");
      return;
    }
    try {
      await axios.post(`${API}/ab-tests`, {
        ...form,
        storeId: "tsg-api.myshopify.com",
      });
      toast.success("A/B test created!");
      setShowCreate(false);
      setForm({
        name: "",
        type: "subject",
        winnerCriteria: "open_rate",
        autoSelectAfterHours: 24,
        variants: [
          { label: "Variant A", subject: "", templateId: "", percentage: 50 },
          { label: "Variant B", subject: "", templateId: "", percentage: 50 },
        ],
      });
      fetchAll();
    } catch (err) {
      toast.error("Failed to create test");
    }
  }

  async function handleStart(id) {
    try {
      await axios.post(`${API}/ab-tests/${id}/start`);
      toast.success("A/B test started!");
      fetchAll();
    } catch (err) {
      toast.error("Failed to start test");
    }
  }

  async function handleSelectWinner(testId, variantId) {
    try {
      await axios.post(`${API}/ab-tests/${testId}/select-winner`, { variantId });
      toast.success("Winner selected!");
      fetchAll();
    } catch (err) {
      toast.error("Failed to select winner");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this A/B test?")) return;
    try {
      await axios.delete(`${API}/ab-tests/${id}`);
      toast.success("Test deleted");
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
          <h1 className="text-2xl font-bold text-gray-800">A/B Testing</h1>
          <p className="text-sm text-gray-500 mt-1">Test subject lines and content to optimize engagement</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
        >
          + New A/B Test
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create A/B Test</h2>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Summer Subject Line Test"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  <option value="subject">Subject Line</option>
                  <option value="content">Content / Template</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Winner Criteria</label>
                <select
                  value={form.winnerCriteria}
                  onChange={(e) => setForm({ ...form, winnerCriteria: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560] outline-none"
                >
                  <option value="open_rate">Highest Open Rate</option>
                  <option value="click_rate">Highest Click Rate</option>
                  <option value="conversion_rate">Highest Conversion Rate</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">Variants</label>
                {form.variants.length < 4 && (
                  <button type="button" onClick={addVariant} className="text-sm text-[#e94560] hover:underline">
                    + Add Variant
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {form.variants.map((variant, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-gray-50 rounded-lg p-4 border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-sm font-bold">
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {form.type === "subject" ? (
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500">Subject Line</label>
                          <input
                            type="text"
                            value={variant.subject}
                            onChange={(e) => updateVariant(idx, "subject", e.target.value)}
                            placeholder={`Subject line for variant ${String.fromCharCode(65 + idx)}`}
                            className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                          />
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500">Email Template</label>
                          <select
                            value={variant.templateId}
                            onChange={(e) => updateVariant(idx, "templateId", e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-1 focus:ring-[#e94560] outline-none"
                          >
                            <option value="">Select template...</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500">Traffic %</label>
                        <div className="flex items-center gap-2 mt-0.5">
                          <input
                            type="number"
                            min="5"
                            max="95"
                            value={variant.percentage}
                            onChange={(e) => updateVariant(idx, "percentage", parseInt(e.target.value) || 0)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#e94560] outline-none"
                          />
                          {form.variants.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              className="text-gray-400 hover:text-red-500 text-lg"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto-select winner after</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={form.autoSelectAfterHours}
                    onChange={(e) => setForm({ ...form, autoSelectAfterHours: parseInt(e.target.value) || 24 })}
                    className="w-20 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#e94560] outline-none"
                  />
                  <span className="text-sm text-gray-500">hours</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-[#e94560] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
              >
                Create Test
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

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No A/B tests yet. Create your first test to start optimizing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div key={test.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-gray-900">{test.name}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[test.status]}`}>
                        {test.status}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {test.type === "subject" ? "Subject Line" : "Content"} Test
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Winner by: {CRITERIA_LABELS[test.winnerCriteria]} | Created {new Date(test.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.status === "draft" && (
                      <button
                        onClick={() => handleStart(test.id)}
                        className="text-sm bg-[#e94560] text-white px-4 py-1.5 rounded-lg hover:bg-[#d63950] transition-colors font-medium"
                      >
                        Start Test
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(test.id)}
                      className="text-sm text-gray-400 hover:text-red-500 px-2 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Variants */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {test.variants.map((variant) => {
                    const isWinner = test.winnerId === variant.id;
                    const sent = variant.metrics?.sent || 0;
                    const openRate = sent > 0 ? ((variant.metrics?.opened || 0) / sent * 100).toFixed(1) : "0.0";
                    const clickRate = sent > 0 ? ((variant.metrics?.clicked || 0) / sent * 100).toFixed(1) : "0.0";

                    return (
                      <div
                        key={variant.id}
                        className={`rounded-lg border p-4 ${isWinner ? "border-green-400 bg-green-50" : "border-gray-200"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{variant.label}</span>
                          {isWinner && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Winner</span>
                          )}
                          <span className="text-xs text-gray-400">{variant.percentage}%</span>
                        </div>
                        {test.type === "subject" && variant.subject && (
                          <p className="text-sm text-gray-600 mb-2 italic">"{variant.subject}"</p>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-gray-900">{sent}</p>
                            <p className="text-xs text-gray-400">Sent</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">{openRate}%</p>
                            <p className="text-xs text-gray-400">Opens</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-600">{clickRate}%</p>
                            <p className="text-xs text-gray-400">Clicks</p>
                          </div>
                        </div>
                        {test.status === "running" && !test.winnerId && (
                          <button
                            onClick={() => handleSelectWinner(test.id, variant.id)}
                            className="w-full mt-3 text-xs border text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Select as Winner
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
