'use client';

import * as React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- po hydrataci (ikona závisí na localStorage)
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground ${className || ''}`}
      aria-label={resolvedTheme === 'dark' ? 'Přepnout na denní režim' : 'Přepnout na noční režim'}
      suppressHydrationWarning
    >
      {mounted && resolvedTheme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
