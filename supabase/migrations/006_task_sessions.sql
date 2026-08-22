-- ============================================================
-- StudyHub - Sesiones de estudio ligadas a tareas  (D1)
-- Ejecutar en el SQL Editor de Supabase después de 005_data_integrity.sql
--
-- Hasta ahora lo único que unía notas, tareas y temporizador era
-- `categories`. Se podía estudiar «Cálculo», pero no «estudiar para el parcial
-- de Cálculo»: la tarea y el tiempo dedicado a ella vivían en dos mundos
-- separados, y la app eran tres herramientas compartiendo una barra de
-- navegación.
--
-- Una columna resuelve las dos direcciones a la vez:
--   · desde el temporizador, elegir sobre qué tarea se estudia;
--   · desde la tarea, ver cuánto tiempo se le ha dedicado.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- study_sessions.task_id
--
-- ON DELETE SET NULL, igual que category_id: borrar una tarea no debe borrar
-- el historial de estudio. La sesión ocurrió; pierde su etiqueta, no su valor
-- estadístico.
-- ────────────────────────────────────────────────────────────
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- El agregado «cuánto he estudiado esta tarea» filtra por task_id sobre
-- sesiones completadas; el índice parcial evita recorrer las abandonadas y las
-- que no tienen tarea (que son la mayoría del historial antiguo).
CREATE INDEX IF NOT EXISTS sessions_task_idx
  ON study_sessions (task_id)
  WHERE task_id IS NOT NULL AND completed_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- Coherencia entre la tarea y su sesión
--
-- RLS ya impide leer o escribir filas de otro usuario, pero no impide que un
-- usuario ligue su propia sesión a... su propia tarea y nada más. Esto último
-- lo garantiza la política: la sesión solo es válida si la tarea referenciada
-- es del mismo usuario. Sin esto, un cliente manipulado podría insertar una
-- sesión apuntando al id de la tarea de otra persona (no la leería, pero
-- contaminaría su agregado si algún día se consulta al revés).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_insert_own" ON study_sessions;
CREATE POLICY "sessions_insert_own" ON study_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = study_sessions.task_id
          AND tasks.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "sessions_update_own" ON study_sessions;
CREATE POLICY "sessions_update_own" ON study_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = study_sessions.task_id
          AND tasks.user_id = auth.uid()
      )
    )
  );
