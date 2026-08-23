import { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/lib/types';
import { BaseModel } from './BaseModel';

export interface CreateCategoryInput {
  name: string;
  color: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
}

/**
 * Formato y longitud ya no se comprueban aquí: los dos caminos de escritura
 * —las Server Actions y los route handlers— validan la entrada contra
 * `createCategorySchema`/`updateCategorySchema` antes de llamar al modelo, y
 * la migración 002 declara los CHECK equivalentes en la propia tabla. Este
 * modelo solo se ocupa de las reglas que necesitan consultar la base: la
 * unicidad del nombre y la existencia de la fila.
 */
export class CategoryModel extends BaseModel {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async findAllByUser(userId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (error) this.handleError(error);
    return data ?? [];
  }

  async findById(id: string, userId: string): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ?? null;
  }

  async findByName(name: string, userId: string): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('name', name.trim())
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ?? null;
  }

  async create(input: CreateCategoryInput, userId: string): Promise<Category> {
    const name = input.name.trim();
    const { color } = input;

    const existing = await this.findByName(name, userId);
    if (existing) {
      throw new Error(`Ya existe una categoría con el nombre "${name}".`);
    }

    const { data, error } = await this.supabase
      .from('categories')
      .insert({ name, color, user_id: userId })
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async update(id: string, input: UpdateCategoryInput, userId: string): Promise<Category> {
    const current = await this.findById(id, userId);
    if (!current) throw new Error('Categoría no encontrada.');

    const updates: Partial<CreateCategoryInput> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name !== current.name) {
        const duplicate = await this.findByName(name, userId);
        if (duplicate) throw new Error(`Ya existe una categoría con el nombre "${name}".`);
      }
      updates.name = name;
    }

    if (input.color !== undefined) {
      updates.color = input.color;
    }

    const { data, error } = await this.supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  /**
   * Borra la categoría. Las tareas y las sesiones asociadas se quedan sin
   * categoría, pero no se borran.
   *
   * Antes eso se hacía a mano con dos UPDATE previos, lo cual era a la vez
   * redundante y frágil: `tasks.category_id` y `study_sessions.category_id`
   * están declaradas `ON DELETE SET NULL` (001_initial.sql:137 y :187), así
   * que Postgres las limpia en la misma transacción que el DELETE. Los UPDATE
   * manuales, además, no comprobaban su propio `error` y podían dejar las
   * tareas desasociadas de una categoría que seguía existiendo si el borrado
   * fallaba después.
   *
   * El `count` sustituye al `findById` previo: si no se borró ninguna fila, o
   * el id no existe o es de otro usuario —indistinguibles a propósito, para no
   * revelar la existencia de categorías ajenas.
   */
  async delete(id: string, userId: string): Promise<void> {
    const { error, count } = await this.supabase
      .from('categories')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) this.handleError(error);
    if (!count) throw new Error('Categoría no encontrada.');
  }
}
