'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Package,
  Percent,
  Code2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

const ProductPicker = dynamic(() => import('@/components/email/ProductPicker'), { ssr: false });
const DiscountGenerator = dynamic(() => import('@/components/email/DiscountGenerator'), { ssr: false });

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string;
  mjmlBody?: string;
  htmlBody?: string;
}

export default function EditEmailBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('custom');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [mergeTags, setMergeTags] = useState<Array<{ tag: string; description: string }>>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showDiscountGen, setShowDiscountGen] = useState(false);

  useEffect(() => {
    fetch(`${EMAIL_API}/merge-tags`).then(r => r.json()).then(d => setMergeTags(d.tags || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (templateId) {
      fetch(`${EMAIL_API}/templates/${templateId}`)
        .then(r => r.json())
        .then(d => {
          const t = d.template;
          setTemplate(t);
          setName(t.name);
          setSubject(t.subject);
          setCategory(t.category);
        })
        .catch(() => toast.error('Failed to load template'));
    }
  }, [templateId]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    async function initEditor() {
      const grapesjs = (await import('grapesjs')).default;
      const grapesjsMjml = (await import('grapesjs-mjml')).default;
      await import('grapesjs/dist/css/grapes.min.css');

      const editor = grapesjs.init({
        container: containerRef.current!,
        height: '100%',
        width: 'auto',
        fromElement: false,
        storageManager: false,
        plugins: [grapesjsMjml],
        pluginsOpts: { [grapesjsMjml as any]: {} },
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Mobile', width: '375px' },
          ],
        },
        panels: { defaults: [] },
      });

      if (template?.mjmlBody) {
        editor.setComponents(template.mjmlBody);
      } else {
        editor.setComponents(`<mjml><mj-body><mj-section><mj-column><mj-text>Edit your email here</mj-text></mj-column></mj-section></mj-body></mjml>`);
      }

      editorRef.current = editor;
    }

    initEditor();

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [template]);

  async function handleSave() {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    setSaving(true);
    try {
      const editor = editorRef.current;
      const mjmlBody = editor.getHtml();
      let htmlBody = '';
      try {
        const compileRes = await fetch(`${EMAIL_API}/compile-mjml`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mjml: mjmlBody }),
        });
        if (compileRes.ok) {
          const d = await compileRes.json();
          htmlBody = d.html;
        }
      } catch { htmlBody = mjmlBody; }

      const payload = { name, subject, category, mjmlBody, htmlBody, jsonDesign: JSON.stringify(editor.getProjectData()), storeId: 'tsg-api.myshopify.com' };
      const res = await fetch(`${EMAIL_API}/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Template updated!');
        router.push('/email/templates');
      }
    } catch { toast.error('Failed to save template'); }
    finally { setSaving(false); }
  }

  function handleDeviceSwitch(mode: string) {
    setPreviewMode(mode);
    editorRef.current?.setDevice(mode === 'mobile' ? 'Mobile' : 'Desktop');
  }

  function insertMergeTag(tag: string) {
    const editor = editorRef.current;
    if (editor) {
      const selected = editor.getSelected();
      if (selected) selected.set('content', (selected.get('content') || '') + tag);
    }
    setShowMergeTags(false);
  }

  function handleProductsSelected(products: any[]) {
    if (editorRef.current && products.length > 0) {
      const { generateProductMjml } = require('@/components/email/ProductPicker');
      const mjmlBlocks = products.map((p: any) => generateProductMjml(p)).join('\n');
      const editor = editorRef.current;
      const existing = editor.getHtml();
      const insertPoint = existing.lastIndexOf('</mj-body>');
      if (insertPoint > -1) {
        editor.setComponents(existing.slice(0, insertPoint) + mjmlBlocks + existing.slice(insertPoint));
      }
      toast.success(`${products.length} product block(s) added!`);
    }
    setShowProductPicker(false);
  }

  function handleDiscountInsert(code: string) {
    const editor = editorRef.current;
    if (editor) {
      const selected = editor.getSelected();
      if (selected) selected.set('content', (selected.get('content') || '') + code);
    }
    toast.success(`Discount code ${code} inserted!`);
    setShowDiscountGen(false);
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/email/templates')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template Name" className="text-lg font-semibold border-transparent hover:border-gray-300 focus:border-blue-500 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => handleDeviceSwitch('desktop')} className={cn('px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1', previewMode === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}>
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
            <button onClick={() => handleDeviceSwitch('mobile')} className={cn('px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1', previewMode === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}>
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowProductPicker(true)}>
            <Package className="h-4 w-4 mr-1" /> Products
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDiscountGen(true)}>
            <Percent className="h-4 w-4 mr-1" /> Discount
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowMergeTags(!showMergeTags)}>
              <Code2 className="h-4 w-4 mr-1" /> Merge Tags
            </Button>
            {showMergeTags && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 max-h-64 overflow-auto">
                {mergeTags.map((mt) => (
                  <button key={mt.tag} onClick={() => insertMergeTag(mt.tag)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0">
                    <span className="font-mono text-blue-600">{mt.tag}</span>
                    <span className="block text-xs text-gray-400">{mt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Update Template'}
          </Button>
        </div>
      </div>

      <div className="bg-gray-50 border-b px-6 py-2 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-500 font-medium">Subject:</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line..." className="flex-1 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Category:</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none">
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

      <div className="flex-1 overflow-hidden" ref={containerRef} />

      {showProductPicker && <ProductPicker onSelect={handleProductsSelected} onClose={() => setShowProductPicker(false)} />}
      {showDiscountGen && <DiscountGenerator onInsert={handleDiscountInsert} onClose={() => setShowDiscountGen(false)} />}
    </div>
  );
}
