"use client";
import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      size = 'md',
      showCloseButton = true,
      children,
      className,
    },
    ref
  ) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleCloseRef = useRef<() => void>(() => {});
    const modalContentRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Lock body scroll while modal is open — prevents background scrolling
    // on iOS and desktop when the modal content is taller than the viewport.
    useEffect(() => {
      if (!isOpen) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }, [isOpen]);

    // Focus trap: capture previous focus, auto-focus first element, restore on close
    useEffect(() => {
      if (!isOpen) return;
      previousFocusRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const el = modalContentRef.current;
        if (!el) return;
        const first = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        previousFocusRef.current?.focus();
      };
    }, [isOpen]);

    // Trap Tab within modal + close on Escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = modalContentRef.current;
      if (!el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, []);

    useEffect(() => {
      if (!isOpen) return;
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const handleClose = () => {
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 200);
    };
    handleCloseRef.current = handleClose;

    const sizes = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    };

    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          'transition-opacity duration-200',
          isClosing ? 'opacity-0' : 'opacity-100'
        )}
        onClick={handleClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <div
          ref={(node) => {
            modalContentRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            'relative w-full bg-charcoal-surface rounded-2xl shadow-2xl',
            'border border-white/[0.06]',
            'transform transition-all duration-200',
            'max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden',
            isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
            sizes[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06] shrink-0">
              {title && (
                <h3 className="text-xl font-semibold text-white">{title}</h3>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="!p-1"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              )}
            </div>
          )}

          {/* Content — scrollable when taller than viewport */}
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

export { Modal };
