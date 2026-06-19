'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  Timer,
  LogOut,
  User,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { href: '/notes', label: 'Notas', icon: BookOpen },
  { href: '/tasks', label: 'Tareas', icon: CheckSquare },
  { href: '/timer', label: 'Temporizador', icon: Timer },
];

interface NavbarProps {
  userEmail?: string;
  userName?: string;
}

export function Navbar({ userEmail, userName }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Sesión cerrada');
    router.push('/login');
    router.refresh();
  }

  const initials = userName
    ? userName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : userEmail?.[0].toUpperCase() ?? 'U';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[68px] bg-[var(--color-surface)] border-b border-[var(--color-gray-border)] flex items-center px-6">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-8 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <BookOpen size={16} className="text-white" />
        </div>
        <span className="font-bold text-lg text-[var(--color-text)]">StudyHub</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#67b31f1a] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle (desktop) */}
      <div className="hidden md:flex items-center ml-auto mr-1">
        <ThemeToggle />
      </div>

      {/* User menu (desktop) */}
      <div className="hidden md:block relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
          aria-label="Menú de usuario"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <span className="text-sm text-[var(--color-text-soft)] max-w-32 truncate">
            {userName || userEmail}
          </span>
        </button>

        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setUserMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-card)] border border-[var(--color-gray-border)] z-20 py-1">
              <div className="px-4 py-3 border-b border-[var(--color-gray-border)]">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {userName || 'Usuario'}
                </p>
                <p className="text-xs text-[var(--color-gray-mid)] truncate">{userEmail}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] transition-colors"
              >
                <User size={15} />
                Perfil
              </Link>
              <Link
                href="/categories"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] transition-colors"
              >
                <Settings size={15} />
                Categorías
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile actions */}
      <div className="md:hidden ml-auto flex items-center gap-1">
        <ThemeToggle />
        <button
          className="p-2 rounded-lg hover:bg-[var(--color-gray-light)]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menú"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-[68px] left-0 right-0 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)] p-4 flex flex-col gap-1 md:hidden z-50">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-[#67b31f1a] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <div className="border-t border-[var(--color-gray-border)] mt-2 pt-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
