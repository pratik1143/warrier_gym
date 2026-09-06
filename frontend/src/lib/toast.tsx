'use client';

import React from 'react';
import { toast as sonnerToast, Toaster as SonnerToaster, type ExternalToast } from 'sonner';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Loader2 
} from 'lucide-react';

/**
 * Global Premium Toast System — Warrior Gym OS
 * Features:
 * - Pixel-perfect layout with no clipped text or awkward overflows
 * - Clean status badges with dedicated icons
 * - Ultra-high z-index ensuring visibility over all modals and drawers
 * - Bottom-right positioning so top header and clock are never obscured
 */

export interface ToastOptions extends ExternalToast {
  description?: string;
  id?: string | number;
  duration?: number;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Clean technical error sanitizer so raw Firebase/API stack traces are never shown to end-users
export function sanitizeErrorMessage(err: any, fallback = 'Unable to complete request. Please try again.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') {
    if (err.includes('FirebaseError') || err.includes('PERMISSION_DENIED') || err.includes('network') || err.includes('undefined')) {
      return fallback;
    }
    return err;
  }
  const msg = err.response?.data?.error || err.response?.data?.message || err.message || '';
  if (msg.includes('FirebaseError') || msg.includes('PERMISSION_DENIED') || msg.includes('ETIMEDOUT') || msg.includes('status code')) {
    return fallback;
  }
  return msg || fallback;
}

// Base callable function
function baseToast(message: string | React.ReactNode, options?: ToastOptions) {
  if (typeof message === 'function') {
    return sonnerToast.custom(message as any, options);
  }
  return sonnerToast(message, {
    duration: options?.duration || 3500,
    ...options
  });
}

baseToast.success = (message: string | React.ReactNode, options?: ToastOptions) => {
  return sonnerToast.success(message, {
    duration: options?.duration || 3500,
    id: options?.id,
    description: options?.description,
    className: 'az-toast-card az-toast-success',
    icon: (
      <div className="az-toast-icon-badge az-badge-success">
        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
      </div>
    ),
    ...options
  });
};

baseToast.error = (message: string | React.ReactNode, options?: ToastOptions) => {
  const cleanMsg = typeof message === 'string' ? sanitizeErrorMessage(message) : message;
  return sonnerToast.error(cleanMsg, {
    duration: options?.duration || 4500,
    id: options?.id,
    description: options?.description || (typeof message === 'object' && (message as any)?.message ? sanitizeErrorMessage(message) : undefined),
    className: 'az-toast-card az-toast-error',
    icon: (
      <div className="az-toast-icon-badge az-badge-error">
        <AlertCircle className="w-4.5 h-4.5 text-rose-600" />
      </div>
    ),
    ...options
  });
};

baseToast.warning = (message: string | React.ReactNode, options?: ToastOptions) => {
  return sonnerToast.warning(message, {
    duration: options?.duration || 4000,
    id: options?.id,
    description: options?.description,
    className: 'az-toast-card az-toast-warning',
    icon: (
      <div className="az-toast-icon-badge az-badge-warning">
        <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
      </div>
    ),
    ...options
  });
};

baseToast.info = (message: string | React.ReactNode, options?: ToastOptions) => {
  return sonnerToast.info(message, {
    duration: options?.duration || 3500,
    id: options?.id,
    description: options?.description,
    className: 'az-toast-card az-toast-info',
    icon: (
      <div className="az-toast-icon-badge az-badge-info">
        <Info className="w-4.5 h-4.5 text-[#0b5cbe]" />
      </div>
    ),
    ...options
  });
};

baseToast.loading = (message: string | React.ReactNode, options?: ToastOptions) => {
  return sonnerToast.loading(message, {
    id: options?.id,
    description: options?.description,
    className: 'az-toast-card az-toast-loading',
    icon: (
      <div className="az-toast-icon-badge az-badge-info">
        <Loader2 className="w-4.5 h-4.5 animate-spin text-[#0b5cbe]" />
      </div>
    ),
    ...options
  });
};

baseToast.dismiss = (id?: string | number) => {
  sonnerToast.dismiss(id);
};

baseToast.promise = <T,>(
  promise: Promise<T>,
  data: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
    description?: string | ((data: T) => string);
  }
) => {
  return sonnerToast.promise(promise, {
    loading: data.loading,
    success: (res: T) => (typeof data.success === 'function' ? data.success(res) : data.success),
    error: (err: any) => (typeof data.error === 'function' ? data.error(err) : sanitizeErrorMessage(err, data.error)),
    description: data.description as any
  });
};

baseToast.custom = sonnerToast.custom;

export const toast = baseToast;
export default toast;

/**
 * Global Toaster Component for mounting at Root Layout
 */
export function GlobalToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      expand={true}
      richColors={false}
      closeButton={true}
      theme="light"
      gap={10}
      offset="24px"
      visibleToasts={5}
      style={{
        zIndex: 9999999
      }}
      toastOptions={{
        className: 'az-global-toast-container font-sans',
        style: {
          zIndex: 9999999
        }
      }}
    />
  );
}
