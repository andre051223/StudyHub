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

**Scripts** (`package.json`):

```
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint
```

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
│   │   ├── layout.tsx                # Verifica sesión (redirect a /login) + Navbar
│   │   ├── dashboard/page.tsx        # Resumen general
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
│   ├── manifest.ts                   # Web App Manifest (PWA)
│   ├── layout.tsx                    # Layout raíz (theme init, fuente, Toaster, SW)
│   ├── page.tsx                      # Landing pública
│   └── globals.css                   # Tokens de tema + estilos Tiptap
├── components/
│   ├── landing/                      # ShowcaseSection, mockups
│   ├── notes/                        # NotesClient, NoteEditor
│   ├── tasks/                        # TasksClient, KanbanColumn, TaskCard, TaskModal
│   ├── timer/                        # TimerClient, MiniTimer, SessionHistory, StudyStats, StudyGoals
│   ├── categories/                   # CategoriesClient, CategoryForm, CategoryList
│   └── shared/                       # Navbar, ThemeToggle, ProfileClient, ServiceWorkerRegistrar, CategoriesClient
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Cliente para Client Components (browser)
│   │   ├── server.ts                 # Cliente para Server Components / route handlers
│   │   └── middleware.ts             # updateSession(): refresco de sesión + guard de rutas
│   ├── models/                       # Capa de modelos OOP (ver §5)
│   │   ├── BaseModel.ts              # Clase base + ModelError
│   │   ├── CategoryModel.ts · TaskModel.ts · FolderModel.ts · NoteModel.ts · SessionModel.ts
│   │   └── index.ts                  # Reexporta modelos y sus tipos Create/Update
│   ├── services/
│   │   └── StudyHubSoapService.ts    # Lógica de negocio expuesta por SOAP
│   ├── api/
│   │   └── helpers.ts                # getAuthContext(), ok(), err()
│   ├── types.ts                      # Tipos de dominio compartidos (Profile, Note, Task, …)
│   └── utils.ts                      # cn() y utilidades
├── public/
│   ├── studyhub.wsdl                 # Contrato del servicio SOAP
│   └── sounds/bell.wav               # Sonido al completar una sesión
└── supabase/
    └── migrations/                   # 001_initial · 002_categories_constraints · 003_user_goals · 004_stopwatch_mode
```

> Nota: **no hay `middleware.ts` en la raíz** y **no hay `tailwind.config.ts`**. El guard de
> rutas efectivo se hace en el Server Component `app/(app)/layout.tsx` (ver §7). El helper
> `lib/supabase/middleware.ts` (`updateSession`) implementa refresco de sesión + guard y está
> disponible para cablearse en un middleware raíz si se necesita.

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

2. **Capa de API REST (`app/api/**/route.ts`) — HTTP sobre los modelos.**
   Cada recurso tiene su colección (`route.ts`) y su item (`[id]/route.ts`).
   Patrón estándar de cada handler:
   - `getAuthContext()` (de `lib/api/helpers.ts`) obtiene `{ supabase, userId }` o devuelve
     `401` si no hay sesión.
   - Validar el body con **Zod**.
   - Instanciar el modelo correspondiente y delegar.
   - Responder con `ok(data)` / `err(msg, status)`.

3. **Servicio SOAP (`app/api/soap/route.ts` + `lib/services/StudyHubSoapService.ts`).**
   Endpoint interoperable de **solo lectura** que reutiliza los modelos. Ver §6.3.

4. **Server Actions (`app/(app)/categories/actions.ts`).**
   Mutaciones de categorías vía Server Actions (además de la API REST).

5. **Capa de UI.**
   - **Server Components** por defecto (páginas en `app/`): hacen el fetch inicial con el
     cliente de servidor (`lib/supabase/server.ts`) y pasan datos a componentes cliente.
   - **Client Components** (`*Client.tsx`, con `'use client'`): interactividad, estado local,
     optimistic updates, y llamadas a la API REST. Usan `lib/supabase/client.ts` cuando
     necesitan Supabase en el navegador (p. ej. subida de imágenes, auth).

**Tipos de dominio** compartidos en `lib/types.ts`: `Profile`, `Folder`, `Note`, `Task`,
`Subtask`, `Category`, `TaskQuadrant`, `StudySession`, `StudyMode`, `TimerState`.

---

## 6. Modelo de datos (Supabase)

Migraciones en `supabase/migrations/` (aplicar en orden en el SQL Editor de Supabase).
**Todas las tablas tienen RLS activado**; las políticas restringen el acceso a los registros
propios (`auth.uid() = user_id`, o el equivalente para `subtasks` vía la tarea padre).

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
| duration_minutes | integer | CHECK 1–120 en DB; el modelo valida 10–120 al crear |
| actual_duration_seconds | integer | tiempo real transcurrido |
| mode | enum `study_mode` | `simple`, `pomodoro` (legado), `stopwatch` · *migración 004* |
| pomodoro_cycles_completed | integer | default 0 |
| started_at | timestamptz | |
| completed_at | timestamptz | null = sesión abandonada |
| notes | text | nullable |

### 6.2 Notas sobre los modos de estudio

`StudyMode = 'simple' | 'stopwatch' | 'pomodoro'`. **`pomodoro` es legado**: ya no es
seleccionable en la UI pero se conserva en el enum para poder mostrar sesiones antiguas.
Modos activos: **simple** (cuenta regresiva de la duración elegida) y **stopwatch** (cronómetro
ascendente).

### 6.3 Servicio SOAP (interoperabilidad)

- **WSDL:** `public/studyhub.wsdl`. `GET /api/soap` devuelve el WSDL; `POST /api/soap` procesa
  un envelope SOAP 1.1 con `node-soap`.
- **Operaciones (solo lectura):** `GetCategories`, `GetTaskStats`, `GetStudyStats` — todas
  reciben `userId` y delegan en los modelos (`CategoryModel`, `SessionModel`) o en queries
  directas. Implementación en `lib/services/StudyHubSoapService.ts`
  (`buildSoapServiceObject` arma la forma `service → port → operation` que espera node-soap).

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
- **Estadísticas** (`StudyStats`, Recharts): minutos por día, distribución por categoría,
  y tarjetas de resumen. `SessionModel.getStats()` calcula minutos de la semana, racha
  (`currentStreak`), categoría top del mes y promedio diario.
- **Metas** (`StudyGoals`): metas diaria/semanal guardadas en `profiles`
  (`daily_goal_minutes`, `weekly_goal_minutes`).

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
- **Validación con Zod** en formularios y route handlers.
- Acceso a datos **siempre a través de la capa de modelos** (`lib/models/`); no dispersar
  queries de Supabase por componentes o handlers.
- Handlers de API: `getAuthContext()` → validar (Zod) → modelo → `ok()`/`err()`.
- **Optimistic updates** en interacciones críticas (drag & drop, toggle de completado).
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
