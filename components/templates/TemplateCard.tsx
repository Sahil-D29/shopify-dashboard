'use client';

import { WhatsAppTemplate } from '@/lib/types/template';
import { Edit, Trash2, Send, Copy, MoreVertical, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import TemplateStatusBadge from './TemplateStatusBadge';
import { format } from 'date-fns';

interface TemplateCardProps {
  template: WhatsAppTemplate;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onEdit: (template: WhatsAppTemplate) => void;
}

export default function TemplateCard({ template, onDelete, onRefresh, onEdit }: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const MAX_BODY_LENGTH = 150; // characters
  const bodyText = template.body || '';
  const shouldTruncate = bodyText.length > MAX_BODY_LENGTH;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'UTILITY': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'AUTHENTICATION': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSendTest = async () => {
    const phoneNumber = prompt('Enter phone number (with country code, e.g., 919876543210):');
    if (!phoneNumber) return;

    const variableValues: Record<string, string> = {};
    for (const varName of template.variables) {
      const value = prompt(`Enter value for {{${varName}}}:`);
      if (value === null) return;
      variableValues[varName] = value;
    }

    try {
      const response = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: template.name,
          phoneNumber,
          variables: variableValues,
          language: template.language,
        }),
      });

      if (response.ok) {
        alert('✅ Test message sent successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to send: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to send test message', error);
      alert('❌ Error sending test message');
    }
  };

  const handleCopy = async () => {
    try {
      // Create a copy with new name
      const newName = `${template.name}_copy`;
      const copyData = {
        ...template,
        name: newName,
        id: undefined,
        metaTemplateId: undefined,
        status: 'DRAFT',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const response = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copyData),
      });

      if (response.ok) {
        alert('✅ Template copied successfully!');
        onRefresh();
      } else {
        alert('❌ Failed to copy template');
      }
    } catch (error) {
      console.error('Failed to copy template', error);
      alert('❌ Error copying template');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col min-h-[240px] group cursor-pointer">
      {/* Header - Template Name & Status Badges */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Template Name - More prominent */}
            <h3 className="text-lg font-bold text-gray-900 truncate mb-2 leading-tight">
              {template.name}
            </h3>
            
            {/* Badges - Consistent styling with icons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Status Badge with icon */}
              <TemplateStatusBadge status={template.status} />
              
              {/* Category Badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 ${getCategoryColor(template.category)}`}>
                {template.category}
              </span>
              
              {/* Language Badge */}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                {template.language.toUpperCase()}
              </span>
            </div>
          </div>
          
          {/* Actions Menu - Appears on hover */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Template actions"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                  {template.status === 'APPROVED' && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation();
                        handleSendTest(); 
                        setShowMenu(false); 
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send Test
                    </button>
                  )}
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      onEdit(template); 
                      setShowMenu(false); 
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      handleCopy(); 
                      setShowMenu(false); 
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      onDelete(template.id); 
                      setShowMenu(false); 
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body - Template Content Preview with Read More functionality */}
      <div className="flex-1 p-5 overflow-hidden min-h-0">
        <div className="h-full flex flex-col">
          {/* Header text (if exists) */}
          {template.header && (
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide truncate">
              📋 {typeof template.header === 'string' ? template.header : template.header.content}
            </div>
          )}
          
          {/* Body text - 4 lines max with Read More functionality */}
          <div className="relative flex-1">
            <p className={`
              text-sm text-gray-700 leading-relaxed
              ${!isExpanded && shouldTruncate ? 'line-clamp-4' : ''}
            `}>
              {bodyText}
            </p>
            
            {/* Read More / Read Less Button */}
            {shouldTruncate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium mt-1.5 flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Read less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Read more
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Footer text (if exists) */}
          {template.footer && (
            <div className="text-xs text-gray-500 mt-2 italic border-t border-gray-100 pt-2">
              {template.footer}
            </div>
          )}
          
          {/* Buttons preview (if exists) */}
          {template.buttons && template.buttons.length > 0 && (
            <div className="mt-2 space-y-1">
              {template.buttons.map((btn, idx) => (
                <div key={idx} className="text-xs text-blue-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  {btn.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Metadata with consistent styling */}
      <div className="p-5 border-t border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600">
          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-medium">
              {format(new Date(template.updatedAt || template.createdAt), 'MMM dd, yyyy')}
            </span>
          </div>
          
          {/* Character count or usage stats */}
          <div className="flex items-center gap-2">
            {template.messagesSent > 0 ? (
              <span className="font-medium">{template.messagesSent} sent</span>
            ) : (
              <span className="text-gray-500">
                {(template.body || '').length} chars
              </span>
            )}
          </div>
        </div>
        
        {/* Rejection reason (if rejected) */}
        {template.status === 'REJECTED' && template.rejectionReason && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            <strong className="block mb-0.5">Rejection reason:</strong>
            <span className="line-clamp-1">{template.rejectionReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
