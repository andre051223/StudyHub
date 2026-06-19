-- ============================================================
-- StudyHub - Modo cronómetro (cuenta ascendente)
-- Agrega el valor 'stopwatch' al enum study_mode
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ADD VALUE IF NOT EXISTS evita error si la migración se aplica dos veces.
ALTER TYPE study_mode ADD VALUE IF NOT EXISTS 'stopwatch';
