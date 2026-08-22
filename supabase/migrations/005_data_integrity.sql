-- ============================================================
-- StudyHub - Integridad de datos
-- Ejecutar en el SQL Editor de Supabase después de 004_stopwatch_mode.sql
--
-- Cubre tres problemas detectados en la auditoría:
--   A3  Las inserciones desde el cliente no envían user_id, pero la columna
--       es NOT NULL sin DEFAULT.
--   A3b Las políticas RLS "FOR ALL USING (...)" no declaran WITH CHECK.
--   B7  El CHECK de duration_minutes (1..120) hace imposible guardar una
--       sesión de cronómetro larga, pese a que la UI la anuncia "sin límite".
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- A3 · user_id por defecto = usuario autenticado
--
-- El cliente hace `insert({ title, ... })` sin user_id (TasksClient.tsx:145,
-- NotesClient.tsx:66 y :82). Con la columna NOT NULL y sin DEFAULT, esa
-- inserción solo puede funcionar si la base ya tenía un default aplicado a
-- mano fuera de las migraciones. Declararlo aquí lo hace reproducible: un
-- despliegue limpio queda igual que producción.
--
-- auth.uid() es el usuario del JWT del request. En una conexión sin JWT
-- (service role, psql) devuelve NULL y la restricción NOT NULL sigue
-- protegiendo la tabla, que es justo lo que queremos.
-- ────────────────────────────────────────────────────────────
ALTER TABLE categories     ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE folders        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE notes          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tasks          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE study_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();


-- ────────────────────────────────────────────────────────────
-- A3b · Políticas RLS granulares con WITH CHECK explícito
--
-- "FOR ALL USING (auth.uid() = user_id)" funciona para INSERT porque Postgres
-- reutiliza la expresión de USING como WITH CHECK cuando esta se omite. Es un
-- comportamiento correcto pero implícito, y deja la política de escritura sin
-- declarar. La migración 002 ya separó las políticas de `categories`; aquí se
-- aplica el mismo criterio al resto de tablas.
-- ────────────────────────────────────────────────────────────

-- folders
DROP POLICY IF EXISTS "folders_all_own" ON folders;
CREATE POLICY "folders_select_own" ON folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "folders_insert_own" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folders_update_own" ON folders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folders_delete_own" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- notes
DROP POLICY IF EXISTS "notes_all_own" ON notes;
CREATE POLICY "notes_select_own" ON notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "tasks_all_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- study_sessions
DROP POLICY IF EXISTS "sessions_all_own" ON study_sessions;
CREATE POLICY "sessions_select_own" ON study_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_insert_own" ON study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update_own" ON study_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_delete_own" ON study_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- subtasks: la pertenencia se deriva de la tarea padre, así que la expresión
-- es la misma en ambos lados pero conviene declararla también en WITH CHECK
-- para que no se pueda crear una subtarea colgando de la tarea de otro.
DROP POLICY IF EXISTS "subtasks_all_own" ON subtasks;
CREATE POLICY "subtasks_select_own" ON subtasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  );
CREATE POLICY "subtasks_insert_own" ON subtasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  );
CREATE POLICY "subtasks_update_own" ON subtasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  );
CREATE POLICY "subtasks_delete_own" ON subtasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- B7 · El cronómetro no cabe en el rango 1..120
--
-- El modo cronómetro cuenta hacia arriba sin meta, y la propia interfaz lo
-- anuncia como "sin límite". Al guardar, TimerClient escribe
-- Math.round(segundos / 60) en duration_minutes, así que:
--
--   · más de 2 h  → viola el CHECK → la sesión se pierde con un toast de error
--   · menos de 30 s → Math.round da 0 → también viola el CHECK
--
-- duration_minutes es la duración *planeada*, que en el cronómetro no existe:
-- lo correcto es permitir NULL para ese modo. Se amplía además el techo a 24 h
-- para las sesiones largas de estudio continuado.
-- ────────────────────────────────────────────────────────────
ALTER TABLE study_sessions
  ALTER COLUMN duration_minutes DROP NOT NULL;

ALTER TABLE study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_duration_minutes_check;

ALTER TABLE study_sessions
  ADD CONSTRAINT study_sessions_duration_minutes_check
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440);

-- El tiempo realmente transcurrido nunca puede ser negativo.
ALTER TABLE study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_actual_duration_check;

ALTER TABLE study_sessions
  ADD CONSTRAINT study_sessions_actual_duration_check
  CHECK (actual_duration_seconds >= 0);


-- ────────────────────────────────────────────────────────────
-- Índice de apoyo para las estadísticas
--
-- Todas las consultas de estadísticas filtran por usuario y sesión completada,
-- ordenando por started_at. El índice parcial evita recorrer las abandonadas.
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS sessions_completed_idx
  ON study_sessions (user_id, started_at DESC)
  WHERE completed_at IS NOT NULL;
