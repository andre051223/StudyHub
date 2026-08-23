# StudyHub — Documento de contexto para Claude Code

> **Propósito de este archivo.** Este no es un brief inicial: es la referencia de contexto
> de la aplicación **tal como está construida hoy**. Su objetivo es que Claude Code pueda
> entender la arquitectura, el modelo de datos y las convenciones del proyecto **antes de
> realizar cualquier actualización futura**, sin tener que redescubrir todo desde cero.
>
> Mantener este documento sincronizado con el código cuando se hagan cambios estructurales
> (nuevas tablas, nuevos módulos, cambios de stack).

StudyHub es un producto profesional (no un ejercicio académico). Cualquier referencia a un
contexto universitario debe considerarse obsoleta y no forma parte del proyecto.

---

## 1. Qué es StudyHub

Aplicación web full-stack para estudiantes y autodidactas que **centraliza tres herramientas
del flujo de estudio diario** en una sola experiencia:

1. **Notas** — apuntes con editor enriquecido, organizados en carpetas y con búsqueda.
2. **Tareas** — gestión por prioridad con la matriz de Eisenhower (Kanban de 4 cuadrantes).
3. **Temporizador** — sesiones de estudio (cuenta regresiva o cronómetro) con historial,
   estadísticas y metas.

El producto se apoya en un **dashboard** de resumen, **categorías/materias** compartidas entre
tareas y sesiones, **modo claro/oscuro**, y capacidades **PWA** (instalable, service worker).

La app está en español y su color de marca es el verde `#67b31f`.

---

## 2. Stack técnico (versiones reales)

| Capa | Tecnología | Notas |
|------|------------|-------|
| Framework | **Next.js 16** (App Router) | ver `package.json` (`next@16.2.4`) |
| Runtime React | **React 19** | Server Components por defecto |
| Lenguaje | **TypeScript 5** | modo estricto |
| Estilos | **Tailwind CSS v4** | configuración vía `@theme` en `globals.css` (no hay `tailwind.config.ts`) |
| Base de datos | **Supabase (Postgres)** | RLS en todas las tablas |
| Auth | **Supabase Auth** (email + password) | `@supabase/ssr` (no usar `auth-helpers`) |
| Cliente DB | `@supabase/supabase-js` + `@supabase/ssr` | |
| Editor rich text | **Tiptap 3** | StarterKit, Heading, CodeBlockLowlight, Image, Link, TaskList/TaskItem, Placeholder |
| Resaltado de código | `lowlight` | usado por CodeBlockLowlight |
| Gráficas | **Recharts 3** | estadísticas del timer y dashboard |
| Drag & drop | **@dnd-kit** (core, sortable, utilities) | Kanban de tareas |
| Iconos | **lucide-react** | |
| Validación | **Zod 4** | inputs y route handlers |
| Formularios | **react-hook-form 7** + `@hookform/resolvers` | |
| Fechas | **date-fns 4** | |
| Toasts | **sonner** | `<Toaster>` montado en el layout raíz |
| SOAP | **node-soap** | servicio SOAP de solo lectura (ver §6.3) |
| Utilidades CSS | `clsx` + `tailwind-merge` | helper `cn()` en `lib/utils.ts` |
| Tests | **Vitest 4** | `vitest.config.mts`; cubre `lib/**/*.test.ts` |

**Scripts** (`package.json`):

```
npm run dev         # next dev
npm run build       # next build
npm run start       # next start
npm run lint        # eslint
npm run test        # vitest run
npm run test:watch  # vitest
```

> Los tests corren con `TZ=America/Bogota` fijado en `vitest.config.mts`. Es
> deliberado: una zona con offset negativo es la que destapa los errores de
> agrupar días en UTC (ver §5.6).

---

## 3. Sistema visual y temas

Los tokens de diseño viven en `app/globals.css` (Tailwind v4 usa `@theme`, **no** un archivo
`tailwind.config.ts`). Hay dos temas conmutables mediante el atributo `data-theme` en `<html>`.

- **Conmutación de tema:** `data-theme="light" | "dark"` sobre `<html>`. La preferencia se
  guarda en `localStorage` bajo la clave `studyhub_theme`. Un script inline en
  `app/layout.tsx` (`themeInitScript`) aplica el tema **antes del primer render** para evitar
  el flash de tema incorrecto (FOUC). El componente `components/shared/ThemeToggle.tsx`
  alterna el valor.
