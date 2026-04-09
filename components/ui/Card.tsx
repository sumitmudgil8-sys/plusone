import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-charcoal-surface border border-white/[0.06] shadow-card',
      elevated: 'bg-charcoal-elevated border border-white/[0.08] shadow-card-hover',
      glass: 'glass border border-white/[0.06]',
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
