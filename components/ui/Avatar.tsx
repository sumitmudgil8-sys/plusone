import { cn } from '@/lib/utils';
import { ImgHTMLAttributes, forwardRef } from 'react';

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
}

const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, size = 'md', fallback, src, alt, ...props }, ref) => {
    const sizes = {
      xs: 'w-6 h-6',
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
      xl: 'w-24 h-24',
    };

    const [failed, setFailed] = useState(false);

    if (!src || failed) {
      const initials = fallback
        ?.split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

      return (
        <div
          className={cn(
            'rounded-full bg-charcoal-border flex items-center justify-center',
            'text-white font-medium text-sm',
            sizes[size],
            className
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt || 'Avatar'}
        className={cn(
          'rounded-full object-cover',
          sizes[size],
          className
        )}
        onError={() => setFailed(true)}
        {...props}
      />
    );
  }
);

Avatar.displayName = 'Avatar';

import { useState } from 'react';
export { Avatar };
