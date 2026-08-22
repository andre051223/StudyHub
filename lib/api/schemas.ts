/**
 * Esquemas de validación de entrada, compartidos por los dos caminos de
 * escritura del proyecto: los route handlers de `app/api/**` y las Server
 * Actions de `app/(app)/**\/actions.ts`.
 *
 * Viven en un solo sitio a propósito. Antes los handlers no validaban nada
 * —hacían `model.create(await req.json())` con el body sin filtrar— mientras
 * los formularios sí tenían su propio esquema Zod, así que cliente y servidor
 * aceptaban cosas distintas. Con un único módulo, endurecer una regla la
 * endurece en ambos caminos a la vez.
 */
import { z } from 'zod';

/** Acepta `YYYY-MM-DD` (input date) y timestamps ISO completos. */
const dateLike = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida.');

export const uuid = z.uuid('Identificador inválido.');

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser un valor hexadecimal válido (#RRGGBB).');

// ─────────────────────────────────────────────────────────────
// Categorías
// ─────────────────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(40, 'El nombre no puede superar los 40 caracteres.'),
  color: hexColor,
});

export const updateCategorySchema = createCategorySchema.partial();

// ─────────────────────────────────────────────────────────────
// Carpetas
// ─────────────────────────────────────────────────────────────
export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre de la carpeta es obligatorio.')
    .max(60, 'El nombre no puede superar los 60 caracteres.'),
  color: hexColor.nullish(),
});

export const updateFolderSchema = createFolderSchema.partial();

// ─────────────────────────────────────────────────────────────
// Notas
// ─────────────────────────────────────────────────────────────
export const taskQuadrantSchema = z.enum([
  'urgent_important',
  'not_urgent_important',
  'urgent_not_important',
  'not_urgent_not_important',
]);

export const createNoteSchema = z.object({
  title: z.string().max(200, 'El título no puede superar los 200 caracteres.').optional(),
  folder_id: uuid.nullish(),
  // El documento de Tiptap es un JSON arbitrario; se valida su forma en el
  // editor, no aquí.
  content: z.record(z.string(), z.unknown()).optional(),
  content_text: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20, 'Máximo 20 etiquetas.').optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

// ─────────────────────────────────────────────────────────────
// Tareas
// ─────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título de la tarea es obligatorio.')
    .max(200, 'El título no puede superar los 200 caracteres.'),
  description: z.string().max(2000).nullish(),
  quadrant: taskQuadrantSchema,
  deadline: dateLike.nullish(),
  category_id: uuid.nullish(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  completed: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

/**
 * Orden completo de un cuadrante. Se envía la lista entera y no un delta:
 * ver `TaskModel.reorder()`.
 */
export const reorderTasksSchema = z.object({
  quadrant: taskQuadrantSchema,
  orderedIds: z
    .array(uuid)
    .min(1, 'No hay tareas que reordenar.')
    .max(500, 'Demasiadas tareas en un solo cuadrante.'),
});

export const createSubtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título de la subtarea es obligatorio.')
    .max(200, 'El título no puede superar los 200 caracteres.'),
});

// ─────────────────────────────────────────────────────────────
// Sesiones de estudio
// ─────────────────────────────────────────────────────────────
export const studyModeSchema = z.enum(['simple', 'stopwatch', 'pomodoro']);

export const createSessionSchema = z.object({
  category_id: uuid.nullish(),
  // Tarea sobre la que se estudió (migración 006). Su pertenencia la comprueba
  // la política RLS de study_sessions, no este esquema.
  task_id: uuid.nullish(),
  // Duración *planeada*. Null en cronómetro, donde no existe. El rango
  // 10–120 solo aplica al temporizador y lo comprueba SessionModel, que es
  // quien conoce el modo.
  duration_minutes: z.number().int().min(1).max(1440).nullable(),
  actual_duration_seconds: z.number().int().min(0),
  mode: studyModeSchema,
  pomodoro_cycles_completed: z.number().int().min(0).optional(),
  started_at: dateLike,
  completed_at: dateLike.nullish(),
  notes: z.string().max(2000).nullish(),
});

// ─────────────────────────────────────────────────────────────
// Metas de estudio (columnas de `profiles`)
// ─────────────────────────────────────────────────────────────
export const updateGoalsSchema = z.object({
  // Los rangos replican los CHECK de la migración 003.
  daily_goal_minutes: z
    .number()
    .int()
    .min(5, 'La meta diaria debe ser de al menos 5 minutos.')
    .max(480, 'La meta diaria no puede superar los 480 minutos.'),
  weekly_goal_minutes: z
    .number()
    .int()
    .min(30, 'La meta semanal debe ser de al menos 30 minutos.')
    .max(2400, 'La meta semanal no puede superar los 2400 minutos.'),
});

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(80, 'El nombre no puede superar los 80 caracteres.'),
});

// ─────────────────────────────────────────────────────────────
// Búsqueda global
// ─────────────────────────────────────────────────────────────
export const searchSchema = z.object({
  // El término va como parámetro de la función SQL, nunca concatenado en la
  // consulta (ver 007_global_search.sql). El tope de longitud es solo para no
  // enviar un texto absurdo al servidor.
  q: z.string().trim().max(120, 'La búsqueda es demasiado larga.'),
  limit: z.number().int().min(1).max(50).optional(),
});
