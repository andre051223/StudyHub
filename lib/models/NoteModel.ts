import { SupabaseClient } from '@supabase/supabase-js';
import type { Note } from '@/lib/types';
import { BaseModel } from './BaseModel';
import type { SearchHit } from './SearchModel';

export interface CreateNoteInput {
  title?: string;
  folder_id?: string | null;
  content?: Record<string, unknown>;
  content_text?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  folder_id?: string | null;
  content?: Record<string, unknown>;
  content_text?: string;
  tags?: string[];
}

export class NoteModel extends BaseModel {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async findAllByUser(userId: string): Promise<Partial<Note>[]> {
    const { data, error } = await this.supabase
      .from('notes')
      .select('id, user_id, folder_id, title, content_text, tags, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) this.handleError(error);
    return data ?? [];
  }

  async findById(id: string, userId: string): Promise<Note | null> {
    const { data, error } = await this.supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ?? null;
  }

  /**
   * Búsqueda de texto sobre las notas del usuario.
   *
   * La versión anterior filtraba con
   * `.or('title.ilike.%q%,content_text.ilike.%q%')`, lo que tenía tres
   * problemas a la vez:
   *
   * 1. Un `ILIKE '%…%'` no puede usar el índice GIN `notes_search_idx` que la
   *    migración 001 creó justo para esto, así que hacía barrido completo.
   * 2. Interpolaba el término dentro de la sintaxis de filtros de PostgREST
   *    sin escaparlo: una coma o un paréntesis en la búsqueda rompían el
   *    filtro o cambiaban su significado.
   * 3. No entiende de idioma: buscar «exámenes» no encontraba «examen».
   *
   * Ahora delega en la función `search_everything` (migración 007), que hace
   * full-text en español con prefijo y recibe el término como parámetro, no
   * como parte de la consulta. Se queda solo con las notas; la paleta de
   * comandos usa la misma función sin ese filtro (ver SearchModel).
   */
  async search(query: string, limit = 20): Promise<SearchHit[]> {
    const { data, error } = await this.supabase.rpc('search_everything', {
      q: query,
      max_results: limit,
    });
    if (error) this.handleError(error);
    return ((data ?? []) as SearchHit[]).filter((hit) => hit.kind === 'note');
  }

  async create(input: CreateNoteInput, userId: string): Promise<Note> {
    const { data, error } = await this.supabase
      .from('notes')
      .insert({
        title: input.title ?? 'Sin título',
        folder_id: input.folder_id ?? null,
        content: input.content ?? {},
        content_text: input.content_text ?? '',
        tags: input.tags ?? [],
        user_id: userId,
      })
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async update(id: string, input: UpdateNoteInput, userId: string): Promise<Note> {
    const note = await this.findById(id, userId);
    if (!note) throw new Error('Nota no encontrada.');

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.folder_id !== undefined) updates.folder_id = input.folder_id;
    if (input.content !== undefined) updates.content = input.content;
    if (input.content_text !== undefined) updates.content_text = input.content_text;
    if (input.tags !== undefined) updates.tags = input.tags;

    const { data, error } = await this.supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const note = await this.findById(id, userId);
    if (!note) throw new Error('Nota no encontrada.');
    const { error } = await this.supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) this.handleError(error);
  }
}
