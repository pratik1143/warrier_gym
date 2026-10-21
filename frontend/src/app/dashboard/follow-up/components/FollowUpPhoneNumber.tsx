'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import toast from '@/lib/toast';

interface FollowUpPhoneNumberProps {
  phone: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Strips phone emojis, formatting labels, and non-digit characters (preserving leading + if present).
 * Example: "📞 9876543210" -> "9876543210"
 * "+91 98765 43210" -> "+919876543210"
 */
export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const hasPlus = rawPhone.includes('+');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export default function FollowUpPhoneNumber({
  phone,
  className = '',
  showIcon = true,
}: FollowUpPhoneNumberProps) {
  const [copied, setCopied] = useState(false);
  const lastTapRef = useRef<number>(0);
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCopyTimeRef = useRef<number>(0);

  const pureNumber = cleanPhoneNumber(phone);

  const performCopy = useCallback(
    async (e?: React.SyntheticEvent) => {
      if (e) {
        e.stopPropagation();
      }

      const now = Date.now();
      // Debounce to prevent duplicate copy triggers between touch and mouse events
      if (now - lastCopyTimeRef.current < 400) {
        return;
      }
      lastCopyTimeRef.current = now;

      if (!pureNumber) {
        toast.error('No phone number available to copy');
        return;
      }

      let success = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(pureNumber);
          success = true;
        }
      } catch (_) {
        // Fallback to execCommand below
      }

      if (!success && typeof document !== 'undefined') {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = pureNumber;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          success = document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
      }

      if (success) {
        setCopied(true);
        toast.success(`Copied ✓ ${pureNumber}`);

        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      }
    },
    [pureNumber]
  );

  // Desktop double-click
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    performCopy(e);
  };

  // Mobile double-tap tracking
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && now - lastTapRef.current > 0) {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      if (e.cancelable) {
        e.preventDefault();
      }
      performCopy(e);
    } else {
      lastTapRef.current = now;
      touchTimeoutRef.current = setTimeout(() => {
        lastTapRef.current = 0;
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Single click: does nothing except prevent propagation and default tel / link actions
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          performCopy(e);
        }
      }}
      title="Double-click or double-tap to copy"
      aria-label={`Phone number: ${pureNumber || phone}. Double-click or double-tap to copy`}
      className={`inline-flex items-center gap-1 cursor-pointer select-text transition-all ${
        copied
          ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-xs ring-1 ring-emerald-200 shadow-2xs'
          : 'text-slate-600 hover:text-orange-600 font-semibold'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check size={13} className="shrink-0 text-emerald-600" />
          <span className="font-bold">Copied ✓</span>
        </>
      ) : (
        <>
          {showIcon && (
            <span className="select-none shrink-0 text-slate-400 text-xs" aria-hidden="true">
              📞
            </span>
          )}
          <span className="tabular-nums">{phone}</span>
        </>
      )}
    </span>
  );
}
