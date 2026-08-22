'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Diálogo modal accesible.
 *
 * Está construido sobre el `<dialog>` nativo y `showModal()`, que ya resuelve
 * de fábrica lo que la versión anterior no hacía: rol de diálogo, foco
 * atrapado dentro del modal, cierre con Esc, capa por encima de todo el
 * documento (top layer) y el resto de la página marcada como inerte para los
 * lectores de pantalla.
 *
 * El estado sigue viviendo en React: `open` manda, y los cierres iniciados por
 * el navegador (Esc, clic en el backdrop) se reenvían a `onClose` en vez de
 * cerrar el diálogo por su cuenta. Así no hay dos fuentes de verdad.
 */

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: Size;
  children: React.ReactNode;
  /** Descripción opcional bajo el título; se enlaza con aria-describedby. */
  description?: string;
  /** A false, Esc y el clic fuera no cierran (p. ej. mientras se guarda). */
  dismissable?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  size = 'lg',
  children,
  description,
  dismissable = true,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const pressStartedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // El navegador devuelve el foco al abridor cuando el diálogo se cierra, pero
  // no cuando el componente se desmonta con el modal todavía abierto (que es
  // como se cierran los modales de esta app). Hacerlo a mano cubre los dos.
  useEffect(() => {
    if (!open) return;
    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  const requestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Esc dispara `cancel`: se cancela el cierre nativo y se delega en React.
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      // Los clics sobre el ::backdrop llegan con el propio <dialog> como
      // target. Se comprueba también el mousedown para no cerrar cuando el
      // gesto empieza dentro (arrastrar texto y soltar fuera).
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) requestClose();
      }}
      // `m-auto` es obligatorio: el preflight de Tailwind pone `margin: 0` a
      // todos los elementos y se lleva por delante el centrado que el
      // navegador da a `dialog:modal`.
      className={`m-auto w-[calc(100%-2rem)] ${SIZES[size]} rounded-2xl border border-[var(--color-gray-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm`}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-gray-border)] px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="heading-section">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--color-text-soft)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="-mr-2 flex-shrink-0 rounded-lg p-2 text-[var(--color-gray-mid)] transition-colors hover:bg-[var(--color-gray-light)] hover:text-[var(--color-text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
