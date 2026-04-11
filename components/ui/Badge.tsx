import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'success' | 'error' | 'warning' | 'outline';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white/[0.08] text-white',
      gold: 'bg-gold/20 text-gold border border-gold/30',
      success: 'bg-success/15 text-success-fg border border-success/30',
      error: 'bg-error/15 text-error-fg border border-error/30',
      warning: 'bg-warning/15 text-warning-fg border border-warning/30',
      outline: 'border border-white/[0.08] text-white/80',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
