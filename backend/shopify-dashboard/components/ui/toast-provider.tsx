'use client';

import { ToastContainer } from './toast';
import { useToastStore } from '@/lib/hooks/useToast';
import Toast from './toast';

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  return (
    <ToastContainer>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContainer>
  );
}

