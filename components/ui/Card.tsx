import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-charcoal-surface border border-charcoal-border',
      elevated: 'bg-charcoal-surface shadow-xl border border-charcoal-border/50',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl p-4',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export { Card };
