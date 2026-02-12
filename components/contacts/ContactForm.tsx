'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ContactTagManager from '@/components/contacts/ContactTagManager';
import { Loader2 } from 'lucide-react';

interface CustomFieldDefinition {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';
  options?: string[];
  isRequired: boolean;
}

export interface ContactFormData {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  tags: string[];
  optInStatus: 'OPTED_IN' | 'OPTED_OUT' | 'PENDING';
  source?: 'SHOPIFY' | 'CSV' | 'MANUAL' | 'WHATSAPP';
  customFields: Record<string, string>;
}

interface ContactFormProps {
  contact?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

export default function ContactForm({ contact, onSubmit, onCancel, isEdit = false, isSubmitting = false }: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    phone: contact?.phone || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    tags: contact?.tags || [],
    optInStatus: contact?.optInStatus || 'PENDING',
    source: contact?.source || 'MANUAL',
    customFields: contact?.customFields || {},
  });

  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchCustomFields() {
      try {
        const res = await fetch('/api/contacts/custom-fields');
        if (res.ok) {
          const data = await res.json();
          setCustomFieldDefs(data.fields || []);
        }
      } catch {
        // Custom fields are optional; silently ignore
      }
    }
    fetchCustomFields();
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    // Check required custom fields
    for (const def of customFieldDefs) {
      if (def.isRequired && !formData.customFields[def.fieldName]?.trim()) {
        newErrors[`cf_${def.fieldName}`] = `${def.fieldLabel} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const updateField = (field: keyof ContactFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updateCustomField = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value },
    }));
    const errorKey = `cf_${fieldName}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
        <Input
          id="phone"
          placeholder="+91 9876543210"
          value={formData.phone}
          onChange={e => updateField('phone', e.target.value)}
          className={errors.phone ? 'border-red-500' : ''}
        />
        {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="John"
            value={formData.firstName}
            onChange={e => updateField('firstName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            value={formData.lastName}
            onChange={e => updateField('lastName', e.target.value)}
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={e => updateField('email', e.target.value)}
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <ContactTagManager
          tags={formData.tags}
          onChange={tags => updateField('tags', tags)}
          placeholder="Type and press Enter to add tags"
        />
      </div>

      {/* Opt-in Status */}
      <div className="space-y-1.5">
        <Label htmlFor="optInStatus">Opt-in Status</Label>
        <select
          id="optInStatus"
          value={formData.optInStatus}
          onChange={e => updateField('optInStatus', e.target.value)}
          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="PENDING">Pending</option>
          <option value="OPTED_IN">Opted In</option>
          <option value="OPTED_OUT">Opted Out</option>
        </select>
      </div>

      {/* Source (only on create) */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="source">Source</Label>
          <select
            id="source"
            value={formData.source}
            onChange={e => updateField('source', e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="MANUAL">Manual</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="CSV">CSV Import</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </div>
      )}

      {/* Custom Fields */}
      {customFieldDefs.length > 0 && (
        <div className="space-y-4">
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Fields</h4>
          </div>
          {customFieldDefs.map(def => (
            <div key={def.id} className="space-y-1.5">
              <Label htmlFor={`cf_${def.fieldName}`}>
                {def.fieldLabel}
                {def.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              {def.fieldType === 'SELECT' ? (
                <select
                  id={`cf_${def.fieldName}`}
                  value={formData.customFields[def.fieldName] || ''}
                  onChange={e => updateCustomField(def.fieldName, e.target.value)}
                  className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                    errors[`cf_${def.fieldName}`] ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {def.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : def.fieldType === 'BOOLEAN' ? (
                <select
                  id={`cf_${def.fieldName}`}
                  value={formData.customFields[def.fieldName] || ''}
                  onChange={e => updateCustomField(def.fieldName, e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select...</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <Input
                  id={`cf_${def.fieldName}`}
                  type={def.fieldType === 'NUMBER' ? 'number' : def.fieldType === 'DATE' ? 'date' : 'text'}
                  value={formData.customFields[def.fieldName] || ''}
                  onChange={e => updateCustomField(def.fieldName, e.target.value)}
                  className={errors[`cf_${def.fieldName}`] ? 'border-red-500' : ''}
                />
              )}
              {errors[`cf_${def.fieldName}`] && (
                <p className="text-xs text-red-500">{errors[`cf_${def.fieldName}`]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEdit ? 'Update Contact' : 'Add Contact'}
        </Button>
      </div>
    </form>
  );
}
