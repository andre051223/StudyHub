'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Invitación a instalar la PWA  (C10).
 *
 * El manifest y el service worker ya hacían la aplicación instalable, pero
 * nada lo decía: el único camino era el menú del navegador. Chrome y Edge
 * disparan `beforeinstallprompt` cuando la app cumple los criterios; guardar
 * ese evento permite ofrecer la instalación en el momento oportuno y desde la
 * interfaz.
 *
 * Safari no emite el evento —allí la instalación es «Compartir → Añadir a
 * pantalla de inicio»— así que este banner simplemente no aparece, que es el
 * comportamiento correcto: no se anuncia un botón que no funcionaría.
 */

const DISMISSED_KEY = 'studyhub_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // Sin preventDefault, Chrome muestra su propia barra y el evento se
      // pierde: no habría forma de lanzarlo desde nuestro botón.
      e.preventDefault();

      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
      } catch {
        // Almacenamiento bloqueado: se ofrece igualmente.
      }
      if (!dismissed) setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    // Si el usuario acaba instalando (por el banner o por el menú del
    // navegador), el aviso sobra.
    window.addEventListener('appinstalled', () => setDeferred(null));

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Si no se puede recordar, volverá a aparecer. Es preferible a fallar.
    }
    setDeferred(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    // El evento solo se puede usar una vez, lo acepte o no.
    setDeferred(null);
  }

  if (!deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-[var(--color-gray-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] md:left-auto md:right-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#67b31f1a] text-[var(--color-primary)]"
        >
          <Download size={17} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text)]">Instala StudyHub</p>
          <p className="text-meta mt-0.5">
            Se abre como una aplicación y tus apuntes quedan disponibles sin
            conexión.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              Instalar
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-soft)] transition-colors hover:bg-[var(--color-gray-light)]"
            >
              Ahora no
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="-mr-1 -mt-1 flex-shrink-0 rounded-lg p-1.5 text-[var(--color-gray-mid)] transition-colors hover:bg-[var(--color-gray-light)]"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
