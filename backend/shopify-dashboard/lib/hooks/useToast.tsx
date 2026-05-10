"use client";

import { useMemo } from 'react';
import { create } from 'zustand';
import { ToastType } from '@/components/ui/toast';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id =
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `toast_${Math.random().toString(36).slice(2, 10)}`);

    const scheduleUpdate = (updater: () => void) => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(updater);
      } else {
        setTimeout(updater, 0);
      }
    };

    scheduleUpdate(() => {
      set((state) => ({
        toasts: [...state.toasts, { id, type, message }],
      }));
    });
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

export const useToast = () => {
  const addToast = useToastStore(state => state.addToast);

  return useMemo(
    () => ({
      success: (message: string) => addToast('success', message),
      error: (message: string) => addToast('error', message),
      warning: (message: string) => addToast('warning', message),
      info: (message: string) => addToast('info', message),
    }),
    [addToast],
  );
};

