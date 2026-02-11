'use client';

import { Button } from './button';
import Modal from './modal';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const variantConfig = {
    danger: {
      icon: <XCircle className="w-16 h-16 text-red-500" />,
      buttonClass: 'bg-red-600 hover:bg-red-700',
      bgClass: 'bg-red-50',
    },
    warning: {
      icon: <AlertTriangle className="w-16 h-16 text-orange-500" />,
      buttonClass: 'bg-orange-600 hover:bg-orange-700',
      bgClass: 'bg-orange-50',
    },
    info: {
      icon: <Info className="w-16 h-16 text-blue-500" />,
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
      bgClass: 'bg-blue-50',
    },
    success: {
      icon: <CheckCircle className="w-16 h-16 text-green-500" />,
      buttonClass: 'bg-green-600 hover:bg-green-700',
      bgClass: 'bg-green-50',
    },
  };

  const config = variantConfig[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      closeOnOverlay={!loading}
      showCloseButton={false}
    >
      <div className="text-center py-4">
        <div className={`mx-auto w-20 h-20 rounded-full ${config.bgClass} flex items-center justify-center mb-6`}>
          {config.icon}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={onClose}
            variant="outline"
            size="lg"
            disabled={loading}
            className="min-w-[120px]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            size="lg"
            disabled={loading}
            className={`${config.buttonClass} min-w-[120px]`}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