- **Variante Tailwind `dark:`** está ligada a `[data-theme="dark"]` vía
  `@custom-variant dark (...)`, **no** a `prefers-color-scheme`.

Tokens principales (light por defecto; el tema oscuro redefine las superficies):

```css
--color-primary:       #67b31f;   /* verde de marca / acción */
--color-primary-dark:  #5a9e1b;
--color-primary-light: #7cc934;
--color-text:          #1a1a1a;   /* → #e8eaed en dark */
--color-text-soft:     #444444;   /* → #b4b9c2 en dark */
--color-bg:            #f8f9fa;   /* → #11151c en dark */  /* fondo de página */
--color-surface:       #ffffff;   /* → #1a1f29 en dark */  /* cards */
--color-surface-soft:  #f8f9fa;   /* → #232a36 en dark */
--color-gray-border:   #e2e8f0;   /* → #2d3543 en dark */
--shadow-card:         0 2px 16px rgba(0,0,0,0.07);
--shadow-card-hover:   0 8px 32px rgba(103,179,31,0.15);
--radius-sm/md/lg:     4px / 8px / 16px;
```

**Reglas de estilo importantes al escribir UI nueva:**
- Usar las variables de superficie (`var(--color-surface)`, `var(--color-bg)`,
  `var(--color-text)`, …) en lugar de colores fijos, para que el modo oscuro funcione solo.
- `color-scheme` se ajusta por tema para que controles nativos (`<select>`, date pickers,
  scrollbar, autofill) se pinten con el esquema correcto.
- Tipografía: **Roboto** vía `next/font/google` (variable `--font-roboto`), pesos 300/400/500/700.
- Espaciado generoso, radios suaves, sombras sutiles, hover con `translateY` leve.
- El verde primario es el color de acción; usarlo como acento, no saturar la interfaz.
- Estilos del editor Tiptap (`.ProseMirror …`) viven también en `globals.css`.

---

## 4. Estructura de carpetas (real)

