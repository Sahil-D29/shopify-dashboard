'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ type, message, onClose, duration = 5000 }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      icon: <CheckCircle className="w-6 h-6" />,
      bgClass: 'bg-green-500',
      textClass: 'text-white',
    },
    error: {
      icon: <XCircle className="w-6 h-6" />,
      bgClass: 'bg-red-500',
      textClass: 'text-white',
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6" />,
      bgClass: 'bg-orange-500',
      textClass: 'text-white',
    },
    info: {
      icon: <Info className="w-6 h-6" />,
      bgClass: 'bg-blue-500',
      textClass: 'text-white',
    },
  };

  const toastConfig = config[type];

  return (
    <div
      className={`${toastConfig.bgClass} ${toastConfig.textClass} rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[300px] max-w-md transition-all duration-300 ${
        isExiting ? 'animate-out slide-out-to-right' : 'animate-in slide-in-from-right'
      }`}
    >
      <div className="flex-shrink-0">{toastConfig.icon}</div>
      <p className="flex-1 font-medium">{message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onClose, 300);
        }}
        className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// Toast Container
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3">
      {children}
    </div>
  );
}

