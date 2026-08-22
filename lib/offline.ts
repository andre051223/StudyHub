/**
 * Copia local de las notas para leerlas sin conexión  (C10).
 *
 * La PWA era instalable pero inservible offline: había manifest, service
 * worker y página de respaldo, pero lo único que se guardaba era esa página.
 * Para una aplicación de estudio, poder leer los apuntes en el metro es la
 * razón principal de instalarla.
 *
 * El HTML de las pantallas autenticadas **no** se cachea a propósito (ver
 * public/sw.js): depende de la sesión y servirlo de caché podría enseñarle a
 * alguien los datos de otro. La copia se guarda entonces del lado del cliente,
 * como datos, y la lee `public/offline.html`, que es HTML estático.
 *
 * Sobre la privacidad: esto deja texto de apuntes en el almacenamiento del
 * navegador. Por eso la copia se marca con el id del usuario —la de otra
 * cuenta se ignora y se borra— y `clearOfflineNotes()` se llama al cerrar
 * sesión.
 */

const STORAGE_KEY = 'studyhub_offline_notes';

/** Tope de notas guardadas. Las más recientes son las que se van a consultar. */
const MAX_NOTES = 50;

/** Tope de caracteres por nota: un apunte largo no debe agotar la cuota. */
const MAX_CHARS = 8000;

export interface OfflineNote {
  id: string;
  title: string;
  text: string;
  updated_at: string;
}

interface OfflineSnapshot {
  userId: string;
  savedAt: string;
  notes: OfflineNote[];
}

interface NoteLike {
  id?: string;
  title?: string | null;
  content_text?: string | null;
  updated_at?: string | null;
}

/**
 * Guarda (o reemplaza) la copia offline del usuario.
 *
 * Nunca lanza: es una mejora, y una cuota llena o un navegador en modo
 * privado no deben romper la pantalla de notas.
 */
export function saveOfflineNotes(userId: string, notes: NoteLike[]): void {
  try {
    const snapshot: OfflineSnapshot = {
      userId,
      savedAt: new Date().toISOString(),
      notes: notes
        .slice(0, MAX_NOTES)
        .filter((n): n is NoteLike & { id: string } => typeof n.id === 'string')
        .map((n) => ({
          id: n.id,
          title: n.title || 'Sin título',
          text: (n.content_text ?? '').slice(0, MAX_CHARS),
          updated_at: n.updated_at ?? '',
        })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: se sigue sin copia offline.
  }
}

/** Copia guardada, si es de este usuario. La de otra cuenta se descarta. */
export function readOfflineNotes(userId: string): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as OfflineSnapshot;
    if (snapshot.userId !== userId) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Se llama al cerrar sesión: los apuntes no se quedan en un equipo compartido. */
export function clearOfflineNotes(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que hacer: si no se puede escribir, tampoco se pudo guardar.
  }
}
