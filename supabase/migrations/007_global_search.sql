-- ============================================================
-- StudyHub - Búsqueda global  (D4, B9)
-- Ejecutar en el SQL Editor de Supabase después de 006_task_sessions.sql
--
-- La migración 001 creó `notes_search_idx`, un GIN sobre
-- to_tsvector('spanish', title || ' ' || content_text), y nunca se usó:
-- `NoteModel.search` filtraba con ILIKE (que no puede aprovechar ese índice) y
-- además interpolaba el término sin escapar dentro de la sintaxis de filtros
-- de PostgREST, así que una coma o un paréntesis cambiaban el significado de
-- la consulta. Y ni siquiera llegaba a ejecutarse: la búsqueda real de la
-- pantalla de notas filtraba en memoria en el navegador.
--
-- Aquí se añade el índice equivalente para tareas y una función que busca en
-- ambas tablas a la vez, que es lo que necesita la paleta de comandos.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Índice full-text de tareas
--
-- La expresión debe ser *idéntica* a la del WHERE para que el planificador
-- pueda usar el índice; de ahí el coalesce explícito sobre description.
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tasks_search_idx
  ON tasks USING gin(
    to_tsvector('spanish', title || ' ' || coalesce(description, ''))
  );


-- ────────────────────────────────────────────────────────────
-- Texto libre → tsquery con prefijo
--
-- `plainto_tsquery` no hace prefijo: escribir «cálc» no encontraría
-- «Cálculo», que es justo lo que se espera mientras se teclea en una paleta de
-- comandos. `to_tsquery` sí, pero su sintaxis es un lenguaje: pasarle texto de
-- usuario sin sanear lanza un error de sintaxis en cuanto aparece un
-- paréntesis o un ampersand.
--
-- Esta función se queda solo con las palabras, les añade `:*` y las une con
-- AND. Un término vacío devuelve una tsquery vacía, que no casa con nada, en
-- lugar de reventar.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION studyhub_prefix_tsquery(q text)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := array_to_string(
    ARRAY(
      SELECT word || ':*'
      FROM unnest(
        string_to_array(
          trim(regexp_replace(lower(coalesce(q, '')), '[^[:alnum:]áéíóúüñ]+', ' ', 'g')),
          ' '
        )
      ) AS word
      WHERE word <> ''
    ),
    ' & '
  );

  IF cleaned = '' THEN
    RETURN ''::tsquery;
  END IF;

  RETURN to_tsquery('spanish', cleaned);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- Búsqueda global
--
-- SECURITY INVOKER (el modo por defecto, declarado aquí para que se lea): la
-- función corre con los permisos de quien la llama, así que las políticas RLS
-- de `notes` y `tasks` siguen aplicándose y cada usuario solo puede encontrar
-- lo suyo. Con SECURITY DEFINER esta función sería un agujero de lectura
-- global sobre las dos tablas.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_everything(q text, max_results integer DEFAULT 20)
RETURNS TABLE (
  kind       text,
  id         uuid,
  title      text,
  snippet    text,
  extra      text,
  updated_at timestamptz,
  rank       real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- La CTE no puede llamarse `q` como el parámetro: en una función SQL los
  -- parámetros son visibles por nombre, y `q.ts` quedaría ambiguo.
  WITH tsq AS (SELECT studyhub_prefix_tsquery(q) AS ts)
  SELECT
    'note'::text AS kind,
    n.id         AS id,
    n.title      AS title,
    left(n.content_text, 160) AS snippet,
    NULL::text   AS extra,
    n.updated_at AS updated_at,
    ts_rank(to_tsvector('spanish', n.title || ' ' || n.content_text), tsq.ts) AS rank
  FROM notes n, tsq
  WHERE to_tsvector('spanish', n.title || ' ' || n.content_text) @@ tsq.ts

  UNION ALL

  SELECT
    'task'::text,
    t.id,
    t.title,
    left(coalesce(t.description, ''), 160),
    t.quadrant::text,
    coalesce(t.completed_at, t.created_at),
    ts_rank(
      to_tsvector('spanish', t.title || ' ' || coalesce(t.description, '')),
      tsq.ts
    )
  FROM tasks t, tsq
  WHERE to_tsvector('spanish', t.title || ' ' || coalesce(t.description, '')) @@ tsq.ts
    AND t.completed = false

  -- Por posición y no por nombre: sobre un UNION, un `ORDER BY rank` se
  -- resolvería contra los nombres de la primera rama y contra las columnas de
  -- salida declaradas en RETURNS TABLE, que aquí se llaman igual.
  ORDER BY 7 DESC, 6 DESC
  LIMIT least(greatest(coalesce(max_results, 20), 1), 50);
$$;

GRANT EXECUTE ON FUNCTION studyhub_prefix_tsquery(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_everything(text, integer) TO authenticated;