```
StudyHub/
├── app/
│   ├── (auth)/                       # Rutas públicas de autenticación
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (app)/                        # Rutas protegidas (requieren sesión)
│   │   ├── layout.tsx                # Verifica sesión (redirect a /login) + Navbar,
│   │   │                             # ConfirmProvider, paleta Ctrl+K, aviso de instalación
│   │   ├── actions.ts                # Server Action de búsqueda global (Ctrl+K)
│   │   ├── dashboard/page.tsx        # Resumen del día: metas, racha, qué vence hoy
│   │   ├── agenda/page.tsx           # Fechas límite, semana a semana
│   │   ├── tasks/actions.ts          # Server Actions de tareas y subtareas
│   │   ├── timer/actions.ts          # Server Actions de sesiones y metas
│   │   ├── profile/actions.ts        # Server Action de perfil
│   │   ├── notes/
│   │   │   ├── page.tsx              # Lista de carpetas/notas
│   │   │   └── [noteId]/page.tsx     # Editor de nota individual (Tiptap)
│   │   ├── tasks/page.tsx            # Kanban Eisenhower
│   │   ├── timer/page.tsx            # Temporizador + historial + stats + metas
│   │   ├── categories/
│   │   │   ├── page.tsx              # CRUD de categorías
│   │   │   └── actions.ts            # Server Actions de categorías
│   │   └── profile/page.tsx          # Perfil del usuario
│   ├── api/                          # Route handlers (REST + SOAP)
│   │   ├── categories/route.ts       ·  categories/[id]/route.ts
│   │   ├── tasks/route.ts            ·  tasks/[id]/route.ts
│   │   ├── notes/route.ts            ·  notes/[id]/route.ts
│   │   ├── folders/route.ts         ·  folders/[id]/route.ts
│   │   ├── sessions/route.ts
│   │   └── soap/route.ts             # Endpoint SOAP (GET=WSDL, POST=operación)
│   ├── icons/                        # icon-192, icon-512 (rutas dinámicas PWA)
│   ├── icon.tsx / apple-icon.tsx     # Favicons generados
│   ├── manifest.ts                   # Web App Manifest (PWA: iconos, capturas, accesos)
│   ├── screenshots/[variant]/route.tsx # Capturas del manifest generadas con ImageResponse
│   ├── layout.tsx                    # Layout raíz (theme init, fuente, Toaster, SW)
│   ├── page.tsx                      # Landing pública
│   └── globals.css                   # Tokens de tema + estilos Tiptap
├── components/
│   ├── agenda/                       # AgendaClient (vista semanal de fechas límite)
│   ├── dashboard/                    # TodayStats, DueToday, LocalDate
│   ├── landing/                      # ShowcaseSection, mockups
│   ├── notes/                        # NotesClient, NoteEditor
│   ├── tasks/                        # TasksClient, KanbanColumn, TaskCard, TaskModal
│   ├── timer/                        # TimerClient, MiniTimer, SessionHistory, StudyStats, StudyGoals
│   ├── categories/                   # CategoriesClient, CategoryForm, CategoryList
│   └── shared/                       # Navbar, ThemeToggle, ProfileClient, ServiceWorkerRegistrar,
│                                     # Modal, ConfirmProvider, CommandPalette, InstallPrompt
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Cliente para Client Components (browser)
│   │   ├── server.ts                 # Cliente para Server Components / route handlers
│   │   └── middleware.ts             # updateSession(): refresco de sesión + guard de rutas
│   ├── models/                       # Capa de modelos OOP (ver §5)
│   │   ├── BaseModel.ts              # Clase base + ModelError
│   │   ├── CategoryModel.ts · TaskModel.ts · FolderModel.ts · NoteModel.ts · SessionModel.ts
│   │   ├── SearchModel.ts            # Búsqueda global (RPC search_everything)
│   │   └── index.ts                  # Reexporta modelos y sus tipos Create/Update
│   ├── services/
│   │   └── StudyHubSoapService.ts    # Lógica de negocio expuesta por SOAP
│   ├── api/
│   │   ├── helpers.ts                # getAuthContext(), parseBody(), ok(), errorResponse()
│   │   ├── schemas.ts                # Esquemas Zod compartidos (API + actions + formularios)
│   │   └── actions.ts                # ActionResult, requireUser(), parseInput()
│   ├── stats.ts                      # ÚNICA fuente de las métricas de estudio (ver §5.6)
│   ├── stats.test.ts                 # Tests de lib/stats.ts (vitest)
│   ├── deadlines.ts                  # Lectura de tasks.deadline (fecha de calendario en UTC)
│   ├── deadlines.test.ts             # Tests de lib/deadlines.ts (vitest)
│   ├── offline.ts                    # Copia local de las notas para leerlas sin conexión
│   ├── types.ts                      # Tipos de dominio compartidos (Profile, Note, Task, …)
│   └── utils.ts                      # cn() y utilidades
├── hooks/
│   └── useMediaQuery.ts              # Suscripción a media queries (rejilla 2×2 del Kanban)
├── public/
│   ├── studyhub.wsdl                 # Contrato del servicio SOAP
│   └── sounds/bell.wav               # Sonido al completar una sesión
├── proxy.ts                          # Middleware raíz (nombre de Next 16) → updateSession()
├── vitest.config.mts                 # Config de tests (fija TZ=America/Bogota)
└── supabase/
    └── migrations/                   # 001_initial · 002_categories_constraints · 003_user_goals
                                      # 004_stopwatch_mode · 005_data_integrity
                                      # 006_task_sessions · 007_global_search · 008_onboarding
```

> Nota: **no hay `tailwind.config.ts`** (Tailwind v4 se configura vía `@theme` en
> `globals.css`). El guard de rutas se aplica en **dos** capas: `proxy.ts` en la raíz —que es
> como Next 16 llama al antiguo `middleware.ts`— delega en `updateSession()` de
> `lib/supabase/middleware.ts` para refrescar la cookie de sesión y redirigir, y el Server
> Component `app/(app)/layout.tsx` vuelve a comprobar la sesión antes de renderizar (ver §7).

---

## 5. Arquitectura por capas

StudyHub separa responsabilidades en capas claras. **Al agregar funcionalidad, respetar esta
separación.**

