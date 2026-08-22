import { SupabaseClient } from '@supabase/supabase-js';
import type { TaskQuadrant } from '@/lib/types';
import { BaseModel } from './BaseModel';

/** Una coincidencia de la búsqueda global, sea nota o tarea. */
export interface SearchHit {
  kind: 'note' | 'task';
  id: string;
  title: string;
  /** Primeros 160 caracteres del cuerpo, para dar contexto en la lista. */
  snippet: string;
  /** Cuadrante, en las tareas. Null en las notas. */
  extra: TaskQuadrant | null;
  updated_at: string;
  rank: number;
}

/**
 * Búsqueda global sobre notas y tareas.
 *
 * Todo el trabajo lo hace `search_everything` (migración 007): full-text en
 * español, con prefijo para que la lista se afine mientras se teclea, sobre
 * los dos índices GIN.
 *
 * No recibe `userId` a propósito, y no es un descuido: la función SQL es
 * SECURITY INVOKER, así que corre con los permisos del usuario del request y
 * las políticas RLS de `notes` y `tasks` la acotan. Añadir aquí un filtro por
 * usuario daría la falsa impresión de que es *este* código el que protege los
 * datos de los demás.
 */
export class SearchModel extends BaseModel {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async search(query: string, limit = 15): Promise<SearchHit[]> {
    const term = query.trim();
    // Con menos de dos caracteres el prefijo casa con media base de datos y el
    // resultado no informa de nada.
    if (term.length < 2) return [];

    const { data, error } = await this.supabase.rpc('search_everything', {
      q: term,
      max_results: limit,
    });
    if (error) this.handleError(error);
    return (data ?? []) as SearchHit[];
  }
}
