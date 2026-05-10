'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  gradient?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
  gradient = false,
}: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // Focus trap - focus first focusable element when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const modal = document.querySelector('[role="dialog"]') as HTMLElement;
    if (modal) {
      const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 0);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-7xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-lg shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col overflow-y-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className={`px-6 py-6 border-b ${gradient ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-white'} rounded-t-lg relative`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <h2 id="modal-title" className="text-2xl font-bold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-6 bg-gray-50 border-t rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