1. **Capa de modelos (`lib/models/`) — acceso a datos y reglas de negocio.**
   Clases que extienden `BaseModel` (recibe un `SupabaseClient` por constructor). Cada modelo
   encapsula las queries a Supabase y validaciones de negocio, y lanza `ModelError` en caso de
   fallo. Exponen métodos como `findAllByUser`, `findById`, `create`, `update`, `delete`
   (y específicos, p. ej. `TaskModel.addSubtask`, `SessionModel.getStats`).
   Cada modelo declara sus tipos de entrada `CreateXInput` / `UpdateXInput`.
   - `CategoryModel`, `TaskModel` (+ subtareas), `FolderModel`, `NoteModel`, `SessionModel`.
   - Todas las queries filtran por `user_id`; RLS en la base es la segunda línea de defensa.

2. **Esquemas de validación (`lib/api/schemas.ts`) — fuente única.**
   Todos los esquemas Zod de entrada viven aquí y los comparten los route handlers, las
   Server Actions y los formularios. **No duplicar un esquema en un componente**: importarlo.

3. **Capa de API REST (`app/api/**/route.ts`) — HTTP sobre los modelos.**
   Superficie de integración externa; la UI **no** la consume (ver §5.5).
   Cada recurso tiene su colección (`route.ts`) y su item (`[id]/route.ts`).
   Patrón obligatorio de cada handler:
   - `getAuthContext()` (de `lib/api/helpers.ts`) obtiene `{ supabase, userId }` o devuelve
     `401` si no hay sesión. Se comprueba con `isResponse(ctx)`.
   - `parseBody(req, esquema)` valida el cuerpo con **Zod** y devuelve `400` con
     `fieldErrors` si no encaja. Los handlers de item validan además que el `[id]` sea un UUID.
   - Instanciar el modelo correspondiente y delegar.
   - Responder con `ok(data)`; los fallos pasan por `errorResponse(e)`, que traduce la
     excepción al código HTTP correcto (404 / 409 / 400 / 500) y **no reenvía al cliente los
     mensajes crudos de Postgres**.

4. **Servicio SOAP (`app/api/soap/route.ts` + `lib/services/StudyHubSoapService.ts`).**
   Endpoint interoperable de **solo lectura** que reutiliza los modelos. Ver §6.3.

5. **Server Actions (`app/(app)/<ruta>/actions.ts`).**
   El camino de escritura de la UI. Ver §5.5.

6. **Capa de UI.**
   - **Server Components** por defecto (páginas en `app/`): hacen el fetch inicial con el
     cliente de servidor (`lib/supabase/server.ts`) y pasan datos a componentes cliente.
   - **Client Components** (`*Client.tsx`, con `'use client'`): interactividad, estado local
     y optimistic updates. Escriben vía Server Actions o, para lo trivial, con
     `lib/supabase/client.ts` (ver §5.5).

### 5.5 Cómo escribe la UI: Server Actions vs. Supabase directo

Durante un tiempo convivieron dos caminos de escritura sin criterio: los modelos y la API
REST existían, pero **ninguna** escritura de la interfaz pasaba por ellos —los componentes
insertaban directo contra Supabase—, así que las reglas de negocio de `lib/models/` no
llegaban a ejecutarse nunca. La regla ahora es explícita:

| Operación | Camino | Por qué |
|-----------|--------|---------|
| Crear/editar/borrar tarea, subtarea | **Server Action** (`tasks/actions.ts`) | `TaskModel` recorta el título, calcula `position` y comprueba pertenencia |
| Guardar sesión de estudio | **Server Action** (`timer/actions.ts`) | `SessionModel` valida el rango según el modo |
| Metas de estudio, perfil | **Server Action** | rangos y longitudes que replican los CHECK de la base |
| CRUD de categorías | **Server Action** (`categories/actions.ts`) | unicidad, longitud y color hex |
| Marcar tarea completada, mover de cuadrante | Supabase directo | cambio de estado sin reglas; el viaje extra solo añadiría latencia al arrastre |
| Marcar/borrar subtarea | Supabase directo | ídem |
| Autoguardado de nota, subida de imágenes | Supabase directo | alta frecuencia (cada segundo al escribir) y Storage es del cliente |
| Crear/borrar nota y carpeta | Supabase directo | solo aplica valores por defecto |

