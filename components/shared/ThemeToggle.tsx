'use client';

import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'studyhub_theme';

function getInitialTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme as Theme;
  }
  return 'light';
}

export function ThemeToggle() {
  // El script anti-FOUC en layout.tsx ya fijó data-theme en <html> antes del
  // primer render. Inicializador lazy: en cliente lee ese valor; en SSR no se
  // conoce el tema, por eso suprimimos el aviso de hidratación del icono.
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      suppressHydrationWarning
      className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] hover:text-[var(--color-text)] transition-colors"
    >
      <span suppressHydrationWarning>{isDark ? <Sun size={18} /> : <Moon size={18} />}</span>
    </button>
  );
}
