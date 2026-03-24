import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'success' | 'error' | 'warning' | 'outline';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-charcoal-border text-white',
      gold: 'bg-gold/20 text-gold border border-gold/30',
      success: 'bg-success/20 text-success border border-success/30',
      error: 'bg-error/20 text-error border border-error/30',
      warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      outline: 'border border-charcoal-border text-white/80',
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