**Al añadir una escritura nueva:** si toca una regla de negocio, va por Server Action y la
regla vive en el modelo. Si es un flip de estado, va directa. Ante la duda, Server Action.

Las Server Actions **no lanzan** hacia el cliente: devuelven `ActionResult<T>`
(`lib/api/actions.ts`), un resultado discriminado con `error` y `fieldErrors`. Una excepción
en una Server Action llega al navegador como un error opaco en producción, así que los fallos
previsibles se modelan como datos. Helpers disponibles: `requireUser()`, `parseInput()`,
`actionOk()`, `actionErr()` y `actionError()`.

7. **Métricas de estudio (`lib/stats.ts`) — fuente única.**
   Ver §5.6. **Ninguna pantalla debe calcular métricas de estudio por su cuenta.**

**Tipos de dominio** compartidos en `lib/types.ts`: `Profile`, `Folder`, `Note`, `Task`,
`Subtask`, `Category`, `TaskQuadrant`, `StudySession`, `StudyMode`, `TimerState`.

### 5.6 Métricas de estudio: `lib/stats.ts`

Todas las métricas (minutos por semana, racha, promedio diario, buckets diarios, totales por
categoría) viven en `lib/stats.ts` y las consumen el dashboard, `StudyStats`, `StudyGoals` y
`SessionModel.getStats()` (que a su vez alimenta SOAP). Antes cada pantalla tenía su propia
versión y las cuatro devolvían números distintos para la misma semana.

Dos reglas que el módulo hace cumplir y que **hay que respetar al añadir métricas nuevas**:

- **Usar `actual_duration_seconds`, nunca `duration_minutes`.** `duration_minutes` es la
  duración *planeada* (y es `null` en modo cronómetro); solo `actual_duration_seconds` refleja
  lo que se estudió de verdad.
- **Agrupar días con `localDayKey()`, nunca con `toISOString().slice(0, 10)`.** El segundo
  convierte a UTC primero, así que en UTC−5 una sesión de las 19:30 se contaba como del día
  siguiente: rompía la gráfica diaria, la meta diaria y la racha.

Las funciones son puras y reciben `now` por parámetro, así que se prueban con fecha fija.
`lib/stats.test.ts` cubre ambas reglas con tests de regresión explícitos.

Las sesiones para estadísticas se traen con `SessionModel.findForStats()` (último año, columnas
mínimas), **no** con el `limit(50)` del historial: derivar la racha de esa ventana la cortaba
en seco a partir de la sesión 51.

---

## 6. Modelo de datos (Supabase)

Migraciones en `supabase/migrations/` (aplicar en orden en el SQL Editor de Supabase).
**Todas las tablas tienen RLS activado**; las políticas restringen el acceso a los registros
propios (`auth.uid() = user_id`, o el equivalente para `subtasks` vía la tarea padre).

Desde la **migración 005** las políticas son granulares (`SELECT`/`INSERT`/`UPDATE`/`DELETE`)
con `WITH CHECK` explícito en las de escritura, y `user_id` tiene `DEFAULT auth.uid()` en las
cinco tablas de usuario. Aun así, **los clientes envían `user_id` explícitamente** al insertar:
así el código no depende de un detalle del esquema y RLS sigue siendo quien verifica.

### 6.1 Tablas

**`profiles`** — creada por trigger `handle_new_user` al registrarse en `auth.users`.
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid (PK, FK→auth.users) | |
| full_name | text | default '' (viene de `raw_user_meta_data`) |
| avatar_url | text | nullable |
| created_at | timestamptz | |
| daily_goal_minutes | integer | default 60, CHECK 5–480 · *migración 003* |
| weekly_goal_minutes | integer | default 300, CHECK 30–2400 · *migración 003* |
| pomodoro_focus_minutes | integer | default 25, CHECK 5–90 · *migración 009* |
| pomodoro_break_minutes | integer | default 5, CHECK 1–30 · *migración 009* |
| pomodoro_long_break_minutes | integer | default 15, CHECK 5–60 y ≥ descanso corto · *migración 009* |
| pomodoro_cycles_before_long_break | integer | default 4, CHECK 2–8 · *migración 009* |

