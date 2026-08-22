'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

/**
 * Un único patrón de confirmación destructiva.
 *
 * Antes la misma pregunta se hacía de tres formas distintas según la pantalla:
 * `confirm()` nativo en la lista de notas y en categorías (rompe el modo
 * oscuro y bloquea el hilo), confirmación en línea de dos pasos en el modal de
 * tareas y en el editor de notas, y un modal propio en el formulario de
 * categorías. Ahora hay una sola.
 *
 * La API imita a la del `confirm()` nativo —devuelve una promesa de booleano—
 * para que el sitio de llamada quede igual de directo:
 *
 * ```ts
 * if (!(await confirm({ title: '¿Eliminar la nota?' }))) return;
 * ```
 */

export interface ConfirmOptions {
  title: string;
  /** Consecuencia concreta de la acción, no una repetición del título. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>.');
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        // Si ya hubiera un diálogo abierto, la promesa anterior se resuelve
        // como cancelada en vez de quedarse colgada para siempre.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const danger = options?.tone !== 'neutral';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal open onClose={() => settle(false)} title={options.title} size="sm">
          <div className="px-6 py-5">
            <div className="flex gap-3">
              {danger && (
                <span
                  aria-hidden
                  className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                >
                  <AlertTriangle size={16} />
                </span>
              )}
              <p className="text-sm leading-relaxed text-[var(--color-text-soft)]">
                {options.message ?? 'Esta acción no se puede deshacer.'}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => settle(false)}
                className="rounded-lg border border-[var(--color-gray-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-gray-light)]"
              >
                {options.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
                }`}
              >
                {options.confirmLabel ?? 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

