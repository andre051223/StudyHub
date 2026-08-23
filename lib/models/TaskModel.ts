import { SupabaseClient } from '@supabase/supabase-js';
import type { Task, TaskQuadrant, Subtask } from '@/lib/types';
import { BaseModel } from './BaseModel';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  quadrant: TaskQuadrant;
  deadline?: string | null;
  category_id?: string | null;
  /** Estimación opcional en minutos (migración 009). */
  estimated_minutes?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  quadrant?: TaskQuadrant;
  deadline?: string | null;
  category_id?: string | null;
  estimated_minutes?: number | null;
  completed?: boolean;
  position?: number;
}

export class TaskModel extends BaseModel {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async findAllByUser(userId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, subtasks(*), category:categories(*)')
      .eq('user_id', userId)
      .order('position');
    if (error) this.handleError(error);
    return data ?? [];
  }

  async findById(id: string, userId: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, subtasks(*), category:categories(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ?? null;
  }

  async create(input: CreateTaskInput, userId: string): Promise<Task> {
    const title = input.title.trim();
    if (!title) throw new Error('El título de la tarea es obligatorio.');

    const { count } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('quadrant', input.quadrant);

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        title,
        description: input.description ?? null,
        quadrant: input.quadrant,
        deadline: input.deadline ?? null,
        category_id: input.category_id ?? null,
        estimated_minutes: input.estimated_minutes ?? null,
        position: count ?? 0,
        user_id: userId,
      })
      .select('*, subtasks(*), category:categories(*)')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async update(id: string, input: UpdateTaskInput, userId: string): Promise<Task> {
    const task = await this.findById(id, userId);
    if (!task) throw new Error('Tarea no encontrada.');

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t) throw new Error('El título no puede estar vacío.');
      updates.title = t;
    }
    if (input.description !== undefined) updates.description = input.description;
    if (input.quadrant !== undefined) updates.quadrant = input.quadrant;
    if (input.deadline !== undefined) updates.deadline = input.deadline;
    if (input.category_id !== undefined) updates.category_id = input.category_id;
    if (input.estimated_minutes !== undefined) updates.estimated_minutes = input.estimated_minutes;
    if (input.position !== undefined) updates.position = input.position;
    if (input.completed !== undefined) {
      updates.completed = input.completed;
      updates.completed_at = input.completed ? new Date().toISOString() : null;
    }

    const { data, error } = await this.supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, subtasks(*), category:categories(*)')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const task = await this.findById(id, userId);
    if (!task) throw new Error('Tarea no encontrada.');
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) this.handleError(error);
  }

  async addSubtask(taskId: string, title: string, userId: string): Promise<Subtask> {
    const task = await this.findById(taskId, userId);
    if (!task) throw new Error('Tarea no encontrada.');

    const { count } = await this.supabase
      .from('subtasks')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    const { data, error } = await this.supabase
      .from('subtasks')
      .insert({ task_id: taskId, title: title.trim(), position: count ?? 0 })
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async updateSubtask(subtaskId: string, completed: boolean, userId: string): Promise<Subtask> {
    const { data: subtask } = await this.supabase
      .from('subtasks')
      .select('task_id')
      .eq('id', subtaskId)
      .single();
    if (!subtask) throw new Error('Subtarea no encontrada.');

    const task = await this.findById(subtask.task_id, userId);
    if (!task) throw new Error('Sin permiso.');

    const { data, error } = await this.supabase
      .from('subtasks')
      .update({ completed })
      .eq('id', subtaskId)
      .select()
      .single();
    if (error) this.handleError(error);
    return data;
  }

  /**
   * Fija el orden completo de un cuadrante.
   *
   * `position` solo se escribía al crear la tarea, así que el orden dentro de
   * la columna era el de inserción y arrastrar no lo cambiaba nunca. Al mover
   * una tarea entre cuadrantes tampoco se recalculaba: llegaba con la posición
   * que tenía en la columna anterior y quedaba intercalada en un sitio
   * arbitrario.
   *
   * Recibe el cuadrante de destino y el orden final completo de esa columna
   * —la tarea movida incluida— y reescribe las posiciones como 0..n-1. Pasar
   * la lista entera en lugar de un delta hace la operación idempotente:
   * repetirla o reintentarla deja exactamente el mismo estado.
   */
  async reorder(
    quadrant: TaskQuadrant,
    orderedIds: string[],
    userId: string
  ): Promise<void> {
    if (orderedIds.length === 0) return;

    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error('El orden recibido contiene tareas repetidas.');
    }

    // Pertenencia antes de escribir nada: si alguna de las tareas no es del
    // usuario, no se toca ninguna.
    const { data: owned, error: ownershipError } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .in('id', orderedIds);
    if (ownershipError) this.handleError(ownershipError);
    if ((owned?.length ?? 0) !== orderedIds.length) {
      throw new Error('Alguna de las tareas ya no existe.');
    }

    // PostgREST no expone un `UPDATE ... FROM (VALUES ...)`, así que va una
    // consulta por fila. Son las de un solo cuadrante, y el cliente ya pintó
    // el resultado de forma optimista, así que la latencia no se percibe.
    const results = await Promise.all(
      orderedIds.map((id, position) =>
        this.supabase
          .from('tasks')
          .update({ quadrant, position })
          .eq('id', id)
          .eq('user_id', userId)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) this.handleError(failed.error);
  }
}
