'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ContactForm, { type ContactFormData } from '@/components/contacts/ContactForm';
import ContactTagManager from '@/components/contacts/ContactTagManager';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  User,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContactDetail {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  tags: string[];
  source: 'SHOPIFY' | 'CSV' | 'MANUAL' | 'WHATSAPP';
  optInStatus: 'OPTED_IN' | 'OPTED_OUT' | 'PENDING';
  customFields: Record<string, string>;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const sourceColors: Record<string, string> = {
  SHOPIFY: 'bg-green-50 text-green-700 border-green-200',
  CSV: 'bg-purple-50 text-purple-700 border-purple-200',
  MANUAL: 'bg-gray-50 text-gray-700 border-gray-200',
  WHATSAPP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const optInColors: Record<string, string> = {
  OPTED_IN: 'bg-green-50 text-green-700 border-green-200',
  OPTED_OUT: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const optInLabels: Record<string, string> = {
  OPTED_IN: 'Opted In',
  OPTED_OUT: 'Opted Out',
  PENDING: 'Pending',
};

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit mode
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tags inline edit
  const [editingTags, setEditingTags] = useState(false);
  const [tempTags, setTempTags] = useState<string[]>([]);

  // Custom fields inline edit
  const [editingCustomFields, setEditingCustomFields] = useState(false);
  const [tempCustomFields, setTempCustomFields] = useState<Record<string, string>>({});

  const fetchContact = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Contact not found');
          return;
        }
        throw new Error('Failed to load contact');
      }
      const data = await res.json();
      setContact(data.contact || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const handleEdit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update contact');
      setShowEditDialog(false);
      fetchContact();
    } catch (err) {
      console.error('Failed to update contact:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete contact');
      router.push('/contacts');
    } catch (err) {
      console.error('Failed to delete contact:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOptInToggle = async () => {
    if (!contact) return;
    const newStatus = contact.optInStatus === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN';
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optInStatus: newStatus }),
      });
      if (res.ok) {
        setContact(prev => prev ? { ...prev, optInStatus: newStatus } : null);
      }
    } catch (err) {
      console.error('Failed to update opt-in status:', err);
    }
  };

  const handleSaveTags = async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tempTags }),
      });
      if (res.ok) {
        setContact(prev => prev ? { ...prev, tags: tempTags } : null);
        setEditingTags(false);
      }
    } catch (err) {
      console.error('Failed to update tags:', err);
    }
  };

  const handleSaveCustomFields = async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customFields: tempCustomFields }),
      });
      if (res.ok) {
        setContact(prev => prev ? { ...prev, customFields: tempCustomFields } : null);
        setEditingCustomFields(false);
      }
    } catch (err) {
      console.error('Failed to update custom fields:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/contacts')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Button>
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{error || 'Contact not found'}</h3>
          <p className="text-gray-500">The contact you are looking for does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
  const initials = [contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/contacts')} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Contacts
      </Button>

      {/* Contact Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </div>
                {contact.email && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    {contact.email}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={cn('text-xs', sourceColors[contact.source])}>
                  {contact.source}
                </Badge>
                <Badge variant="outline" className={cn('text-xs', optInColors[contact.optInStatus])}>
                  {optInLabels[contact.optInStatus]}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tags Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
              {!editingTags ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTempTags([...contact.tags]);
                    setEditingTags(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingTags(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveTags} className="bg-blue-600 hover:bg-blue-700">
                    Save
                  </Button>
                </div>
              )}
            </div>
            {editingTags ? (
              <ContactTagManager tags={tempTags} onChange={setTempTags} />
            ) : contact.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No tags added yet.</p>
            )}
          </div>

          {/* Custom Fields Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
              {!editingCustomFields ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTempCustomFields({ ...contact.customFields });
                    setEditingCustomFields(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingCustomFields(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveCustomFields} className="bg-blue-600 hover:bg-blue-700">
                    Save
                  </Button>
                </div>
              )}
            </div>
            {editingCustomFields ? (
              <div className="space-y-3">
                {Object.entries(tempCustomFields).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-3 items-center">
                    <Label className="text-sm text-gray-600">{key}</Label>
                    <div className="col-span-2">
                      <Input
                        value={value}
                        onChange={e =>
                          setTempCustomFields(prev => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                ))}
                {Object.keys(tempCustomFields).length === 0 && (
                  <p className="text-sm text-gray-400">No custom fields defined.</p>
                )}
              </div>
            ) : Object.keys(contact.customFields).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(contact.customFields).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-500">{key}</span>
                    <span className="text-sm font-medium text-gray-900">{value || '--'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No custom fields set.</p>
            )}
          </div>

          {/* Activity / Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
            <div className="text-center py-10 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Conversation history will appear here</p>
              <p className="text-xs mt-1">Messages, events, and interactions with this contact will be shown in a timeline.</p>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">
          {/* Opt-in Status */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Opt-in Status</h2>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className={cn('text-sm', optInColors[contact.optInStatus])}>
                  {optInLabels[contact.optInStatus]}
                </Badge>
              </div>
              <Switch
                checked={contact.optInStatus === 'OPTED_IN'}
                onCheckedChange={handleOptInToggle}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Toggle to opt-in or opt-out this contact from receiving WhatsApp messages.
            </p>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Full Name</p>
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                </div>
              </div>
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Created</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(contact.createdAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(contact.updatedAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              {contact.lastMessageAt && (
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Last Message</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(contact.lastMessageAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Contact Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact information below.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            contact={{
              phone: contact.phone,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email || '',
              tags: contact.tags,
              optInStatus: contact.optInStatus,
              source: contact.source,
              customFields: contact.customFields,
            }}
            onSubmit={handleEdit}
            onCancel={() => setShowEditDialog(false)}
            isEdit
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {displayName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
