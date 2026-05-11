'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import TemplatePreview from './TemplatePreview';
import { CreateTemplateRequest, TemplateCategory, HeaderType, ButtonType, WhatsAppTemplate } from '@/lib/types/template';
import { WhatsAppConfigManager } from '@/lib/whatsapp-config';
import { TemplateValidator } from '@/lib/utils/template-validator';
import { X, Plus, Trash2, Eye, Bold, Italic, Code, Smile, Image as ImageIcon, Video, FileText } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  editTemplate?: WhatsAppTemplate | null;
}

export default function CreateTemplateModal({ open, onClose, onCreated, editTemplate }: Props) {
  const [formData, setFormData] = useState<CreateTemplateRequest>({
    name: editTemplate?.name || '',
    category: editTemplate?.category || 'UTILITY',
    language: editTemplate?.language || 'en',
    body: editTemplate?.body || '',
    sampleValues: editTemplate?.sampleValues || {},
  });

  const [headerType, setHeaderType] = useState<HeaderType>(editTemplate?.header?.type || 'NONE');
  const [headerContent, setHeaderContent] = useState(editTemplate?.header?.content || '');
  const [footer, setFooter] = useState(editTemplate?.footer || '');
  const [buttons, setButtons] = useState(editTemplate?.buttons || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHeaderEmojiPicker, setShowHeaderEmojiPicker] = useState(false);
  const [showFooterEmojiPicker, setShowFooterEmojiPicker] = useState(false);
  
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);

  // Reset form when editTemplate changes
  useEffect(() => {
    if (editTemplate) {
      setFormData({
        name: editTemplate.name,
        category: editTemplate.category,
        language: editTemplate.language,
        body: editTemplate.body,
        sampleValues: editTemplate.sampleValues || {},
      });
      setHeaderType(editTemplate.header?.type || 'NONE');
      setHeaderContent(editTemplate.header?.content || '');
      setFooter(editTemplate.footer || '');
      setButtons(editTemplate.buttons || []);
    } else {
      setFormData({
        name: '',
        category: 'UTILITY',
        language: 'en',
        body: '',
        sampleValues: {},
      });
      setHeaderType('NONE');
      setHeaderContent('');
      setFooter('');
      setButtons([]);
    }
  }, [editTemplate, open]);

  // Extract variables from body text
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const variables = useMemo(() => extractVariables(formData.body), [formData.body]);

  useEffect(() => {
    setFormData(prev => {
      const next = { ...prev };
      const newSampleValues = { ...next.sampleValues };
      variables.forEach(v => { if (!(v in newSampleValues)) newSampleValues[v] = ''; });
      Object.keys(newSampleValues).forEach(k => { if (!variables.includes(k)) delete newSampleValues[k]; });
      return { ...next, sampleValues: newSampleValues };
    });
  }, [variables]);

  // Text formatting functions
  const insertFormatting = (format: 'bold' | 'italic' | 'code') => {
    if (!bodyRef.current) return;

    const start = bodyRef.current.selectionStart;
    const end = bodyRef.current.selectionEnd;
    const selectedText = formData.body.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `*${selectedText}*`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'code':
        formattedText = `\`\`\`${selectedText}\`\`\``;
        break;
    }

    const newBody = formData.body.substring(0, start) + formattedText + formData.body.substring(end);
    setFormData({ ...formData, body: newBody });
    
    // Restore cursor position
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  };

  // Insert variable
  const insertVariable = () => {
    if (!bodyRef.current) return;

    const varName = prompt('Enter variable name (e.g., customer_name, order_id):');
    if (!varName) return;

    const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
    const start = bodyRef.current.selectionStart;
    const variable = `{{${cleanVarName}}}`;
    
    const newBody = formData.body.substring(0, start) + variable + formData.body.substring(start);
    setFormData({ ...formData, body: newBody });
    
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(start + variable.length, start + variable.length);
      }
    }, 0);
  };

  // Insert emoji
  const insertEmoji = (emojiData: any, target: 'body' | 'header' | 'footer') => {
    const emoji = emojiData.emoji;
    
    switch (target) {
      case 'body':
        if (bodyRef.current) {
          const start = bodyRef.current.selectionStart;
          const newBody = formData.body.substring(0, start) + emoji + formData.body.substring(start);
          setFormData({ ...formData, body: newBody });
        }
        setShowEmojiPicker(false);
        break;
      case 'header':
        setHeaderContent(prev => prev + emoji);
        setShowHeaderEmojiPicker(false);
        break;
      case 'footer':
        setFooter(prev => prev + emoji);
        setShowFooterEmojiPicker(false);
        break;
    }
  };

  // Handle file upload for header
  const handleHeaderFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In production, upload to your storage and get URL
    // For now, create a local URL for preview
    const fileUrl = URL.createObjectURL(file);
    setHeaderContent(fileUrl);
    
    alert('Note: In production, this file will be uploaded to your storage service. For now, using local preview.');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Template name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (!/^[a-z0-9_]+$/.test(formData.name)) {
      newErrors.name = 'Name must be lowercase with underscores only';
    } else if (formData.name.length > 512) {
      newErrors.name = 'Name must be less than 512 characters';
    }

    // Body validation
    if (!formData.body.trim()) {
      newErrors.body = 'Body text is required';
    } else if (formData.body.length > 1024) {
      newErrors.body = 'Body must be less than 1024 characters';
    }

    // Header validation
    if (headerType !== 'NONE' && !headerContent.trim()) {
      newErrors.header = 'Header content is required';
    }

    // Footer validation
    if (footer && footer.length > 60) {
      newErrors.footer = 'Footer must be less than 60 characters';
    }

    // Variables validation
    const variables = extractVariables(formData.body);
    variables.forEach(varName => {
      if (!formData.sampleValues[varName]?.trim()) {
        newErrors[`var_${varName}`] = `Sample value for {{${varName}}} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const templateData = {
        ...formData,
        header: headerType !== 'NONE' ? { type: headerType, content: headerContent } : undefined,
        footer: footer || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
        variables: extractVariables(formData.body),
      };

      const url = editTemplate 
        ? `/api/whatsapp/templates/${editTemplate.id}`
        : '/api/whatsapp/templates';
      
      const method = editTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...templateData, status: 'DRAFT' }),
      });

      if (response.ok) {
        alert(editTemplate ? '✅ Template updated successfully!' : '✅ Template saved as draft!');
        onCreated();
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Failed to save: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error saving template');
    } finally {
          setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!validateForm()) {
      alert('Please fix all errors before submitting');
          return;
        }

    if (editTemplate && editTemplate.status === 'APPROVED') {
      alert('This template is already approved. Edit will create a new version.');
    }

    if (!confirm('Submit this template to Meta for approval? You cannot edit it after submission.')) {
        return;
      }

    setSubmitting(true);
    try {
      const templateData = {
        ...formData,
        header: headerType !== 'NONE' ? { type: headerType, content: headerContent } : undefined,
        footer: footer || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
        variables: extractVariables(formData.body),
      };

      // Create template
      const createResponse = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });
      
      if (!createResponse.ok) {
        throw new Error('Failed to create template');
      }
      
      const { template } = await createResponse.json();

      // Submit to Meta
        const cfg = WhatsAppConfigManager.getConfig();
        if (!cfg?.wabaId || !cfg?.accessToken) {
        alert('WhatsApp not configured. Please configure in Settings → WhatsApp first.');
          onCreated();
          onClose();
        setSubmitting(false);
          return;
        }

      const submitResponse = await fetch(`/api/whatsapp/templates/${template.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wabaId: cfg.wabaId, accessToken: cfg.accessToken }),
      });

      if (submitResponse.ok) {
        alert('✅ Template submitted for approval! Check back in a few hours for approval status.');
          onCreated();
          onClose();
      } else {
        const error = await submitResponse.json();
        alert(`❌ Failed to submit: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error submitting template');
    } finally {
      setSubmitting(false);
    }
  };

  const addButton = () => {
    if (buttons.length >= 3) {
      alert('Maximum 3 buttons allowed');
      return;
    }
    setButtons([...buttons, { type: 'URL', text: '', url: '' }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
        {/* Form Section */}
        <div className="overflow-y-auto">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b relative">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {editTemplate ? 'Edit Template' : 'Create Template'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {editTemplate ? 'Update your WhatsApp message template' : 'Design your WhatsApp message template'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
        </div>

            {/* Form */}
            <div className="space-y-8">
              {/* Template Name */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <Label htmlFor="name" className="text-base font-semibold mb-3 block">
                  Template Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  placeholder="order_confirmation"
                  className="text-base"
                  disabled={editTemplate?.status === 'APPROVED'}
                />
                {errors.name && <p className="text-sm text-red-600 mt-2">{errors.name}</p>}
                <p className="text-sm text-gray-600 mt-2">Lowercase letters, numbers, and underscores only</p>
            </div>

              {/* Category & Language */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <Label htmlFor="category" className="text-base font-semibold mb-3 block">
                    Category *
                  </Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as TemplateCategory })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    <option value="MARKETING">🛍️ Marketing</option>
                    <option value="UTILITY">⚙️ Utility</option>
                    <option value="AUTHENTICATION">🔐 Authentication</option>
                </select>
              </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <Label htmlFor="language" className="text-base font-semibold mb-3 block">
                    Language *
                  </Label>
                  <select
                    id="language"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    <option value="en">English</option>
                    <option value="en_US">English (US)</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="pt_BR">Portuguese (BR)</option>
                  </select>
              </div>
            </div>

              {/* Header Section */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <Label className="text-base font-semibold mb-3 block">Header (Optional)</Label>
                <select
                  value={headerType}
                  onChange={(e) => setHeaderType(e.target.value as HeaderType)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base mb-4"
                >
                  <option value="NONE">None</option>
                  <option value="TEXT">📝 Text</option>
                  <option value="IMAGE">🖼️ Image</option>
                  <option value="VIDEO">🎥 Video</option>
                  <option value="DOCUMENT">📄 Document</option>
                </select>

                {headerType !== 'NONE' && (
                  <div className="space-y-3">
                    {headerType === 'TEXT' ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            ref={headerRef}
                            value={headerContent}
                            onChange={(e) => setHeaderContent(e.target.value)}
                            placeholder="Header text (max 60 characters)"
                            maxLength={60}
                            className="flex-1 text-base"
                          />
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowHeaderEmojiPicker(!showHeaderEmojiPicker)}
                            >
                              <Smile className="w-4 h-4" />
                            </Button>
                            {showHeaderEmojiPicker && (
                              <div className="absolute right-0 top-12 z-50">
                                <EmojiPicker onEmojiClick={(emoji) => insertEmoji(emoji, 'header')} />
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{headerContent.length}/60 characters</p>
                      </div>
                    ) : (
                      <div>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <input
                            type="file"
                            accept={
                              headerType === 'IMAGE' ? 'image/*' :
                              headerType === 'VIDEO' ? 'video/*' :
                              '.pdf,.doc,.docx'
                            }
                            onChange={handleHeaderFileUpload}
                            className="hidden"
                            id="header-file"
                          />
                          <label
                            htmlFor="header-file"
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            {headerType === 'IMAGE' && <ImageIcon className="w-12 h-12 text-gray-400" />}
                            {headerType === 'VIDEO' && <Video className="w-12 h-12 text-gray-400" />}
                            {headerType === 'DOCUMENT' && <FileText className="w-12 h-12 text-gray-400" />}
                            <span className="text-sm text-gray-600">
                              Click to upload {headerType.toLowerCase()} or enter URL below
                            </span>
                          </label>
                        </div>
                        <Input
                          value={headerContent}
                          onChange={(e) => setHeaderContent(e.target.value)}
                          placeholder={`${headerType} URL (https://...)`}
                          className="mt-3 text-base"
                        />
                        {headerContent && (
                          <p className="text-sm text-green-600 mt-2">✓ {headerType} URL set</p>
                        )}
              </div>
                    )}
                    {errors.header && <p className="text-sm text-red-600">{errors.header}</p>}
                </div>
              )}
            </div>

              {/* Body Section with Formatting Toolbar */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <Label htmlFor="body" className="text-base font-semibold mb-3 block">
                  Body Text *
                </Label>
                
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg border border-gray-300">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('bold')}
                    title="Bold (*text*)"
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('italic')}
                    title="Italic (_text_)"
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('code')}
                    title="Code (```text```)"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-1"></div>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Insert Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                    {showEmojiPicker && (
                      <div className="absolute left-0 top-12 z-50">
                        <EmojiPicker onEmojiClick={(emoji) => insertEmoji(emoji, 'body')} />
                      </div>
              )}
            </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={insertVariable}
                    title="Insert Variable"
                  >
                    <span className="text-sm font-mono">{'{{x}}'}</span>
                  </Button>
                  <div className="flex-1"></div>
                  <span className="text-xs text-gray-500">
                    {formData.body.length}/1024
                  </span>
                </div>

                <Textarea
                  ref={bodyRef}
                  id="body"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Hi {{customer_name}}, your order {{order_id}} has been confirmed."
                  rows={8}
                  className="text-base font-mono resize-none"
                  maxLength={1024}
                />
                
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                  <div className="flex flex-wrap gap-2">
                    <span>💡 Formatting:</span>
                    <code className="bg-white px-2 py-0.5 rounded">*bold*</code>
                    <code className="bg-white px-2 py-0.5 rounded">_italic_</code>
                    <code className="bg-white px-2 py-0.5 rounded">```code```</code>
                    <code className="bg-white px-2 py-0.5 rounded">{'{{variable}}'}</code>
                  </div>
                </div>
                {errors.body && <p className="text-sm text-red-600 mt-2">{errors.body}</p>}
            </div>

              {/* Variables Sample Values */}
            {variables.length > 0 && (
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                  <Label className="text-base font-semibold mb-3 block text-blue-900">
                    Sample Values for Variables *
                  </Label>
                  <p className="text-sm text-blue-700 mb-4">
                    Provide example values for approval. These help Meta understand your template.
                  </p>
                  <div className="space-y-3">
                    {variables.map((varName, idx) => (
                      <div key={idx}>
                        <Label htmlFor={`var-${varName}`} className="text-sm font-medium mb-1 block">
                          {'{{'}{varName}{'}}'}
                        </Label>
                        <Input
                          id={`var-${varName}`}
                          value={formData.sampleValues[varName] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            sampleValues: { ...formData.sampleValues, [varName]: e.target.value }
                          })}
                          placeholder={`Example: ${varName === 'customer_name' ? 'John Doe' : varName === 'order_id' ? 'ORD12345' : 'Sample value'}`}
                          className="text-base"
                        />
                        {errors[`var_${varName}`] && (
                          <p className="text-sm text-red-600 mt-1">{errors[`var_${varName}`]}</p>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

              {/* Footer */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <Label htmlFor="footer" className="text-base font-semibold mb-3 block">
                  Footer (Optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={footerRef}
                    id="footer"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder="Thank you for shopping with us"
                    maxLength={60}
                    className="flex-1 text-base"
                  />
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFooterEmojiPicker(!showFooterEmojiPicker)}
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                    {showFooterEmojiPicker && (
                      <div className="absolute right-0 top-12 z-50">
                        <EmojiPicker onEmojiClick={(emoji) => insertEmoji(emoji, 'footer')} />
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{footer.length}/60 characters</p>
                {errors.footer && <p className="text-sm text-red-600 mt-2">{errors.footer}</p>}
              </div>

              {/* Buttons */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold">Buttons (Optional, max 3)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addButton}
                    disabled={buttons.length >= 3}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Button
                  </Button>
                </div>

                <div className="space-y-4">
                  {buttons.map((button, idx) => (
                    <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <select
                            value={button.type}
                            onChange={(e) => updateButton(idx, 'type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                          >
                            <option value="URL">🔗 Call to Action (URL)</option>
                            <option value="PHONE_NUMBER">📞 Phone Number</option>
                            <option value="QUICK_REPLY">💬 Quick Reply</option>
                          </select>

                          <Input
                            value={button.text}
                            onChange={(e) => updateButton(idx, 'text', e.target.value)}
                            placeholder="Button text (e.g., Track Order, Call Us)"
                            className="text-base"
                          />

                          {button.type === 'URL' && (
                            <Input
                              value={button.url || ''}
                              onChange={(e) => updateButton(idx, 'url', e.target.value)}
                              placeholder="https://example.com or https://example.com/{{1}}"
                              className="text-base"
                            />
                          )}

                          {button.type === 'PHONE_NUMBER' && (
                            <Input
                              value={button.phoneNumber || ''}
                              onChange={(e) => updateButton(idx, 'phoneNumber', e.target.value)}
                              placeholder="+919876543210"
                              className="text-base"
                            />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeButton(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {buttons.length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    No buttons added. Click "Add Button" to create interactive buttons.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-10 pt-6 border-t sticky bottom-0 bg-white">
              <Button
                onClick={handleSaveDraft}
                disabled={saving || submitting}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                {saving ? 'Saving...' : editTemplate ? 'Update Draft' : 'Save as Draft'}
              </Button>

              <Button
                onClick={handleSubmitForApproval}
                disabled={saving || submitting}
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>

              <Button 
                onClick={onClose} 
                variant="ghost" 
                size="lg"
              >
                Cancel
              </Button>
            </div>
            </div>
          </div>

        {/* Preview Panel - Hidden for now, can be shown in a separate modal if needed */}
        <div className="hidden w-[450px] bg-gradient-to-br from-gray-50 to-gray-100 border-l p-8 overflow-y-auto">
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-gray-900">Live Preview</h3>
              <Button
                size="sm"
                variant="ghost"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>

            <TemplatePreview
              header={headerType !== 'NONE' ? { type: headerType, content: headerContent } : undefined}
              body={formData.body}
              footer={footer}
              buttons={buttons}
              sampleValues={formData.sampleValues}
            />

            {/* Preview Tips */}
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 text-sm">
              <h4 className="font-semibold mb-2 text-gray-900">Preview Tips:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Variables shown with sample values</li>
                <li>• Formatting will render in WhatsApp</li>
                <li>• Buttons appear at the bottom</li>
                <li>• Actual message may vary slightly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