**`categories`** — materias/áreas compartidas por tareas y sesiones.
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| name | text | UNIQUE por usuario; CHECK longitud ≥ 2 · *migración 002* |
| color | text | default `#67b31f`; CHECK hex `^#[0-9a-fA-F]{6}$` · *migración 002* |
| created_at | timestamptz | |

**`folders`** — carpetas de notas.
| id uuid PK · user_id uuid FK · name text · color text (nullable) · created_at timestamptz |

**`notes`**
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| folder_id | uuid (FK→folders, ON DELETE SET NULL) | null = sin carpeta ("Inbox") |
| title | text | default 'Sin título' |
| content | jsonb | documento Tiptap |
| content_text | text | versión plana para búsqueda full-text |
| tags | text[] | |
| created_at / updated_at | timestamptz | `updated_at` vía trigger |

Índice full-text español: `notes_search_idx` GIN sobre `to_tsvector('spanish', title || ' ' || content_text)`.
Bucket de Storage **`notes-images`** (público) para imágenes de notas, con políticas de
select/insert/delete.

**`tasks`**
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| title | text | |
| description | text | nullable |
| quadrant | enum `task_quadrant` | `urgent_important`, `not_urgent_important`, `urgent_not_important`, `not_urgent_not_important` (default `not_urgent_important`) |
| deadline | timestamptz | nullable |
| category_id | uuid (FK→categories, SET NULL) | nullable |
| completed | boolean | default false |
| position | integer | orden dentro del cuadrante (drag & drop) |
| created_at / completed_at | timestamptz | `completed_at` se setea al completar |

**`subtasks`** — id · task_id (FK→tasks, CASCADE) · title · completed · position.
RLS por pertenencia a la tarea del usuario.

**`study_sessions`**
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| category_id | uuid (FK, SET NULL) | nullable |
| duration_minutes | integer | **nullable** · duración *planeada*; `null` en modo cronómetro. CHECK 1–1440 · el modelo valida 10–120 solo para `simple` · *migración 005* |
| actual_duration_seconds | integer | tiempo real transcurrido · CHECK ≥ 0 · **la métrica que usan todas las estadísticas** |
| mode | enum `study_mode` | `simple`, `pomodoro`, `stopwatch` (*migración 004*), `manual` (*migración 009*) |
| pomodoro_cycles_completed | integer | default 0 |
| started_at | timestamptz | |
| completed_at | timestamptz | null = sesión abandonada |
| notes | text | nullable |
| focus_rating | text | nullable · CHECK `focused`/`ok`/`distracted` · *migración 009* |

### 6.2 Notas sobre los modos de estudio

`StudyMode = 'simple' | 'stopwatch' | 'pomodoro' | 'manual'`.

- **simple** — cuenta regresiva de la duración elegida con el slider (10–120 min).
- **stopwatch** — cronómetro ascendente, sin meta. No tiene duración planeada.
- **pomodoro** — bloques de foco encadenados con descansos (migración 009). Cada bloque de
  foco se guarda como su propia sesión: es tiempo realmente estudiado y debe contar aunque la
  tanda se abandone. Los descansos no se guardan.
- **manual** — sesión escrita a mano después de estudiar (migración 009). Tampoco tiene
  duración planeada; se distingue de `simple` a propósito para que el historial no presente
  como cronometrado lo que es recordado.

El rango válido de `duration_minutes` depende del modo y vive en `PLANNED_RANGE`
(`lib/models/SessionModel.ts`): 10–120 para `simple`, 5–90 para `pomodoro`, y `null`
obligatorio para `stopwatch` y `manual`. Antes esta regla era un `if (mode !== 'stopwatch')`,
que al reintroducir el Pomodoro habría exigido a un bloque de foco de 5 min cumplir el mínimo
de 10 del temporizador.

### 6.3 Servicio SOAP (interoperabilidad)

- **WSDL:** `public/studyhub.wsdl`. `GET /api/soap` devuelve el WSDL; `POST /api/soap` procesa
  un envelope SOAP 1.1 con `node-soap`. El WSDL se cachea en memoria por proceso (antes se
  releía de disco y se reparseaba en cada petición).
