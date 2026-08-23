-- ============================================================
-- StudyHub - Tiempo de estudio: estimación, calidad y Pomodoro
-- Ejecutar en el SQL Editor de Supabase después de 008_onboarding.sql
--
-- Hasta aquí el temporizador solo respondía «cuánto». Esta migración añade
-- las tres columnas que faltaban para responder «cuánto de lo previsto»,
-- «cómo fue» y «con qué ritmo»:
--
--   · tasks.estimated_minutes   → planeado vs. real por tarea
--   · study_sessions.focus_rating → calidad percibida de la sesión
--   · profiles.pomodoro_*        → ciclos configurables por usuario
--
-- Y un valor nuevo de `study_mode` para el registro manual: hasta ahora una
-- sesión estudiada sin la app solo se podía dar de alta mintiendo sobre el
-- modo ('simple'), lo que hacía imposible distinguir en el historial lo
-- cronometrado de lo recordado.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- study_mode += 'manual'
--
-- ADD VALUE IF NOT EXISTS, igual que en 004: la migración es idempotente.
-- El valor nuevo no se usa en ninguna sentencia de este archivo, que es la
-- única condición que impone Postgres para poder añadirlo dentro de una
-- transacción.
-- ────────────────────────────────────────────────────────────
ALTER TYPE study_mode ADD VALUE IF NOT EXISTS 'manual';


-- ────────────────────────────────────────────────────────────
-- tasks.estimated_minutes
--
-- La app ya sabe cuánto se ha estudiado cada tarea (migración 006), pero no
-- contra qué comparar ese número. Sin la estimación, el tiempo dedicado es un
-- dato sin veredicto: no distingue «me cundió» de «se me fue el doble».
--
-- Nullable a propósito: obligar a estimar cada tarea convertiría en fricción
-- lo que debe ser opcional. El tope de 6000 min (100 h) es holgado para un
-- trabajo de semestre y sigue atrapando el cero y los errores de tecleo.
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_estimated_minutes_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_estimated_minutes_check
  CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 5 AND 6000);


-- ────────────────────────────────────────────────────────────
-- study_sessions.focus_rating
--
-- Dos sesiones de 50 minutos no valen lo mismo si una fue seguida y la otra
-- con el móvil delante. Sin este dato, las estadísticas solo pueden decir
-- *cuándo* se estudia más, nunca *cuándo se estudia mejor*, que es lo que
-- permite mover una materia difícil a la franja en la que uno rinde.
--
-- Texto con CHECK y no un enum nuevo: son tres valores de producto, no de
-- dominio, y ampliarlos con un enum obliga a un ALTER TYPE que no se puede
-- revertir. Nullable porque calificar siempre es opcional.
-- ────────────────────────────────────────────────────────────
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS focus_rating text;

ALTER TABLE study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_focus_rating_check;

ALTER TABLE study_sessions
  ADD CONSTRAINT study_sessions_focus_rating_check
  CHECK (focus_rating IS NULL OR focus_rating IN ('focused', 'ok', 'distracted'));


-- ────────────────────────────────────────────────────────────
-- profiles.pomodoro_*
--
-- El modo Pomodoro estaba retirado de la interfaz porque sus tiempos eran
-- constantes en el cliente: 25/5 servía para leer, no para resolver
-- problemas. Con la configuración en el perfil vuelve a ser un modo real, y
-- vive junto a las metas (migración 003) porque es la misma clase de dato:
-- preferencias de estudio del usuario, no estado de una sesión.
--
-- Los rangos replican los que valida `updatePomodoroSchema`.
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pomodoro_focus_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS pomodoro_break_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pomodoro_long_break_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS pomodoro_cycles_before_long_break integer NOT NULL DEFAULT 4;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_pomodoro_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_pomodoro_check CHECK (
    pomodoro_focus_minutes BETWEEN 5 AND 90
    AND pomodoro_break_minutes BETWEEN 1 AND 30
    AND pomodoro_long_break_minutes BETWEEN 5 AND 60
    AND pomodoro_cycles_before_long_break BETWEEN 2 AND 8
    -- El descanso largo no puede ser más corto que el corto: el ciclo dejaría
    -- de tener sentido y la interfaz mostraría una pausa «larga» de 2 min.
    AND pomodoro_long_break_minutes >= pomodoro_break_minutes
  );


-- ────────────────────────────────────────────────────────────
-- Índice para el desglose por franja horaria y por calidad
--
-- Las dos vistas nuevas de estadísticas recorren el año de sesiones
-- completadas del usuario, que es exactamente lo que cubre
-- `sessions_completed_idx` (migración 005). No hace falta un índice nuevo:
-- se anota aquí para que la próxima auditoría no lo eche en falta.
-- ────────────────────────────────────────────────────────────
