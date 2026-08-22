-- ============================================================
-- StudyHub - Cuenta nueva sembrada  (C9)
-- Ejecutar en el SQL Editor de Supabase después de 007_global_search.sql
--
-- Un usuario recién registrado veía un dashboard en ceros, un Kanban con
-- cuatro columnas vacías, un temporizador sin ninguna categoría que elegir y
-- una lista de notas en blanco. Cada pantalla tenía su mensaje de vacío, pero
-- ninguna decía por dónde empezar, y la matriz de Eisenhower —que es el modelo
-- mental de toda la pantalla de tareas— no se explicaba en ningún sitio.
--
-- El trigger `handle_new_user` ya existía para crear el perfil; es el sitio
-- natural para sembrar tres categorías y una nota de bienvenida. Lo más barato
-- con más efecto: la app deja de arrancar vacía sin tocar una línea de UI.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- El sembrado va en un bloque con su propio manejador de errores: este
  -- trigger corre dentro de la transacción de registro, así que un fallo aquí
  -- —una restricción nueva, una tabla renombrada— impediría crear la cuenta.
  -- Una bienvenida que falla es un inconveniente; un registro que falla, no.
  BEGIN
    -- Tres categorías de arranque. Los colores son los mismos que usa la app
    -- para acción, información y urgencia, así que el Kanban y las gráficas se
    -- ven poblados desde el primer minuto.
    INSERT INTO categories (user_id, name, color) VALUES
      (NEW.id, 'General',   '#67b31f'),
      (NEW.id, 'Lecturas',  '#3b82f6'),
      (NEW.id, 'Exámenes',  '#ef4444');

    -- Nota de bienvenida. El contenido es un documento de Tiptap: `content`
    -- guarda el JSON que el editor sabe abrir y `content_text` la versión plana,
    -- que es la que alimenta el índice full-text (ver 007_global_search.sql).
    INSERT INTO notes (user_id, title, content, content_text, tags)
    VALUES (
      NEW.id,
      'Bienvenido a StudyHub',
      $json$
      {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "Esta nota se creó sola para que no empieces con la pantalla en blanco. Puedes editarla o borrarla cuando quieras." }
            ]
          },
          {
            "type": "heading",
            "attrs": { "level": 2 },
            "content": [{ "type": "text", "text": "La matriz de Eisenhower" }]
          },
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "La pantalla de Tareas no es una lista: es una matriz de cuatro cuadrantes que separa lo urgente de lo importante. Urgente es lo que reclama atención ahora; importante es lo que acerca a tus objetivos. Casi nunca son lo mismo." }
            ]
          },
          {
            "type": "bulletList",
            "content": [
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Hacer ahora: urgente e importante. El parcial de mañana." }] }] },
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Planificar: importante pero no urgente. Aquí es donde se estudia de verdad, y donde deberías pasar la mayor parte del tiempo." }] }] },
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Delegar: urgente pero no importante. Lo que interrumpe sin aportar." }] }] },
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Eliminar: ni urgente ni importante. Sé honesto con este cuadrante." }] }] }
            ]
          },
          {
            "type": "heading",
            "attrs": { "level": 2 },
            "content": [{ "type": "text", "text": "Cómo empezar" }]
          },
          {
            "type": "orderedList",
            "content": [
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Crea tus materias en Categorías. Ya tienes tres de ejemplo." }] }] },
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Añade lo que tienes pendiente en Tareas y ponle fecha límite: lo que vence hoy aparecerá en tu inicio." }] }] },
              { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Abre el temporizador, elige una de esas tareas y estudia. El tiempo queda registrado en la tarea." }] }] }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "Atajo: pulsa Ctrl+K en cualquier pantalla para buscar entre tus notas y tareas." }
            ]
          }
        ]
      }
      $json$::jsonb,
      'Esta nota se creó sola para que no empieces con la pantalla en blanco. La matriz de Eisenhower separa lo urgente de lo importante: Hacer ahora, Planificar, Delegar y Eliminar. Crea tus materias en Categorías, añade tus pendientes con fecha límite y usa el temporizador sobre una tarea concreta. Pulsa Ctrl+K para buscar.',
      ARRAY['bienvenida']
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo sembrar la cuenta %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$fn$;


-- ────────────────────────────────────────────────────────────
-- Cuentas existentes
--
-- El trigger solo corre al registrarse, así que las cuentas ya creadas no se
-- tocan. Es deliberado: escribir en la cuenta de alguien que lleva un semestre
-- usando la app sería una sorpresa desagradable.
--
-- Si quieres sembrar tu propia cuenta de pruebas, ejecuta esto a mano. La
-- condición limita el efecto a cuentas completamente vacías.
--
--   DO $seed$
--   DECLARE u uuid;
--   BEGIN
--     FOR u IN
--       SELECT id FROM auth.users
--       WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = auth.users.id)
--         AND NOT EXISTS (SELECT 1 FROM notes      WHERE user_id = auth.users.id)
--         AND NOT EXISTS (SELECT 1 FROM tasks      WHERE user_id = auth.users.id)
--     LOOP
--       INSERT INTO categories (user_id, name, color) VALUES
--         (u, 'General', '#67b31f'), (u, 'Lecturas', '#3b82f6'), (u, 'Exámenes', '#ef4444');
--     END LOOP;
--   END $seed$;
-- ────────────────────────────────────────────────────────────
