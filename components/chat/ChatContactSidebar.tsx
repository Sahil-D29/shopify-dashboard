'use client';

import { User, Mail, Phone, Tag, ShoppingBag, Calendar, ExternalLink } from 'lucide-react';
import { formatPhoneDisplay } from '@/lib/whatsapp/normalize-phone';
import { format } from 'date-fns';
import { InternalNotes } from './InternalNotes';
import type { Conversation, ConversationContact } from '@/lib/types/chat';

interface ChatContactSidebarProps {
  conversation: Conversation;
}

export function ChatContactSidebar({ conversation }: ChatContactSidebarProps) {
  const contact = conversation.contact;
  if (!contact) return null;

  const displayName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const tags = Array.isArray(contact.tags) ? contact.tags : [];

  return (
    <div className="flex h-full w-[360px] flex-col border-l bg-white overflow-y-auto">
      {/* Contact header */}
      <div className="flex flex-col items-center border-b px-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt={displayName} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-white">{initials}</span>
          )}
        </div>
        <h3 className="mt-3 text-base font-semibold text-gray-900">{displayName}</h3>
        <p className="text-sm text-gray-500">{formatPhoneDisplay(contact.phone)}</p>

        {/* Opt-in status */}
        <span className={`mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          contact.optInStatus === 'OPTED_IN'
            ? 'bg-green-100 text-green-700'
            : contact.optInStatus === 'OPTED_OUT'
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {contact.optInStatus.replace('_', ' ')}
        </span>
      </div>

      {/* Contact details */}
      <div className="border-b px-4 py-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase text-gray-400">Contact Details</h4>

        {contact.email && (
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 truncate">{contact.email}</span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <Phone className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatPhoneDisplay(contact.phone)}</span>
        </div>

        {contact.lastMessageAt && (
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700">
              Last message: {format(new Date(contact.lastMessageAt), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
        )}

        {contact.shopifyCustomerId && (
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-blue-600 flex items-center gap-1">
              Shopify Customer
              <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="border-b px-4 py-4">
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom Fields */}
      {contact.customFields && Object.keys(contact.customFields).length > 0 && (
        <div className="border-b px-4 py-4">
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Custom Fields</h4>
          <div className="space-y-1.5">
            {Object.entries(contact.customFields).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{key}</span>
                <span className="text-xs font-medium text-gray-700">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Notes */}
      <InternalNotes conversationId={conversation.id} />
    </div>
  );
}