- **Autenticación:** `POST /api/soap` **requiere sesión** y devuelve un `soap:Fault` 401 si no
  la hay. El `userId` que declara el WSDL se acepta por compatibilidad pero **no se usa para
  consultar**: la identidad sale siempre de `auth.getUser()`. Si el del envelope no coincide
  con la sesión, la operación falla con un Fault 403. Antes cada operación consultaba con el
  `userId` que le enviaran, sin comprobar sesión.
- **Operaciones (solo lectura):** `GetCategories`, `GetTaskStats`, `GetStudyStats`, que
  delegan en los modelos (`CategoryModel`, `SessionModel`) o en queries directas.
  Implementación en `lib/services/StudyHubSoapService.ts` (`buildSoapServiceObject` arma la
  forma `service → port → operation` que espera node-soap y recibe el usuario de la sesión).

---

## 7. Autenticación y protección de rutas

- **Auth:** Supabase Auth (email + password) vía `@supabase/ssr`.
- **Páginas públicas:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
- **Recuperación de contraseña:** flujo completo por email (`forgot-password` → email →
  `reset-password`).
- **Guard efectivo:** el Server Component `app/(app)/layout.tsx` obtiene el usuario con
  `supabase.auth.getUser()` y hace `redirect('/login')` si no hay sesión. Todas las páginas
  bajo `(app)` quedan protegidas por este layout.
- **`lib/supabase/middleware.ts`** (`updateSession`) refresca la sesión y redirige entre rutas
  públicas/protegidas (`/dashboard`, `/notes`, `/tasks`, `/timer`); disponible para conectarse
  en un `middleware.ts` raíz si se desea centralizar el guard en el edge.
- **Clientes Supabase:** usar `lib/supabase/server.ts` en Server Components / route handlers y
  `lib/supabase/client.ts` en Client Components.

---

## 8. Módulos funcionales

### 8.1 Notas (`/notes`)
- Sidebar de carpetas con contador de notas; búsqueda global (full-text español sobre
  `title` + `content_text`) y filtro por tags.
- Editor Tiptap (`components/notes/NoteEditor.tsx`) con StarterKit, Heading (h1–h3),
  CodeBlockLowlight, Image (subida a Storage `notes-images`), Link, TaskList/TaskItem,
  Placeholder.
- Título editable, selector de carpeta, input de tags. Autoguardado con debounce
  (actualiza `updated_at` y `content_text`) e indicador Guardado/Guardando.
- Eliminar con confirmación.

### 8.2 Tareas (`/tasks`)
- Kanban de 4 cuadrantes (matriz de Eisenhower) con `@dnd-kit`. Acentos de color por cuadrante
  (rojo/verde/amarillo/gris). Componentes: `TasksClient`, `KanbanColumn`, `TaskCard`, `TaskModal`.
- Tarjeta: checkbox de completado, badge de categoría, deadline (resaltado si vence hoy/vencida),
  contador de subtareas.
- Modal de detalle: título, descripción, selector de cuadrante, deadline, categoría (crear
  inline), subtareas, eliminar.
- Drag & drop actualiza `quadrant`/`position` con **optimistic updates**. Filtro por categoría
  y toggle de completadas.

### 8.3 Temporizador (`/timer`)
- `TimerClient` con modos **simple** (regresiva) y **stopwatch** (ascendente); selector de
  categoría; rango 10–120 min. Controles iniciar/pausar/reanudar/detener.
- Estado del timer persistido en `localStorage` (`TimerState`) para sobrevivir a refrescos;
  el tiempo se calcula por timestamps (no por contadores) para funcionar en background.
- Al completar: sonido (`public/sounds/bell.wav`) + notificación del navegador. `MiniTimer`
  permite ver el timer activo desde otras vistas.
- **Historial** (`SessionHistory`): sesiones completadas con filtros.
- **Estadísticas** (`StudyStats`): tarjetas de resumen, gráfica de barras de minutos por
  día (Recharts), **tabla de tiempo por categoría** (`CategoryBreakdown`) ordenable y
  filtrable por día / semana / mes con comparativa contra el mismo tramo del periodo
  anterior, **mapa de calor de constancia** (`StudyHeatmap`, desde la primera sesión y hasta un año) y **franja horaria + calidad
  percibida** (`StudyPatterns`). `SessionModel.getStats()` calcula minutos de la semana,
  racha (`currentStreak`), categoría top del mes y promedio diario.
