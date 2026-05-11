import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import grapesjs from "grapesjs";
import grapesjsMjml from "grapesjs-mjml";
import "grapesjs/dist/css/grapes.min.css";
import ProductPicker, { generateProductMjml } from "../components/ProductPicker";
import DiscountGenerator from "../components/DiscountGenerator";

const API = "http://localhost:5000/api/email";

export default function EmailBuilder() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("custom");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [mergeTags, setMergeTags] = useState([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showDiscountGen, setShowDiscountGen] = useState(false);

  useEffect(() => {
    axios.get(`${API}/merge-tags`).then((res) => setMergeTags(res.data.tags || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (templateId) {
      axios
        .get(`${API}/templates/${templateId}`)
        .then((res) => {
          const t = res.data.template;
          setTemplate(t);
          setName(t.name);
          setSubject(t.subject);
          setCategory(t.category);
        })
        .catch(() => toast.error("Failed to load template"));
    }
  }, [templateId]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      plugins: [grapesjsMjml],
      pluginsOpts: {
        [grapesjsMjml]: {},
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Mobile", width: "375px" },
        ],
      },
      panels: {
        defaults: [],
      },
    });

    // Load template content if editing
    if (template?.mjmlBody) {
      editor.setComponents(template.mjmlBody);
    } else if (template?.htmlBody) {
      editor.setComponents(`<mjml>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text>Edit your email here</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>`);
    } else {
      editor.setComponents(`<mjml>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#1a1a2e" padding="30px 40px">
            <mj-column>
              <mj-text color="#ffffff" font-size="24px" font-weight="700" align="center">
                Your Email Title
              </mj-text>
            </mj-column>
          </mj-section>
          <mj-section background-color="#ffffff" padding="40px">
            <mj-column>
              <mj-text font-size="16px" color="#555555" line-height="1.6">
                Hi {{first_name}},
              </mj-text>
              <mj-text font-size="16px" color="#555555" line-height="1.6">
                Write your email content here. Use the drag-and-drop editor to add blocks.
              </mj-text>
              <mj-button background-color="#e94560" color="#ffffff" font-size="16px" font-weight="600" border-radius="6px" href="{{shop_url}}">
                Call to Action
              </mj-button>
            </mj-column>
          </mj-section>
          <mj-section background-color="#f8f8f8" padding="20px 40px">
            <mj-column>
              <mj-text font-size="12px" color="#999999" align="center">
                {{shop_name}} | <a href="{{unsubscribe_url}}" style="color:#999;">Unsubscribe</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>`);
    }

    editorRef.current = editor;

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [template]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);
    try {
      const editor = editorRef.current;
      const mjmlBody = editor.getHtml();
      let htmlBody = "";

      try {
        const compileRes = await axios.post(`${API}/compile-mjml`, { mjml: mjmlBody });
        htmlBody = compileRes.data.html;
      } catch {
        htmlBody = mjmlBody;
      }

      const payload = {
        name,
        subject,
        category,
        mjmlBody,
        htmlBody,
        jsonDesign: JSON.stringify(editor.getProjectData()),
        storeId: "tsg-api.myshopify.com",
      };

      if (templateId) {
        await axios.put(`${API}/templates/${templateId}`, payload);
        toast.success("Template updated!");
      } else {
        await axios.post(`${API}/templates`, payload);
        toast.success("Template created!");
      }
      navigate("/email/templates");
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function handleDeviceSwitch(mode) {
    setPreviewMode(mode);
    if (editorRef.current) {
      editorRef.current.setDevice(mode === "mobile" ? "Mobile" : "Desktop");
    }
  }

  function insertMergeTag(tag) {
    if (editorRef.current) {
      const selected = editorRef.current.getSelected();
      if (selected) {
        const content = selected.get("content") || "";
        selected.set("content", content + tag);
      }
    }
    setShowMergeTags(false);
  }

  function handleProductsSelected(products) {
    if (editorRef.current && products.length > 0) {
      const mjmlBlocks = products.map((p) => generateProductMjml(p)).join("\n");
      // Add product blocks to the editor
      const editor = editorRef.current;
      const existing = editor.getHtml();
      // Insert before closing mj-body
      const insertPoint = existing.lastIndexOf("</mj-body>");
      if (insertPoint > -1) {
        const newContent = existing.slice(0, insertPoint) + mjmlBlocks + existing.slice(insertPoint);
        editor.setComponents(newContent);
      }
      toast.success(`${products.length} product block(s) added!`);
    }
    setShowProductPicker(false);
  }

  function handleDiscountInsert(code) {
    if (editorRef.current) {
      const selected = editorRef.current.getSelected();
      if (selected) {
        const content = selected.get("content") || "";
        selected.set("content", content + code);
      }
    }
    toast.success(`Discount code ${code} inserted!`);
    setShowDiscountGen(false);
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/email/templates")} className="text-gray-400 hover:text-gray-600">
            &larr; Back
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template Name"
            className="text-lg font-semibold border-b border-transparent hover:border-gray-300 focus:border-[#e94560] outline-none px-1 py-0.5"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Device Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => handleDeviceSwitch("desktop")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                previewMode === "desktop" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => handleDeviceSwitch("mobile")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                previewMode === "mobile" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Mobile
            </button>
          </div>

          {/* Shopify Product Picker */}
          <button
            onClick={() => setShowProductPicker(true)}
            className="border text-sm px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            + Products
          </button>

          {/* Discount Generator */}
          <button
            onClick={() => setShowDiscountGen(true)}
            className="border text-sm px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            % Discount
          </button>

          {/* Merge Tags */}
          <div className="relative">
            <button
              onClick={() => setShowMergeTags(!showMergeTags)}
              className="border text-sm px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {"{{"} Merge Tags
            </button>
            {showMergeTags && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 max-h-64 overflow-auto">
                {mergeTags.map((mt) => (
                  <button
                    key={mt.tag}
                    onClick={() => insertMergeTag(mt.tag)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                  >
                    <span className="font-mono text-[#e94560]">{mt.tag}</span>
                    <span className="block text-xs text-gray-400">{mt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#e94560] text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-[#d63950] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      {/* Subject & Category Bar */}
      <div className="bg-gray-50 border-b px-6 py-2 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-500 font-medium">Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
            className="flex-1 bg-white border rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-[#e94560] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Category:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-white border rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-[#e94560] outline-none"
          >
            <option value="custom">Custom</option>
            <option value="welcome">Welcome</option>
            <option value="abandoned_cart">Abandoned Cart</option>
            <option value="transactional">Transactional</option>
            <option value="promotional">Promotional</option>
            <option value="winback">Win-Back</option>
            <option value="notification">Notification</option>
            <option value="post_purchase">Post-Purchase</option>
            <option value="newsletter">Newsletter</option>
          </select>
        </div>
      </div>

      {/* GrapeJS Editor */}
      <div className="flex-1 overflow-hidden" ref={containerRef} />

      {/* Product Picker Modal */}
      {showProductPicker && (
        <ProductPicker
          onSelect={handleProductsSelected}
          onClose={() => setShowProductPicker(false)}
        />
      )}

      {/* Discount Generator Modal */}
      {showDiscountGen && (
        <DiscountGenerator
          onInsert={handleDiscountInsert}
          onClose={() => setShowDiscountGen(false)}
        />
      )}
    </div>
  );
}
