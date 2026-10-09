import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading = false, children, disabled, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_2px_0_0_rgb(0_0_0/0.18)]',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
      outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizeClasses = {
      default: 'h-11 px-4 text-[15px]',
      sm: 'h-9 px-3 text-sm',
      lg: 'h-13 px-6 text-base',
      icon: 'h-11 w-11',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
