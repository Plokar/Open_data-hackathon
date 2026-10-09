'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- načtení z localStorage až po hydrataci
      setThemeState(savedTheme);
    } else {
      setThemeState('light'); // hraje se venku na slunci
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let effective: 'dark' | 'light' = 'light';

    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      effective = theme;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizace s matchMedia
    setResolvedTheme(effective);

    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

  }, [theme]);

  // Ukládat jen při přepnutí uživatelem; zápis v efektu by při startu přepsal uložené téma výchozím
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
