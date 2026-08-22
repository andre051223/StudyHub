'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  FileText,
  Loader2,
  Search,
  Timer,
} from 'lucide-react';
import { searchAction } from '@/app/(app)/actions';
import type { SearchHit } from '@/lib/models';
import { Modal } from './Modal';

/**
 * Paleta de comandos (D4).
 *
 * Resuelve dos carencias a la vez: la aplicación no tenía ni un solo atajo de
 * teclado, y su única búsqueda —la de la lista de notas— filtraba en memoria
 * sobre las notas ya descargadas, así que ni encontraba tareas ni podía usar
 * el índice full-text que existía desde la primera migración.
 *
 * El término se busca en el servidor con `searchAction`, que delega en la
 * función `search_everything`. La navegación con flechas y Enter es
 * obligatoria en un componente como este: si hay que soltar el teclado para
 * usar el ratón, el atajo no ahorra nada.
 */

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Ir a Notas', href: '/notes', icon: FileText },
  { label: 'Ir a Tareas', href: '/tasks', icon: CheckSquare },
  { label: 'Ir a la Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Iniciar una sesión de estudio', href: '/timer', icon: Timer },
];

/** Milisegundos de calma antes de consultar: teclear no debe disparar una consulta por letra. */
const DEBOUNCE_MS = 180;

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // Ctrl+K / Cmd+K desde cualquier pantalla. Se escucha en captura para
  // ganarle al navegador (Firefox usa Ctrl+K para su barra de búsqueda).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // El diálogo es un componente aparte que solo existe mientras está abierto.
  // Así cada apertura parte de cero sin un efecto que limpie el estado: una
  // paleta que recuerda la búsqueda anterior obliga a borrarla antes de
  // escribir la siguiente.
  if (!open) return null;
  return <CommandPaletteDialog onClose={() => setOpen(false)} />;
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const showingActions = query.trim().length < 2;

  // Búsqueda con retardo. El id de la petición evita que una respuesta lenta
  // de un término viejo pise el resultado de uno más reciente.
  const requestId = useRef(0);
  useEffect(() => {
    const term = query.trim();
    // Por debajo de dos caracteres se muestran las acciones rápidas y no se
    // consulta nada; invalidar el id descarta cualquier respuesta en vuelo.
    if (term.length < 2) {
      requestId.current++;
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchAction({ q: term });
      if (id !== requestId.current) return;
      setHits(result.ok ? result.data : []);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const itemCount = showingActions ? QUICK_ACTIONS.length : hits.length;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function activate(index: number) {
    if (showingActions) {
      const action = QUICK_ACTIONS[index];
      if (action) go(action.href);
      return;
    }
    const hit = hits[index];
    if (!hit) return;
    // Las notas tienen pantalla propia; las tareas viven todas en la matriz.
    go(hit.kind === 'note' ? `/notes/${hit.id}` : '/tasks');
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (itemCount === 0 ? 0 : (i + 1) % itemCount));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (itemCount === 0 ? 0 : (i - 1 + itemCount) % itemCount));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(activeIndex);
    }
  }

  return (
    <Modal open onClose={onClose} title="Buscar" size="md">
      <div className="p-4">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-mid)]"
          />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar en notas y tareas..."
            aria-label="Buscar en notas y tareas"
            aria-controls="command-palette-results"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-[var(--color-gray-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          {loading && !showingActions && (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-gray-mid)]"
            />
          )}
        </div>

        <ul id="command-palette-results" className="mt-3 max-h-72 overflow-y-auto">
          {showingActions
            ? QUICK_ACTIONS.map((action, i) => (
                <li key={action.href}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => activate(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      i === activeIndex
                        ? 'bg-[var(--color-gray-light)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-soft)]'
                    }`}
                  >
                    <action.icon size={15} className="flex-shrink-0 text-[var(--color-gray-mid)]" />
                    <span className="flex-1 truncate">{action.label}</span>
                    <ArrowRight size={14} className="flex-shrink-0 text-[var(--color-gray-mid)]" />
                  </button>
                </li>
              ))
            : hits.map((hit, i) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => activate(i)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      i === activeIndex ? 'bg-[var(--color-gray-light)]' : ''
                    }`}
                  >
                    {hit.kind === 'note' ? (
                      <FileText size={15} className="mt-0.5 flex-shrink-0 text-[var(--color-gray-mid)]" />
                    ) : (
                      <CheckSquare size={15} className="mt-0.5 flex-shrink-0 text-[var(--color-gray-mid)]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--color-text)]">
                        {hit.title || 'Sin título'}
                      </span>
                      {hit.snippet && (
                        <span className="block truncate text-xs text-[var(--color-text-soft)]">
                          {hit.snippet}
                        </span>
                      )}
                    </span>
                    <span className="text-eyebrow flex-shrink-0">
                      {hit.kind === 'note' ? 'Nota' : 'Tarea'}
                    </span>
                  </button>
                </li>
              ))}

          {!showingActions && !loading && hits.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-[var(--color-text-soft)]">
              Sin resultados para «{query.trim()}».
            </li>
          )}
        </ul>

        <p className="text-meta mt-3 border-t border-[var(--color-gray-border)] pt-3">
          ↑↓ para moverte · Enter para abrir · Esc para cerrar
        </p>
      </div>
    </Modal>
  );
}
