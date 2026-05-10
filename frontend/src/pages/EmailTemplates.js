import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

const CATEGORY_LABELS = {
  welcome: "Welcome",
  abandoned_cart: "Abandoned Cart",
  transactional: "Transactional",
  promotional: "Promotional",
  winback: "Win-Back",
  notification: "Notification",
  post_purchase: "Post-Purchase",
  newsletter: "Newsletter",
  custom: "Custom",
};

const CATEGORY_COLORS = {
  welcome: "bg-green-100 text-green-700",
  abandoned_cart: "bg-orange-100 text-orange-700",
  transactional: "bg-blue-100 text-blue-700",
  promotional: "bg-red-100 text-red-700",
  winback: "bg-purple-100 text-purple-700",
  notification: "bg-yellow-100 text-yellow-700",
  post_purchase: "bg-teal-100 text-teal-700",
  newsletter: "bg-indigo-100 text-indigo-700",
  custom: "bg-gray-100 text-gray-700",
};

export default function EmailTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [previewHtml, setPreviewHtml] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/templates`);
      setTemplates(res.data.templates || []);
    } catch (err) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleClone(id, name) {
    try {
      await axios.post(`${API}/templates/${id}/clone`, {
        name: `${name} (Copy)`,
        storeId: "tsg-api.myshopify.com",
      });
      toast.success("Template cloned!");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to clone template");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this template?")) return;
    try {
      await axios.delete(`${API}/templates/${id}`);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete template");
    }
  }

  const filtered = filter === "all" ? templates : templates.filter((t) => t.category === filter);
  const categories = ["all", ...new Set(templates.map((t) => t.category))];

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
          <h1 className="text-2xl font-bold text-gray-800">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">{templates.length} templates available</p>
        </div>
        <button
          onClick={() => navigate("/email/builder")}
          className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] transition-colors"
        >
          + Create Template
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === cat
                ? "bg-[#1a1a2e] text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Preview Area */}
            <div
              className="h-48 bg-gray-100 border-b relative cursor-pointer group"
              onClick={() => setPreviewHtml(template.htmlBody)}
            >
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Click to Preview
                </div>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            </div>

            {/* Template Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                {template.isGlobal && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Built-in</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}`}>
                  {CATEGORY_LABELS[template.category] || template.category}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/email/builder/${template.id}`)}
                    className="text-xs text-[#e94560] hover:underline font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleClone(template.id, template.name)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clone
                  </button>
                  {!template.isGlobal && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No templates found in this category.
        </div>
      )}

      {/* Preview Modal */}
      {previewHtml && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Template Preview</h3>
              <button
                onClick={() => setPreviewHtml(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh]">
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
