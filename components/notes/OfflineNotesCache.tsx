'use client';

import { useEffect } from 'react';
import { saveOfflineNotes } from '@/lib/offline';

interface Props {
  userId: string;
  notes: { id?: string; title?: string | null; content_text?: string | null; updated_at?: string | null }[];
}

/**
 * Guarda una copia de las notas para leerlas sin conexión.
 *
 * No pinta nada: se monta en la lista de notas, que ya recibe del servidor
 * todas las notas del usuario con su texto plano. Aprovechar esa carga es
 * gratis; pedir los mismos datos otra vez solo para archivarlos, no.
 *
 * Ver `lib/offline.ts` para el formato y la nota sobre privacidad.
 */
export function OfflineNotesCache({ userId, notes }: Props) {
  useEffect(() => {
    saveOfflineNotes(userId, notes);
  }, [userId, notes]);

  return null;
}
