import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api";

const TRIGGER_TYPES = [
  { value: "customer_created", label: "Customer Created", desc: "When a new customer signs up" },
  { value: "order_placed", label: "Order Placed", desc: "When a customer places an order" },
  { value: "cart_abandoned", label: "Cart Abandoned", desc: "When a cart is left without purchase" },
  { value: "order_fulfilled", label: "Order Fulfilled", desc: "When an order is shipped" },
  { value: "product_viewed", label: "Product Viewed", desc: "When a customer views a product" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Send Email", icon: "✉", color: "bg-blue-500" },
  { value: "send_message", label: "Send WhatsApp", icon: "💬", color: "bg-green-500" },
  { value: "wait", label: "Wait / Delay", icon: "⏱", color: "bg-yellow-500" },
  { value: "condition_check", label: "Condition", icon: "⑂", color: "bg-purple-500" },
  { value: "add_to_segment", label: "Add to Segment", icon: "👥", color: "bg-indigo-500" },
];

const PRESET_JOURNEYS = [
  {
    name: "Welcome Series",
    trigger: { eventType: "customer_created" },
    actions: [
      { type: "send_email", templateCategory: "welcome", delayMinutes: 0 },
      { type: "wait", delayMinutes: 4320 },
      { type: "send_email", templateCategory: "promotional", delayMinutes: 0 },
      { type: "wait", delayMinutes: 10080 },
      { type: "send_email", templateCategory: "newsletter", delayMinutes: 0 },
    ],
  },
  {
    name: "Abandoned Cart Recovery",
    trigger: { eventType: "cart_abandoned" },
    actions: [
      { type: "wait", delayMinutes: 60 },
      { type: "send_email", templateCategory: "abandoned_cart", delayMinutes: 0 },
      { type: "wait", delayMinutes: 1440 },
      { type: "send_message", message: "Hey {{first_name}}, you left items in your cart! Complete your purchase: {{cart_url}}", delayMinutes: 0 },
    ],
  },
  {
    name: "Post-Purchase Follow-Up",
    trigger: { eventType: "order_placed" },
    actions: [
      { type: "send_email", templateCategory: "transactional", delayMinutes: 0 },
      { type: "wait", delayMinutes: 10080 },
      { type: "send_email", templateCategory: "post_purchase", delayMinutes: 0 },
      { type: "wait", delayMinutes: 20160 },
      { type: "send_email", templateCategory: "winback", delayMinutes: 0 },
    ],
  },
  {
    name: "Win-Back Campaign",
    trigger: { eventType: "customer_created" },
    actions: [
      { type: "wait", delayMinutes: 43200 },
      { type: "send_email", templateCategory: "winback", delayMinutes: 0 },
      { type: "wait", delayMinutes: 10080 },
      { type: "send_message", message: "We miss you {{first_name}}! Here's 15% off your next order: {{discount_code}}", delayMinutes: 0 },
    ],
  },
];

function formatDelay(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function ActionCard({ action, index, templates, segments, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const actionDef = ACTION_TYPES.find((a) => a.value === action.type) || ACTION_TYPES[0];

  return (
    <div className="relative">
      {/* Connector line */}
      {!isFirst && (
        <div className="absolute left-1/2 -top-6 w-0.5 h-6 bg-gray-300" />
      )}

      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:border-gray-300 transition-colors overflow-hidden">
        <div className={`${actionDef.color} text-white px-4 py-2 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{actionDef.icon}</span>
            <span className="font-medium text-sm">{actionDef.label}</span>
            <span className="text-xs opacity-75">Step {index + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isFirst && (
              <button onClick={onMoveUp} className="p-1 hover:bg-white/20 rounded" title="Move up">↑</button>
            )}
            {!isLast && (
              <button onClick={onMoveDown} className="p-1 hover:bg-white/20 rounded" title="Move down">↓</button>
            )}
            <button onClick={onRemove} className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white" title="Remove">✕</button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {action.type === "send_email" && (
            <>
              <div>
                <label className="text-xs text-gray-500 font-medium">Email Template</label>
                <select
                  value={action.templateId || ""}
                  onChange={(e) => onChange({ ...action, templateId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-blue-400 outline-none"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Subject Override (optional)</label>
                <input
                  type="text"
                  value={action.subject || ""}
                  onChange={(e) => onChange({ ...action, subject: e.target.value })}
                  placeholder="Uses template subject if empty"
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>
            </>
          )}

          {action.type === "send_message" && (
            <div>
              <label className="text-xs text-gray-500 font-medium">WhatsApp Message</label>
              <textarea
                value={action.message || ""}
                onChange={(e) => onChange({ ...action, message: e.target.value })}
                rows={3}
                placeholder="Hi {{first_name}}, ..."
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-green-400 outline-none resize-none"
              />
            </div>
          )}

          {action.type === "wait" && (
            <div>
              <label className="text-xs text-gray-500 font-medium">Wait Duration</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  value={action.delayValue || 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const unit = action.delayUnit || "hours";
                    const mins = unit === "minutes" ? val : unit === "hours" ? val * 60 : val * 1440;
                    onChange({ ...action, delayValue: val, delayUnit: unit, delayMinutes: mins });
                  }}
                  className="w-20 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-yellow-400 outline-none"
                />
                <select
                  value={action.delayUnit || "hours"}
                  onChange={(e) => {
                    const unit = e.target.value;
                    const val = action.delayValue || 1;
                    const mins = unit === "minutes" ? val : unit === "hours" ? val * 60 : val * 1440;
                    onChange({ ...action, delayUnit: unit, delayMinutes: mins });
                  }}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-yellow-400 outline-none"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          )}

          {action.type === "condition_check" && (
            <div>
              <label className="text-xs text-gray-500 font-medium">Condition</label>
              <select
                value={action.condition || ""}
                onChange={(e) => onChange({ ...action, condition: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-purple-400 outline-none"
              >
                <option value="">Select condition...</option>
                <option value="email_opened">Email was opened</option>
                <option value="email_clicked">Email link clicked</option>
                <option value="purchased">Made a purchase</option>
                <option value="no_purchase">Did not purchase</option>
              </select>
            </div>
          )}

          {action.type === "add_to_segment" && (
            <div>
              <label className="text-xs text-gray-500 font-medium">Target Segment</label>
              <select
                value={action.segmentId || ""}
                onChange={(e) => onChange({ ...action, segmentId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-indigo-400 outline-none"
              >
                <option value="">Select segment...</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JourneyBuilder() {
  const [journeys, setJourneys] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPresets, setShowPresets] = useState(false);

  const [form, setForm] = useState({
    name: "",
    trigger: { eventType: "customer_created" },
    actions: [],
    enabled: true,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [jourRes, tmplRes, segRes] = await Promise.all([
        axios.get(`${API}/journeys`).catch(() => ({ data: { journeys: [] } })),
        axios.get(`${API}/email/templates`).catch(() => ({ data: { templates: [] } })),
        axios.get(`${API}/segments`).catch(() => ({ data: { segments: [] } })),
      ]);
      setJourneys(jourRes.data?.journeys || []);
      setTemplates(tmplRes.data?.templates || []);
      setSegments(segRes.data?.segments || segRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: "", trigger: { eventType: "customer_created" }, actions: [], enabled: true });
    setEditingId(null);
    setShowEditor(false);
  }

  function openEditor(journey) {
    if (journey) {
      setForm({
        name: journey.name,
        trigger: journey.trigger || { eventType: "customer_created" },
        actions: (journey.actions || []).map((a) => {
          if (a.type === "wait" && a.delayMinutes) {
            let delayUnit = "minutes";
            let delayValue = a.delayMinutes;
            if (a.delayMinutes >= 1440 && a.delayMinutes % 1440 === 0) {
              delayUnit = "days";
              delayValue = a.delayMinutes / 1440;
            } else if (a.delayMinutes >= 60 && a.delayMinutes % 60 === 0) {
              delayUnit = "hours";
              delayValue = a.delayMinutes / 60;
            }
            return { ...a, delayUnit, delayValue };
          }
          return a;
        }),
        enabled: journey.enabled !== false,
      });
      setEditingId(journey.id);
    } else {
      resetForm();
    }
    setShowEditor(true);
  }

  function loadPreset(preset) {
    setForm({
      name: preset.name,
      trigger: preset.trigger,
      actions: preset.actions.map((a) => {
        if (a.type === "wait") {
          let delayUnit = "minutes";
          let delayValue = a.delayMinutes;
          if (a.delayMinutes >= 1440 && a.delayMinutes % 1440 === 0) {
            delayUnit = "days";
            delayValue = a.delayMinutes / 1440;
          } else if (a.delayMinutes >= 60 && a.delayMinutes % 60 === 0) {
            delayUnit = "hours";
            delayValue = a.delayMinutes / 60;
          }
          return { ...a, delayUnit, delayValue };
        }
        return { ...a };
      }),
      enabled: true,
    });
    setShowPresets(false);
    setShowEditor(true);
    setEditingId(null);
  }

  function addAction(type) {
    const base = { type };
    if (type === "wait") {
      base.delayMinutes = 60;
      base.delayValue = 1;
      base.delayUnit = "hours";
    }
    setForm({ ...form, actions: [...form.actions, base] });
  }

  function updateAction(index, updated) {
    const actions = [...form.actions];
    actions[index] = updated;
    setForm({ ...form, actions });
  }

  function removeAction(index) {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) });
  }

  function moveAction(index, dir) {
    const actions = [...form.actions];
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= actions.length) return;
    [actions[index], actions[newIdx]] = [actions[newIdx], actions[index]];
    setForm({ ...form, actions });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Journey name is required");
      return;
    }
    if (form.actions.length === 0) {
      toast.error("Add at least one action");
      return;
    }

    try {
      const payload = {
        name: form.name,
        trigger: form.trigger,
        actions: form.actions.map(({ delayUnit, delayValue, ...rest }) => rest),
        enabled: form.enabled,
        storeId: "tsg-api.myshopify.com",
      };

      if (editingId) {
        await axios.put(`${API}/journeys/${editingId}`, payload);
        toast.success("Journey updated!");
      } else {
        await axios.post(`${API}/journeys`, payload);
        toast.success("Journey created!");
      }
      resetForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save journey");
    }
  }

  async function handleToggle(journey) {
    try {
      await axios.put(`${API}/journeys/${journey.id}`, { enabled: !journey.enabled });
      toast.success(journey.enabled ? "Journey paused" : "Journey activated");
      fetchAll();
    } catch (err) {
      toast.error("Failed to update journey");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this journey?")) return;
    try {
      await axios.delete(`${API}/journeys/${id}`);
      toast.success("Journey deleted");
      fetchAll();
    } catch (err) {
      toast.error("Failed to delete journey");
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e94560]" />
      </div>
    );
  }

  if (showEditor) {
    return (
      <div className="flex flex-col h-screen">
        {/* Editor Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">&larr; Back</button>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Journey Name"
              className="text-lg font-semibold border-b border-transparent hover:border-gray-300 focus:border-[#e94560] outline-none px-1 py-0.5"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="rounded"
              />
              <span className={form.enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                {form.enabled ? "Active" : "Paused"}
              </span>
            </label>
            <button
              onClick={handleSave}
              className="bg-[#e94560] text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-[#d63950] transition-colors"
            >
              {editingId ? "Update Journey" : "Save Journey"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-2xl mx-auto py-8 px-4">
            {/* Trigger Card */}
            <div className="bg-white rounded-xl border-2 border-[#e94560] shadow-sm overflow-hidden mb-4">
              <div className="bg-[#e94560] text-white px-4 py-2 flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="font-medium text-sm">Trigger</span>
              </div>
              <div className="p-4">
                <label className="text-xs text-gray-500 font-medium">When this happens:</label>
                <select
                  value={form.trigger.eventType}
                  onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, eventType: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-1 focus:ring-[#e94560] outline-none"
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {TRIGGER_TYPES.find((t) => t.value === form.trigger.eventType)?.desc}
                </p>
              </div>
            </div>

            {/* Connector */}
            {form.actions.length > 0 && (
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-6 bg-gray-300" />
              </div>
            )}

            {/* Action Steps */}
            <div className="space-y-4">
              {form.actions.map((action, idx) => (
                <div key={idx}>
                  {idx > 0 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-gray-300" />
                    </div>
                  )}
                  <ActionCard
                    action={action}
                    index={idx}
                    templates={templates}
                    segments={segments}
                    onChange={(updated) => updateAction(idx, updated)}
                    onRemove={() => removeAction(idx)}
                    onMoveUp={() => moveAction(idx, -1)}
                    onMoveDown={() => moveAction(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === form.actions.length - 1}
                  />
                </div>
              ))}
            </div>

            {/* Add Action */}
            <div className="flex justify-center py-4">
              <div className="w-0.5 h-6 bg-gray-300" />
            </div>
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6">
              <p className="text-sm text-gray-500 text-center mb-3 font-medium">Add Next Step</p>
              <div className="flex flex-wrap justify-center gap-2">
                {ACTION_TYPES.map((at) => (
                  <button
                    key={at.value}
                    onClick={() => addAction(at.value)}
                    className={`${at.color} text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5`}
                  >
                    <span>{at.icon}</span>
                    {at.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Journeys</h1>
          <p className="text-sm text-gray-500 mt-1">Automated multi-channel flows for your customers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="border text-gray-600 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Use Template
          </button>
          <button
            onClick={() => openEditor(null)}
            className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
          >
            + New Journey
          </button>
        </div>
      </div>

      {/* Preset Templates */}
      {showPresets && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {PRESET_JOURNEYS.map((preset, idx) => (
            <div
              key={idx}
              onClick={() => loadPreset(preset)}
              className="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md hover:border-[#e94560] transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">{preset.name}</h3>
              <p className="text-xs text-gray-400 mb-3">
                Trigger: {TRIGGER_TYPES.find((t) => t.value === preset.trigger.eventType)?.label}
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {preset.actions.map((a, i) => {
                  const def = ACTION_TYPES.find((at) => at.value === a.type);
                  return (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <span className="text-gray-300 mx-0.5">→</span>}
                      <span className={`${def?.color} text-white text-xs px-2 py-0.5 rounded-full`}>
                        {def?.icon} {a.type === "wait" ? formatDelay(a.delayMinutes) : def?.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Journeys List */}
      {journeys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="mb-2">No journeys yet</p>
          <p className="text-sm">Create automated flows that trigger emails and WhatsApp messages based on customer actions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {journeys.map((journey) => (
            <div key={journey.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-gray-900">{journey.name}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        journey.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {journey.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Trigger: {TRIGGER_TYPES.find((t) => t.value === journey.trigger?.eventType)?.label || journey.trigger?.eventType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(journey)}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        journey.enabled ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {journey.enabled ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => openEditor(journey)}
                      className="text-sm text-[#e94560] px-3 py-1.5 rounded-lg border hover:bg-red-50 transition-colors font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(journey.id)}
                      className="text-sm text-gray-400 hover:text-red-500 px-2 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Action Flow Preview */}
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  <span className="bg-[#e94560] text-white text-xs px-2.5 py-1 rounded-full font-medium">
                    ⚡ {TRIGGER_TYPES.find((t) => t.value === journey.trigger?.eventType)?.label || "Trigger"}
                  </span>
                  {(journey.actions || []).map((action, i) => {
                    const def = ACTION_TYPES.find((at) => at.value === action.type);
                    return (
                      <span key={i} className="flex items-center">
                        <span className="text-gray-300 mx-1">→</span>
                        <span className={`${def?.color || "bg-gray-400"} text-white text-xs px-2.5 py-1 rounded-full`}>
                          {def?.icon} {action.type === "wait" ? formatDelay(action.delayMinutes) : def?.label || action.type}
                        </span>
                      </span>
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