- **Alta manual y corrección de sesiones** (`SessionForm`): registrar estudio hecho sin la
  app (`mode: 'manual'`) y editar o eliminar una sesión guardada. Sin esto, una sesión
  inflada por olvidar detener el cronómetro falseaba la racha para siempre.
- **Metas** (`StudyGoals`): metas diaria/semanal y ajustes del ciclo Pomodoro, todo en
  `profiles` (`daily_goal_minutes`, `weekly_goal_minutes`, `pomodoro_*`).

### 8.4 Categorías (`/categories`)
- CRUD (listar, crear, renombrar, recolorear, eliminar). Constraints de unicidad, longitud y
  color hex a nivel de base (migración 002). Componentes en `components/categories/`;
  mutaciones vía `actions.ts` (Server Actions) y/o API REST.

### 8.5 Dashboard (`/dashboard`)
- Vista de resumen general (punto de aterrizaje tras el login).

### 8.6 Perfil (`/profile`)
- Datos del usuario (`ProfileClient`).

---

## 9. PWA

- `app/manifest.ts` (Web App Manifest), iconos generados (`app/icon.tsx`, `app/apple-icon.tsx`,
  `app/icons/icon-192`, `app/icons/icon-512`).
- `components/shared/ServiceWorkerRegistrar.tsx` registra el service worker (montado en el
  layout raíz). La app es instalable.

---

## 10. Convenciones y criterios de calidad

- **TypeScript estricto**, evitar `any`.
- **Server Components por defecto**; `'use client'` solo cuando hay interactividad.
- **Validación con Zod** en formularios, route handlers y Server Actions, **con el esquema
  compartido de `lib/api/schemas.ts`**. Un esquema duplicado en un componente es un bug latente:
  cliente y servidor acaban aceptando cosas distintas.
- Las **escrituras con reglas de negocio** pasan por la capa de modelos (`lib/models/`), vía
  Server Action o route handler. Los flips de estado sin reglas pueden ir directos a Supabase.
  La tabla de §5.5 es la referencia; ante la duda, Server Action.
- Handlers de API: `getAuthContext()` → `parseBody()` → modelo → `ok()` / `errorResponse()`.
  **Nunca devolver al cliente el mensaje crudo de un error de Postgres.**
- **Optimistic updates** en interacciones críticas (drag & drop, toggle de completado).
- **Métricas de estudio solo desde `lib/stats.ts`** (§5.6): sobre `actual_duration_seconds` y
  agrupando días con `localDayKey()`. Toda métrica nueva va acompañada de su test.
- **RLS activado** en todas las tablas; nunca confiar solo en el filtrado de la aplicación.
- **Sin secretos en el código**: todo por variables de entorno.
- UI theme-aware: usar variables CSS de superficie para que el modo oscuro funcione sin
  ajustes por componente.
- Accesibilidad: labels en inputs, roles ARIA donde aplique, contraste, navegación por teclado.
- Estados de carga y error explícitos en cada fetch; feedback con toasts (`sonner`).

---

## 11. Variables de entorno

Ver `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here   # solo scripts admin, nunca exponer al cliente
```

---

## 12. Cómo trabajar cambios futuros (guía rápida para Claude Code)

- **Nueva entidad/tabla:** crear migración en `supabase/migrations/NNN_*.sql` (RLS + políticas),
  agregar el tipo en `lib/types.ts`, crear su `XModel` en `lib/models/` (extendiendo
  `BaseModel`) y exportarlo en `index.ts`, y exponer `app/api/<recurso>/route.ts` (+ `[id]`).
- **Nueva pantalla:** página en `app/(app)/<ruta>/page.tsx` (Server Component para el fetch
  inicial) + componente `*Client.tsx` para interactividad; enlazar en `Navbar` y en el guard de
  `lib/supabase/middleware.ts` si debe protegerse por edge.
- **Estilos:** añadir tokens en `@theme` / `:root` / `html[data-theme="dark"]` de `globals.css`;
  reutilizar variables existentes.
- **Operación SOAP nueva:** actualizar `public/studyhub.wsdl` y `StudyHubSoapService.ts`.
- Tras cambios estructurales, **actualizar este documento**.
