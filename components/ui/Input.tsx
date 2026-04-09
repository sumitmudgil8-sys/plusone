import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/60 mb-2">
            {label}
            {props.required && <span className="text-gold ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-xl',
            'px-4 py-3 text-sm placeholder:text-white/25',
            'shadow-inner-light',
            'focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/20 focus:bg-white/[0.06]',
            'transition-all duration-200',
            error && 'border-red-500/40 focus:ring-red-500/30',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
