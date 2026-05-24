-- ============================================================
-- StudyHub - Metas de estudio diaria y semanal
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_goal_minutes  INTEGER NOT NULL DEFAULT 60
    CHECK (daily_goal_minutes BETWEEN 5 AND 480),
  ADD COLUMN IF NOT EXISTS weekly_goal_minutes INTEGER NOT NULL DEFAULT 300
    CHECK (weekly_goal_minutes BETWEEN 30 AND 2400);
