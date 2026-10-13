# StudyHub

> Plataforma web full-stack para estudiantes y autodidactas que centraliza tres herramientas del flujo de estudio diario: notas con editor enriquecido, gestión de tareas en la Matriz de Eisenhower y temporizador de estudio con estadísticas.

La app está en español, su color de marca es el verde `#67b31f`, e incluye modo claro/oscuro y capacidades PWA (instalable, service worker, lectura de apuntes sin conexión).

---

## Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Stack técnico](#stack-técnico)
3. [Arquitectura](#arquitectura)
4. [Servicios Web — REST y SOAP](#servicios-web--rest-y-soap)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Módulos](#módulos)
7. [Instalación](#instalación)
8. [Variables de entorno](#variables-de-entorno)
9. [Base de datos](#base-de-datos)
10. [Scripts disponibles](#scripts-disponibles)
11. [Pruebas](#pruebas)
12. [Seguridad](#seguridad)
13. [Deploy](#deploy)
14. [Limitaciones y trabajo futuro](#limitaciones-y-trabajo-futuro)

---

## Descripción general

StudyHub es una aplicación web construida con **Next.js 16** y **Supabase** que integra en una sola plataforma las herramientas que un estudiante necesita en su día a día:

- **Notas** con editor de texto enriquecido (Tiptap), organización en carpetas, sistema de etiquetas y búsqueda full-text en español.
- **Tareas** organizadas en la Matriz de Eisenhower con tablero Kanban de 4 cuadrantes y drag & drop.
- **Agenda** semanal de fechas límite: donde la matriz responde «qué es importante», la agenda responde «qué me cae encima esta semana».
- **Temporizador** de estudio en modo simple (cuenta regresiva), cronómetro (stopwatch) o Pomodoro configurable, que puede apuntar a una tarea concreta, con ventana flotante, historial de sesiones, estadísticas visuales y metas diarias/semanales.

Se apoya en un **dashboard** de resumen, **categorías/materias** compartidas entre tareas y sesiones, una **búsqueda global** sobre notas y tareas accesible con `Ctrl+K`, **modo claro/oscuro** y capacidades **PWA** (instalable, con lectura de apuntes sin conexión). Todo con autenticación segura, datos aislados por usuario mediante Row Level Security, diseño responsivo y una capa completa de servicios web **REST** y **SOAP** que expone la lógica de negocio como API consumible desde cualquier cliente.

---

## Stack técnico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Framework | Next.js + App Router | 16.2.4 | SSR, Server Components, Route Handlers nativos para la API REST |
| Runtime UI | React | 19.2.4 | Server Components por defecto |
| Lenguaje | TypeScript | 5.x | Seguridad de tipos en compilación, mejor mantenibilidad |
| Estilos | Tailwind CSS | v4 | Configuración vía `@theme` en `globals.css` (sin `tailwind.config.ts`) |
| Base de datos | Supabase (PostgreSQL) | — | BaaS completo: DB, Auth y Storage en un solo servicio |
| Autenticación | Supabase Auth (`@supabase/ssr`) | — | Integrado con RLS, JWT seguro por defecto |
| Editor rich text | Tiptap | 3 | Extensible, basado en ProseMirror, accesible |
| Resaltado de código | lowlight | — | Usado por CodeBlockLowlight |
| Gráficas | Recharts | 3 | API declarativa, compatible con React 19 |
| Drag & drop | @dnd-kit | — | Accesible, optimizado para web |
| Iconos | lucide-react | — | Set de iconos consistente |
| Validación | Zod | v4 | Type-safe, integración directa con react-hook-form |
| Formularios | react-hook-form | 7 | Sin re-renders innecesarios, API sencilla |
| Fechas | date-fns | 4 | Modular y tree-shakeable |
| Toasts | Sonner | — | Minimalista, accesible, cero configuración |
| **Servicios SOAP** | **node-soap** | — | **Servidor SOAP 1.1 de solo lectura para Node.js** |
| Pruebas | Vitest | 4 | Ejecuta la lógica pura de `lib/` sin navegador ni base de datos |
| Utilidades CSS | clsx + tailwind-merge | — | Helper `cn()` en `lib/utils.ts` |

---

## Arquitectura

### Patrón MVC con capa de servicios web

StudyHub implementa el patrón **Modelo — Vista — Controlador** aprovechando las primitivas de Next.js App Router, y extiende la arquitectura con una capa de **API REST** y un **servicio SOAP** que expone los mismos modelos de negocio:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VISTA (View)                               │
│  components/  — Client Components React con "use client"            │
│  ├── tasks/TasksClient.tsx      ← tablero Kanban Eisenhower         │
│  ├── notes/NotesClient.tsx      ← lista de notas con filtros        │
│  ├── agenda/AgendaClient.tsx    ← semana de fechas límite           │
│  ├── timer/TimerClient.tsx      ← temporizador (simple/crono/pomo.) │
│  ├── categories/CategoriesClient.tsx  ← CRUD de categorías          │
│  └── shared/CommandPalette.tsx  ← búsqueda global (Ctrl+K)          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ Server Actions o fetch a /api/* (REST)
                       │ / cliente Supabase (browser) para auth e imágenes
┌──────────────────────▼──────────────────────────────────────────────┐
│               CONTROLADOR / API LAYER (Controller)                  │
│                                                                     │
│  app/api/  — Route Handlers Next.js (REST)                          │
│  ├── categories/route.ts       GET · POST                           │
│  ├── categories/[id]/route.ts  GET · PATCH · DELETE                 │
│  ├── tasks/route.ts            GET · POST                           │
│  ├── tasks/[id]/route.ts       GET · PATCH · DELETE                 │
│  ├── notes/route.ts            GET · POST  (soporta ?q= búsqueda)   │
│  ├── notes/[id]/route.ts       GET · PATCH · DELETE                 │
│  ├── folders/route.ts          GET · POST                           │
│  ├── folders/[id]/route.ts     GET · PATCH · DELETE                 │
│  ├── sessions/route.ts         GET · POST                           │
│  ├── sessions/[id]/route.ts    GET · PATCH · DELETE                 │
│  └── soap/route.ts             GET (WSDL) · POST (envelope XML)     │
│                                                                     │
│  app/(app)/**/actions.ts  — Server Actions                          │
│  ├── actions.ts             búsqueda global (searchAction)          │
│  ├── tasks/actions.ts       CRUD · subtareas · reordenar kanban     │
│  ├── timer/actions.ts       registrar sesión · guardar metas        │
│  ├── categories/actions.ts  CRUD de categorías                      │
│  └── profile/actions.ts     nombre del perfil                       │
│                                                                     │
│  lib/api/schemas.ts   — esquemas Zod compartidos por ambos caminos  │
│  lib/api/helpers.ts   — getAuthContext() · parseBody() · ok · err   │
│  lib/api/actions.ts   — requireUser() · parseInput() · ActionResult │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ instancia y llama métodos
┌──────────────────────▼──────────────────────────────────────────────┐
│                     MODELO (Model / DAO)                            │
│  lib/models/                                                        │
│  ├── BaseModel.ts        ← clase base + ModelError                  │
│  ├── CategoryModel.ts    ← CRUD + validación nombre y color         │
│  ├── TaskModel.ts        ← CRUD + subtareas + posición en kanban    │
│  ├── NoteModel.ts        ← CRUD + búsqueda full-text                │
│  ├── FolderModel.ts      ← CRUD + orphan cleanup de notas           │
│  ├── SearchModel.ts      ← búsqueda global sobre notas y tareas     │
│  ├── SessionModel.ts     ← CRUD + tiempo por tarea + estadísticas   │
│  └── index.ts            ← barrel export                            │
│                                                                     │
│  lib/stats.ts · lib/deadlines.ts  ← lógica pura con tests (Vitest)  │
│  lib/services/                                                      │
│  └── StudyHubSoapService.ts  ← implementación de operaciones SOAP   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ cliente @supabase/supabase-js
┌──────────────────────▼──────────────────────────────────────────────┐
│               CAPA DE DATOS (Supabase / PostgreSQL)                 │
│  RLS activo en todas las tablas: cada usuario accede a sus filas    │
│  Funciones SQL: search_everything() · handle_new_user()             │
└─────────────────────────────────────────────────────────────────────┘
```

| Componente | Implementación | Tecnología |
|---|---|---|
| **Vista** | `components/` — Client Components con `"use client"` | React + react-hook-form |
| **Controlador REST** | `app/api/` — Route Handlers HTTP | Next.js App Router |
| **Controlador SOAP** | `app/api/soap/route.ts` + WSDL | node-soap |
| **Server Actions** | `app/(app)/**/actions.ts` — un módulo por área | Next.js Server Actions |
| **Validación de entrada** | `lib/api/schemas.ts` — un esquema por operación | Zod |
| **Sesión en el borde** | `proxy.ts` — refresca la cookie y redirige | Next.js Proxy (ex *middleware*) |
| **Modelo** | `lib/models/` — clases con responsabilidad única | TypeScript + Supabase JS |
| **Patrón DAO** | Cada Model encapsula todo acceso a su tabla | Clase con métodos CRUD |
| **Lógica pura** | `lib/stats.ts`, `lib/deadlines.ts` — funciones sin I/O | TypeScript + Vitest |

> **Dos caminos de escritura, una sola validación.** Los formularios de la app usan
> Server Actions; los clientes externos usan la API REST. Ambos parsean la entrada con el
> mismo esquema de `lib/api/schemas.ts` y terminan en el mismo modelo, así que endurecer
> una regla la endurece en los dos caminos a la vez.

**Flujo de una petición REST (ejemplo: crear tarea):**

```
1. Cliente HTTP hace POST /api/tasks  con body JSON
2. Route Handler verifica sesión con getAuthContext()
3. parseBody() valida el body con createTaskSchema (Zod)
4. Instancia TaskModel(supabase) y llama a create()
5. TaskModel valida y aplica reglas de negocio
6. Inserta en Supabase; RLS confirma user_id = auth.uid()
7. Handler responde con ok(data) — la tarea creada en JSON
```

**Flujo de una Server Action (ejemplo: crear tarea desde el Kanban):**

```
1. TasksClient llama a createTaskAction(input)
2. parseInput() valida con el mismo createTaskSchema
3. requireUser() resuelve la sesión desde la cookie
4. TaskModel.create() aplica las mismas reglas de negocio
5. revalidatePath() refresca la pantalla
6. Devuelve ActionResult: { ok: true, data } o { ok: false, error }
```

> **Excepción: `createSessionAction`** no llama a `revalidatePath()`. Esa llamada obliga al
> servidor a re-renderizar la página actual y devolverla en la misma respuesta, y hacía que
> "Detener" tardara segundos. El reloj inserta la sesión en las listas desde el cliente y
> refresca el resto en segundo plano (ver [Temporizador](#temporizador-de-estudio)).

**Flujo de una petición SOAP (ejemplo: GetTaskStats):**

```
1. Cliente envía envelope XML al POST /api/soap con su cookie de sesión
2. El handler resuelve el usuario; sin sesión responde soap:Fault 401
3. Lee el WSDL (cacheado en memoria tras la primera lectura)
4. node-soap parsea el envelope y despacha la operación
5. StudyHubSoapService.GetTaskStats() comprueba que el userId del
   envelope coincida con el de la sesión y consulta la tabla tasks
6. El resultado se serializa de vuelta como XML SOAP response
```

---

## Servicios Web — REST y SOAP

StudyHub expone su lógica de negocio a través de dos protocolos complementarios. Ambos comparten los mismos modelos (`lib/models/`) y el mismo mecanismo de autenticación Supabase.

---

### API REST

Base URL: `/api`

Todos los endpoints requieren sesión activa (cookie de Supabase). Responden en `application/json`.

#### Categorías

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/categories` | Lista todas las categorías del usuario autenticado |
| `POST` | `/api/categories` | Crea una nueva categoría |
| `GET` | `/api/categories/:id` | Obtiene una categoría por ID |
| `PATCH` | `/api/categories/:id` | Actualiza nombre o color |
| `DELETE` | `/api/categories/:id` | Elimina (desvincula tareas y sesiones asociadas) |

**POST `/api/categories` — body:**
```json
{ "name": "Cálculo II", "color": "#3b82f6" }
```

#### Tareas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/tasks` | Lista todas las tareas con subtareas y categoría |
| `POST` | `/api/tasks` | Crea una tarea en el cuadrante indicado |
| `GET` | `/api/tasks/:id` | Detalle de una tarea |
| `PATCH` | `/api/tasks/:id` | Actualiza campos (incluye `completed`, `quadrant`, `position`) |
| `DELETE` | `/api/tasks/:id` | Elimina la tarea y sus subtareas |

**POST `/api/tasks` — body:**
```json
{
  "title": "Preparar parcial de Cálculo",
  "quadrant": "urgent_important",
  "deadline": "2026-05-20T23:59:00Z",
  "category_id": "uuid-aqui"
}
```

Valores válidos para `quadrant`: `urgent_important` · `not_urgent_important` · `urgent_not_important` · `not_urgent_not_important`

#### Notas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/notes` | Lista todas las notas (sin `content` completo) |
| `GET` | `/api/notes?q=término` | Búsqueda full-text (español) en título y texto de notas |
| `POST` | `/api/notes` | Crea una nota vacía o con contenido inicial |
| `GET` | `/api/notes/:id` | Nota completa con `content` JSON de Tiptap |
| `PATCH` | `/api/notes/:id` | Actualiza contenido, tags o carpeta |
| `DELETE` | `/api/notes/:id` | Elimina la nota |

#### Carpetas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/folders` | Lista carpetas con contador de notas |
| `POST` | `/api/folders` | Crea una carpeta |
| `GET` | `/api/folders/:id` | Detalle de una carpeta |
| `PATCH` | `/api/folders/:id` | Renombra o cambia color |
| `DELETE` | `/api/folders/:id` | Elimina (mueve notas a Inbox) |

#### Sesiones de estudio

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/sessions` | Historial de sesiones con categoría |
| `POST` | `/api/sessions` | Registra una sesión completada o abandonada |
| `GET` | `/api/sessions/:id` | Una sesión concreta |
| `PATCH` | `/api/sessions/:id` | Corrige una sesión guardada (o solo la califica) |
| `DELETE` | `/api/sessions/:id` | Elimina la sesión del historial y de las estadísticas |

**POST `/api/sessions` — body:**
```json
{
  "duration_minutes": 25,
  "actual_duration_seconds": 1487,
  "mode": "simple",
  "started_at": "2026-05-16T14:00:00Z",
  "completed_at": "2026-05-16T14:24:47Z",
  "category_id": "uuid-aqui",
  "focus_rating": "focused"
}
```

Valores válidos para `mode`: `simple` · `stopwatch` · `pomodoro` · `manual`. La duración *planeada* depende del modo: 10–120 min en `simple`, 5–90 en `pomodoro`, y `null` obligatorio en `stopwatch` y `manual`, que no planean nada.

`focus_rating` es opcional y admite `focused` · `ok` · `distracted`.

`id` (UUID) es opcional y hace **idempotente** el registro: si se envía y ya existe una sesión del usuario con ese id, se devuelve la existente en lugar de crear otra. El temporizador lo genera al arrancar cada tramo, así que un guardado repetido (doble clic, reintento, dos pestañas) nunca duplica la sesión.

`PATCH` acepta cualquier subconjunto de los campos anteriores **salvo `mode`**: cómo se midió el tiempo es un hecho, no una preferencia, y poder reescribirlo dejaría el historial sin forma de distinguir lo cronometrado de lo registrado a mano.

#### Respuestas de error

```json
{ "error": "Descripción del error" }
```

| Código | Causa |
|--------|-------|
| `400` | Validación fallida o regla de negocio violada |
| `401` | Sin sesión activa |
| `404` | Recurso no encontrado o no pertenece al usuario |

---

### API SOAP

El servicio SOAP expone operaciones de **consulta y estadísticas** (solo lectura) reutilizando la misma capa de modelos que el REST. Sigue el protocolo **SOAP 1.1** con estilo `document/literal`.

> **Autenticación.** El `POST /api/soap` **requiere sesión activa**: el usuario se deriva de
> la cookie de Supabase, no del envelope. El elemento `<userId>` que declara el WSDL se sigue
> aceptando por compatibilidad, pero solo si coincide con el usuario de la sesión; si no,
> la operación responde `soap:Fault` con código `Client` (HTTP 403). Sin sesión, HTTP 401.
> El `GET` del WSDL es público, porque un WSDL es un contrato, no un dato.

#### Endpoints

| Método HTTP | Ruta | Descripción |
|-------------|------|-------------|
| `GET` | `/api/soap` | Descarga el WSDL en XML |
| `POST` | `/api/soap` | Procesa un envelope SOAP 1.1 |

**WSDL disponible en:** `/api/soap` (GET) o directamente en `public/studyhub.wsdl`

**Namespace:** `http://studyhub.local/soap`

#### Operación `GetCategories`

Devuelve todas las categorías de un usuario.

**Request:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://studyhub.local/soap">
  <soap:Body>
    <tns:GetCategoriesRequest>
      <userId>uuid-del-usuario</userId>
    </tns:GetCategoriesRequest>
  </soap:Body>
</soap:Envelope>
```

**Response:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCategoriesResponse>
      <categories>
        <category>
          <id>uuid</id>
          <name>Cálculo II</name>
          <color>#3b82f6</color>
          <created_at>2026-05-16T10:00:00Z</created_at>
        </category>
      </categories>
    </GetCategoriesResponse>
  </soap:Body>
</soap:Envelope>
```

#### Operación `GetTaskStats`

Devuelve contadores de tareas por cuadrante Eisenhower.

**Request:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://studyhub.local/soap">
  <soap:Body>
    <tns:GetTaskStatsRequest>
      <userId>uuid-del-usuario</userId>
    </tns:GetTaskStatsRequest>
  </soap:Body>
</soap:Envelope>
```

**Response:**
```xml
<GetTaskStatsResponse>
  <stats>
    <urgentImportant>3</urgentImportant>
    <notUrgentImportant>7</notUrgentImportant>
    <urgentNotImportant>2</urgentNotImportant>
    <notUrgentNotImportant>1</notUrgentNotImportant>
    <totalCompleted>5</totalCompleted>
    <totalPending>8</totalPending>
  </stats>
</GetTaskStatsResponse>
```

#### Operación `GetStudyStats`

Devuelve estadísticas de sesiones de estudio del usuario.

**Request:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://studyhub.local/soap">
  <soap:Body>
    <tns:GetStudyStatsRequest>
      <userId>uuid-del-usuario</userId>
    </tns:GetStudyStatsRequest>
  </soap:Body>
</soap:Envelope>
```

**Response:**
```xml
<GetStudyStatsResponse>
  <stats>
    <totalMinutesThisWeek>340</totalMinutesThisWeek>
    <currentStreak>5</currentStreak>
    <topCategoryThisMonth>Programación</topCategoryThisMonth>
    <dailyAverage>48</dailyAverage>
  </stats>
</GetStudyStatsResponse>
```

#### Errores SOAP

Si ocurre un error, el servicio responde con un `soap:Fault` estándar:

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>userId es obligatorio</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
```

#### Probar el servicio SOAP con cURL

El `POST` necesita la cookie de sesión: cópiala desde las DevTools del navegador
(`Application → Cookies`) y pásala con `-b`. Sin ella la respuesta será un `soap:Fault` 401.

```bash
curl -X POST http://localhost:3000/api/soap \
  -H "Content-Type: text/xml" \
  -b "sb-<ref>-auth-token=<valor-de-la-cookie>" \
  -d '<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://studyhub.local/soap">
  <soap:Body>
    <tns:GetTaskStatsRequest>
      <userId>TU-USER-ID-AQUI</userId>
    </tns:GetTaskStatsRequest>
  </soap:Body>
</soap:Envelope>'
```

---

## Estructura del proyecto

```
studyhub/
├── app/
│   ├── (auth)/                       # Rutas públicas de autenticación
│   │   ├── login/                    # Inicio de sesión
│   │   ├── register/                 # Registro
│   │   ├── forgot-password/          # Solicitud de recuperación por email
│   │   └── reset-password/           # Restablecimiento de contraseña
│   ├── (app)/                        # Rutas protegidas (requieren sesión)
│   │   ├── layout.tsx                # Guard de sesión + Navbar + paleta de comandos
│   │   │                             #   + TimerProvider/TimerIndicator (reloj global)
│   │   ├── loading.tsx               # Esqueleto de carga del área autenticada
│   │   ├── actions.ts                # searchAction — búsqueda global (Ctrl+K)
│   │   ├── dashboard/                # Resumen del día: metas, vencimientos, atajos
│   │   ├── notes/                    # Lista de notas con carpetas y tags
│   │   ├── notes/[noteId]/           # Editor individual de nota (Tiptap)
│   │   ├── tasks/                    # Kanban Eisenhower (page.tsx + actions.ts)
│   │   ├── agenda/                   # Semana de fechas límite
│   │   ├── timer/                    # Temporizador + estadísticas (page.tsx + actions.ts)
│   │   ├── categories/               # CRUD de categorías (page.tsx + actions.ts)
│   │   └── profile/                  # Perfil de usuario (page.tsx + actions.ts)
│   ├── api/                          # ← Capa de servicios web (REST + SOAP)
│   │   ├── categories/               # route.ts · [id]/route.ts
│   │   ├── tasks/                    # route.ts · [id]/route.ts
│   │   ├── notes/                    # route.ts · [id]/route.ts
│   │   ├── folders/                  # route.ts · [id]/route.ts
│   │   ├── sessions/                 # route.ts · [id]/route.ts
│   │   └── soap/route.ts             # GET (WSDL) · POST (envelope)
│   ├── icons/                        # icon-192, icon-512 (PWA) y timer (ventana flotante)
│   ├── screenshots/[variant]/        # Capturas wide/narrow del manifest (PWA)
│   ├── icon.tsx / apple-icon.tsx     # Favicons generados
│   ├── manifest.ts                   # Web App Manifest: iconos, capturas y shortcuts
│   ├── layout.tsx                    # Layout raíz (theme init, fuente, Toaster, SW)
│   ├── loading.tsx                   # Esqueleto de carga de las rutas públicas
│   ├── page.tsx                      # Landing pública
│   └── globals.css                   # Tokens de tema (@theme) + estilos Tiptap
│
├── components/
│   ├── landing/                      # ShowcaseSection, mockups
│   ├── dashboard/                    # TodayStats, DueToday, LocalDate
│   ├── notes/                        # NoteEditor, NotesClient, OfflineNotesCache
│   ├── tasks/                        # TasksClient, KanbanColumn, TaskCard, TaskModal
│   ├── agenda/                       # AgendaClient — vista semanal de fechas límite
│   ├── timer/                        # TimerProvider (motor global), TimerIndicator,
│   │                                 #   TimerClient, MiniTimer, SessionHistory,
│   │                                 #   SessionForm (alta y edición manual),
│   │                                 #   StudyStats, StudyGoals, CategoryBreakdown,
│   │                                 #   StudyHeatmap, StudyPatterns, focusRating
│   ├── categories/                   # CategoriesClient, CategoryForm, CategoryList
│   └── shared/                       # Navbar, CommandPalette, Modal, ConfirmProvider,
│                                     #   ThemeToggle, ProfileClient, InstallPrompt,
│                                     #   ServiceWorkerRegistrar, LocalTimestamp
│
├── hooks/
│   ├── useMediaQuery.ts              # Media query con useSyncExternalStore
│   └── useLocalToday.ts              # Día local del usuario, estable entre renders
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Cliente para Client Components (browser)
│   │   ├── server.ts                 # Cliente para Server Components / Route Handlers
│   │   └── middleware.ts             # updateSession(): refresco de sesión + guard
│   ├── models/                       # ← Capa de Modelos (patrón MVC/DAO)
│   │   ├── BaseModel.ts              # Clase base + ModelError
│   │   ├── CategoryModel.ts          # DAO de categorías: CRUD + reglas de negocio
│   │   ├── TaskModel.ts              # DAO de tareas: CRUD + subtareas + posición kanban
│   │   ├── NoteModel.ts              # DAO de notas: CRUD + búsqueda full-text
│   │   ├── FolderModel.ts            # DAO de carpetas: CRUD + orphan cleanup
│   │   ├── SearchModel.ts            # Búsqueda global sobre notas y tareas
│   │   ├── SessionModel.ts           # DAO de sesiones: CRUD + tiempo por tarea + stats
│   │   └── index.ts                  # Barrel export de modelos y tipos Create/Update
│   ├── services/                     # ← Capa de servicios SOAP
│   │   └── StudyHubSoapService.ts    # GetCategories, GetTaskStats, GetStudyStats
│   ├── api/
│   │   ├── schemas.ts                # Esquemas Zod compartidos (REST + Server Actions)
│   │   ├── helpers.ts                # getAuthContext() · parseBody() · ok() · err()
│   │   └── actions.ts                # requireUser() · parseInput() · ActionResult
│   ├── stats.ts + stats.test.ts      # Métricas de estudio: fuente única, con tests
│   ├── deadlines.ts + .test.ts       # Fechas límite leídas en la zona del usuario
│   ├── offline.ts                    # Copia local de notas para leer sin conexión
│   ├── types.ts                      # Interfaces y tipos TypeScript compartidos
│   └── utils.ts                      # cn() y utilidades
│
├── types/
│   └── node-soap.d.ts                # Declaraciones TypeScript para node-soap
│
├── public/
│   ├── studyhub.wsdl                 # Definición WSDL del servicio SOAP
│   ├── sw.js                         # Service worker (v3): precachea la página offline
│   ├── offline.html                  # Sin conexión: lista los apuntes guardados
│   ├── icons/                        # icon-192.png, icon-512.png
│   └── sounds/
│       └── bell.wav                  # Sonido de notificación del temporizador
│
├── scripts/
│   ├── generate-icons.mjs            # Genera los PNG de iconos de la PWA
│   └── verify-app.mjs                # Recorrido de humo con Playwright + capturas
│
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql                   # Esquema completo de la base de datos
│       ├── 002_categories_constraints.sql    # Constraints y RLS granular en categories
│       ├── 003_user_goals.sql                # Metas diaria/semanal en profiles
│       ├── 004_stopwatch_mode.sql            # Modo stopwatch en study_sessions
│       ├── 005_data_integrity.sql            # Defaults de user_id, RLS con WITH CHECK
│       ├── 006_task_sessions.sql             # study_sessions.task_id + política cruzada
│       ├── 007_global_search.sql             # search_everything() + índice de tareas
│       ├── 008_onboarding.sql                # Siembra de la cuenta nueva (trigger)
│       └── 009_study_insights.sql            # Estimación, calidad de sesión y Pomodoro
│
├── markdown/Context.md         # Documento de contexto de la aplicación
├── proxy.ts                    # Refresco de sesión en el borde (matcher explícito)
├── vitest.config.mts           # Configuración de las pruebas (zona horaria fija)
├── .env.example                # Plantilla de variables de entorno
└── next.config.ts              # Configuración de Next.js
```

> **Nota sobre el guard de rutas.** Es doble y deliberado. `proxy.ts` —el *middleware* de
> Next.js, renombrado en la versión 16— refresca la cookie de sesión y redirige, pero solo
> en las rutas de su `matcher`: cada request que intercepta hace una llamada de red a
> Supabase, y no tiene sentido pagarla en la landing estática, el manifest, los iconos, el
> service worker ni en `/api`. La comprobación que de verdad protege los datos vive en
> `app/(app)/layout.tsx` (Server Component) y en las políticas RLS; las rutas `/api`
> resuelven la sesión por su cuenta con `getAuthContext()`.
>
> Tampoco hay `tailwind.config.ts`: Tailwind v4 se configura con `@theme` en `globals.css`.

---

## Módulos

### Notas

Permite crear, editar y organizar notas con formato enriquecido.

**Funcionalidades:**
- Editor Tiptap con toolbar completa: negrita, cursiva, encabezados H1–H3, código en línea, bloques de código con resaltado (lowlight), listas ordenadas/desordenadas, checklists (TaskList), enlaces e imágenes.
- Organización en **carpetas** con contador de notas por carpeta (notas sin carpeta = "Inbox").
- Sistema de **tags** con filtro por chip seleccionable.
- **Búsqueda full-text en español** resuelta en el servidor: `NoteModel.search()` llama a la función `search_everything` (migración 007), que usa el índice GIN sobre título y texto plano. Antes se filtraba en memoria sobre las notas ya descargadas.
- **Autoguardado** con debounce (sin botón de guardar explícito) e indicador Guardado/Guardando.
- Subida de imágenes directamente a **Supabase Storage** (bucket `notes-images`).
- Copia local de las últimas notas para **leerlas sin conexión** (`OfflineNotesCache`).

---

### Tareas — Matriz de Eisenhower

Organiza tareas según urgencia e importancia en un tablero Kanban de 4 cuadrantes.

| Cuadrante | Criterio | Acción |
|-----------|----------|--------|
| Hacer ahora | Urgente + Importante | Ejecutar inmediatamente |
| Planificar | No urgente + Importante | Agendar |
| Delegar | Urgente + No importante | Asignar a otro |
| Eliminar | No urgente + No importante | Descartar |

**Funcionalidades:**
- **Drag & drop** entre columnas con @dnd-kit (actualiza `quadrant` y `position`).
- **Modal de detalle** con subtareas anidadas, fecha límite (deadline) y categoría (creable inline).
- **Tiempo dedicado** por tarea en la propia tarjeta, agregado desde las sesiones de estudio ligadas a ella (`SessionModel.studiedSecondsByTask()`).
- Filtro por categoría y toggle para mostrar/ocultar tareas completadas.
- **Actualizaciones optimistas** para experiencia fluida sin esperar respuesta del servidor.
- Mutaciones vía Server Actions (`tasks/actions.ts`), validadas con los mismos esquemas Zod que la API REST.

---

### Agenda — fechas límite

Vista semanal de las tareas que tienen `deadline`. La matriz de Eisenhower responde «qué es
importante»; la agenda responde «qué me cae encima esta semana», que era la pregunta que
obligaba a mantener un calendario aparte.

**Funcionalidades:**
- Rejilla de lunes a domingo con navegación entre semanas, instantánea: las tareas con fecha se traen una vez y la semana la calcula el cliente.
- Las tareas se agrupan por su **día natural en la zona horaria del usuario**. `tasks.deadline` es un `timestamptz` que guarda la medianoche UTC del día elegido en el `<input type="date">`; leerlo con los getters locales adelantaba un día todas las fechas al oeste de Greenwich. `lib/deadlines.ts` centraliza esa lectura.
- Marcado de **vencidas** y color de borde por cuadrante, igual que en el Kanban.
- Completar una tarea desde la propia agenda.

---

### Temporizador de estudio

Registra sesiones de estudio con estadísticas para seguimiento del hábito.

**Modos:**
- **Simple:** cuenta regresiva de duración libre de 10 a 120 minutos.
- **Stopwatch:** cronómetro ascendente sin límite fijo.
- **Pomodoro:** bloques de foco y descansos con duraciones configurables en el perfil (migración 009).

**Funcionalidades:**
- **Reloj global:** el motor vive en `TimerProvider`, montado en el layout del área autenticada, así que la sesión sigue corriendo y se guarda al terminar aunque se navegue por notas, tareas o la agenda. Fuera de `/timer`, `TimerIndicator` muestra el reloj con sus controles.
- **Ventana flotante** (`MiniTimer`, Document Picture-in-Picture, Chrome/Edge 116+): reloj siempre visible encima de otras aplicaciones, con pausar/detener e icono propio. Es un `createPortal` del mismo árbol de React, así que refleja cada clic en el mismo render.
- **Controles instantáneos y a prueba de repeticiones:** pausar, detener o iniciar cambia el estado en el acto. El guardado va después y en segundo plano, y los clics repetidos se ignoran. Detener ocho veces seguidas registra una sola sesión.
- **Fiable en segundo plano:** un Web Lock evita que Edge duerma la pestaña con el reloj en marcha, y el latido sale de un Worker, que no sufre el recorte de temporizadores de las pestañas ocultas. Con varias pestañas abiertas, el estado se sincroniza entre ellas.
- **Sesión ligada a una tarea concreta** (migración 006): el selector lista las tareas pendientes y hereda su categoría. Es lo que conecta el temporizador con el Kanban en las dos direcciones — elegir sobre qué se estudia, y ver después cuánto se le dedicó.
- Estado del timer persistido en `localStorage` para sobrevivir recargas; el tiempo se calcula por timestamps (no por contadores) para funcionar en segundo plano.
- **Notificaciones sonoras** (`public/sounds/bell.wav`) y **Web Notifications API** al completar.
- **Historial** de sesiones con filtros (fecha, duración, categoría) y la tarea asociada.
- **Estadísticas**: minutos por día (gráfica de barras, Recharts), **tabla de tiempo por categoría** ordenable y filtrable por día / semana / mes con comparativa contra el periodo anterior, **mapa de calor de constancia** (desde tu primera sesión, con un techo de un año), **franja horaria favorita** y **calidad percibida** de las sesiones, racha actual, categoría top del mes y promedio diario.
- **Registro manual** de sesiones estudiadas sin la app, y **edición o borrado** de cualquier sesión del historial.
- **Pomodoro configurable** (foco, descanso, descanso largo y bloques por tanda). Las fases no se encadenan solas: al terminar un bloque, el usuario elige si iniciar el descanso o pasar al siguiente bloque. Cada bloque de foco se guarda como su propia sesión.
- **Estimación por tarea** contrastada con el tiempo realmente dedicado, en el Kanban y en el propio temporizador.
- **Metas** diaria y semanal más los ajustes del Pomodoro (`StudyGoals`), guardados en `profiles` (`daily_goal_minutes`, `weekly_goal_minutes`, `pomodoro_*`).

> Todas las métricas salen de `lib/stats.ts`, que es la única implementación. Suman
> `actual_duration_seconds` —lo realmente estudiado— y no `duration_minutes` —lo planeado—, y
> agrupan los días por la fecha local del usuario y no por la UTC del timestamp.

---

### Búsqueda global y paleta de comandos

`Ctrl+K` (o `⌘K`) abre una paleta que busca **notas y tareas a la vez** y ofrece atajos de
navegación a cada sección. Está montada en el layout del área autenticada, así que se abre
desde cualquier pantalla.

- El término viaja a `searchAction` (Server Action), que valida y delega en la función SQL `search_everything`.
- **Full-text en español con prefijo:** escribir «cálc» encuentra «Cálculo» mientras se teclea. El término se pasa como parámetro y se sanea en `studyhub_prefix_tsquery`, así que un paréntesis o un `&` no rompen la consulta.
- Navegación completa con teclado (flechas y Enter); las tareas completadas quedan fuera de los resultados.
- La función es `SECURITY INVOKER`: son las políticas RLS de `notes` y `tasks` las que acotan los resultados al usuario, no un filtro en el código.

---

### Dashboard

Resumen del día al entrar: progreso frente a la meta diaria y racha (`TodayStats`), tareas
que vencen hoy o están vencidas (`DueToday`), lo urgente e importante pendiente, las últimas
notas y accesos directos para empezar a estudiar.

---

### Categorías

CRUD de materias/áreas compartidas entre tareas y sesiones (listar, crear, renombrar, recolorear, eliminar). Constraints de unicidad, longitud y color hex a nivel de base de datos. Mutaciones vía Server Actions (`actions.ts`) y/o API REST.

---

### PWA y modo sin conexión

- **Instalable:** manifest con iconos, capturas para los dos factores de forma (`app/screenshots/[variant]`) y accesos directos. `InstallPrompt` captura `beforeinstallprompt` y ofrece la instalación desde la interfaz, en lugar de dejarla escondida en el menú del navegador.
- **Service worker** (`public/sw.js`, caché `studyhub-v3`): precachea la página de respaldo y la sirve cuando falla una navegación. El HTML de las rutas autenticadas **no se cachea a propósito** — depende de la sesión y servirlo de caché podría mostrar datos de otra cuenta.
- **Apuntes sin conexión:** `lib/offline.ts` guarda en el navegador hasta 50 notas recientes (8000 caracteres cada una) y `public/offline.html` —HTML estático— las lista y las deja leer. La copia se marca con el id del usuario y se borra al cerrar sesión.

---

### Cuenta nueva

Una cuenta recién registrada ya no arranca vacía. El trigger `handle_new_user` (migración
008), además de crear el perfil, siembra tres categorías (`General`, `Lecturas`, `Exámenes`)
y una nota de bienvenida que explica la matriz de Eisenhower y el atajo `Ctrl+K`.

El sembrado va dentro de un bloque con su propio `EXCEPTION`: corre en la transacción del
registro, y una bienvenida que falla es un inconveniente, pero un registro que falla no. Las
cuentas existentes no se tocan.

---

## Instalación

### Requisitos previos

- Node.js 20 o superior
- Cuenta en [supabase.com](https://supabase.com) (plan gratuito suficiente)

### Pasos

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd studyhub

# 2. Instalar dependencias (incluye node-soap para el servicio SOAP)
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales de Supabase (ver sección siguiente)

# 4. Ejecutar migraciones en Supabase (en orden, sin saltarse ninguna)
# Ir a supabase.com → SQL Editor → pegar y ejecutar en secuencia:
# supabase/migrations/001_initial.sql
# supabase/migrations/002_categories_constraints.sql
# supabase/migrations/003_user_goals.sql
# supabase/migrations/004_stopwatch_mode.sql
# supabase/migrations/005_data_integrity.sql
# supabase/migrations/006_task_sessions.sql
# supabase/migrations/007_global_search.sql
# supabase/migrations/008_onboarding.sql
# supabase/migrations/009_study_insights.sql

# 5. Iniciar el servidor de desarrollo
npm run dev
```

> El orden importa: cada migración asume el estado que deja la anterior. Quedarse en la 004
> deja una base que arranca pero en la que fallan la búsqueda global, el temporizador ligado
> a tareas y la siembra de las cuentas nuevas.

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

**Verificar la API REST:**
```bash
# Requiere sesión activa (cookie); útil para pruebas desde el servidor
curl http://localhost:3000/api/categories
```

**Verificar el servicio SOAP:**
```bash
# Descargar el WSDL
curl http://localhost:3000/api/soap
```

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar los valores:

```env
# URL pública del proyecto Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave anónima pública (segura para el cliente)
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Clave de servicio (solo en servidor, nunca expuesta al cliente)
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

Las claves se encuentran en el dashboard de Supabase en **Settings → API**.

> **Importante:** `.env.local` está en `.gitignore` y nunca debe subirse al repositorio.

---

## Base de datos

El esquema se construye en **nueve migraciones** ejecutadas en orden. Todas las tablas tienen
**Row Level Security (RLS)** activado: cada usuario solo puede leer y escribir sus propios
registros.

### `001_initial.sql` — Esquema base

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil extendido del usuario (creado por trigger `handle_new_user`) |
| `categories` | Categorías personalizadas con color y nombre |
| `folders` | Carpetas para organizar notas |
| `notes` | Notas con contenido JSON (Tiptap), texto plano para búsqueda, carpeta y tags |
| `tasks` | Tareas con cuadrante Eisenhower, deadline, posición y estado |
| `subtasks` | Subtareas anidadas dentro de una tarea |
| `study_sessions` | Sesiones de estudio con duración, modo y categoría |

Incluye el índice full-text español `notes_search_idx` (GIN) y el bucket de Storage `notes-images`.

### `002_categories_constraints.sql` — Integridad y RLS granular

Refuerza la tabla `categories`, alineado con las reglas que aplica `CategoryModel` en código:

| Constraint | Tipo | Regla |
|---|---|---|
| `categories_user_name_unique` | UNIQUE | Un usuario no puede tener dos categorías con el mismo nombre |
| `categories_name_not_empty` | CHECK | `length(trim(name)) >= 2` |
| `categories_color_hex` | CHECK | El color debe coincidir con `^#[0-9a-fA-F]{6}$` |

Reemplaza las políticas RLS por cuatro políticas granulares (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) para control fino por operación.

### `003_user_goals.sql` — Metas de estudio

Agrega a `profiles` las columnas `daily_goal_minutes` (default 60, CHECK 5–480) y `weekly_goal_minutes` (default 300, CHECK 30–2400).

### `004_stopwatch_mode.sql` — Modo cronómetro

Amplía el enum `study_mode` para incluir `stopwatch` junto a `simple` y `pomodoro` (legado).

### `005_data_integrity.sql` — Integridad de datos

- **`user_id` por defecto:** `ALTER COLUMN user_id SET DEFAULT auth.uid()` en las cinco tablas de usuario. Las inserciones desde el cliente no envían `user_id` y la columna es `NOT NULL`; declararlo aquí hace que un despliegue limpio quede igual que producción. En una conexión sin JWT `auth.uid()` es `NULL` y el `NOT NULL` sigue protegiendo la tabla.
- **RLS con `WITH CHECK` explícito** en `folders`, `notes`, `tasks` y `study_sessions`, extendiendo a todas las tablas el criterio que la 002 aplicó a `categories`. `FOR ALL USING (…)` funcionaba, pero dejaba la política de escritura sin declarar.
- **Rango de duración corregido:** el CHECK de `duration_minutes` pasa de 1–120 a 1–1440 (y admite `NULL`), que es lo que hace realmente guardable una sesión larga de cronómetro. `actual_duration_seconds >= 0`.
- Índice parcial `sessions_completed_idx (user_id, started_at DESC) WHERE completed_at IS NOT NULL`, que es como consultan todas las estadísticas.

### `006_task_sessions.sql` — Sesiones ligadas a tareas

Añade `study_sessions.task_id` con `ON DELETE SET NULL` —borrar una tarea no borra el
historial de estudio— y el índice parcial `sessions_task_idx`.

La política de `INSERT`/`UPDATE` comprueba además que la tarea referenciada **pertenezca al
mismo usuario**: RLS ya impide leer o escribir filas ajenas, pero no impedía por sí sola que
una sesión propia apuntara al id de la tarea de otra persona.

### `007_global_search.sql` — Búsqueda global

- Índice GIN `tasks_search_idx` sobre `title || coalesce(description, '')`, el equivalente para tareas del que ya existía para notas.
- `studyhub_prefix_tsquery(text)`: convierte texto libre en una `tsquery` con prefijo (`palabra:*`). `plainto_tsquery` no hace prefijo y `to_tsquery` revienta con un paréntesis del usuario; esta función se queda solo con las palabras y devuelve una consulta vacía en lugar de fallar.
- `search_everything(q, max_results)`: `UNION ALL` de notas y tareas pendientes ordenado por `ts_rank`. Es `SECURITY INVOKER`, así que corre con los permisos del usuario y son las políticas RLS las que acotan el resultado.

### `008_onboarding.sql` — Cuenta nueva sembrada

Reescribe `handle_new_user` para que, además de crear el perfil, inserte tres categorías de
arranque y una nota de bienvenida. El sembrado va en un bloque `EXCEPTION` propio: corre
dentro de la transacción de registro y no debe poder impedir la creación de la cuenta. Las
cuentas ya existentes no se modifican (la migración deja el SQL comentado por si se quiere
sembrar una cuenta de pruebas a mano).

### `009_study_insights.sql` — Estimación, calidad de sesión y Pomodoro

- `tasks.estimated_minutes` (nullable, CHECK 5–6000): el tiempo dedicado a una tarea ya se
  medía desde la 006, pero no había contra qué compararlo. Sin estimación es un dato sin
  veredicto: no distingue «me cundió» de «se me fue el doble».
- `study_sessions.focus_rating` (nullable, `focused`/`ok`/`distracted`): dos sesiones de 50
  minutos no valen lo mismo. Es texto con CHECK y no un enum nuevo porque son tres valores
  de producto, y ampliar un enum obliga a un `ALTER TYPE` irreversible.
- `profiles.pomodoro_*`: el modo Pomodoro estaba retirado de la interfaz porque sus tiempos
  eran constantes en el cliente. Con la configuración en el perfil vuelve a ser un modo real.
- `study_mode += 'manual'`: hasta ahora una sesión estudiada sin la app solo se podía dar de
  alta mintiendo sobre el modo, y el historial no podía distinguir lo cronometrado de lo
  recordado.

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo (`next dev`) |
| `npm run build` | Build optimizado de producción (`next build`) |
| `npm start` | Servidor de producción (requiere build previo) |
| `npm run lint` | Análisis estático con ESLint |
| `npm test` | Ejecuta la suite de pruebas una vez (`vitest run`) |
| `npm run test:watch` | Pruebas en modo watch durante el desarrollo |

Además, en `scripts/` hay dos utilidades que no forman parte del ciclo normal:
`generate-icons.mjs` regenera los PNG de la PWA y `verify-app.mjs` hace un recorrido de humo
con Playwright sobre la app en `localhost:3000` y guarda capturas en `.screenshots/`.

---

## Pruebas

Las pruebas cubren la **lógica pura** del proyecto: los dos módulos donde un error es
silencioso y no lo revela ninguna pantalla en blanco.

| Archivo | Qué protege |
|---|---|
| `lib/stats.test.ts` | Métricas de estudio: minutos por día, racha, promedio, totales por categoría |
| `lib/deadlines.test.ts` | Lectura de fechas límite: vencida, hoy, mañana, próxima |

Ambos casos tienen la misma raíz —mezclar zonas horarias— con el signo cambiado: una sesión
de estudio es un instante real que hay que **agrupar en la zona local**, mientras que una
fecha límite es un día de calendario guardado como medianoche UTC que hay que **leer en UTC**.
Por eso `vitest.config.mts` fija `TZ: 'America/Bogota'`: con la zona en UTC los tests pasarían
sin detectar ninguna de las dos regresiones.

```bash
npm test
```

---

## Seguridad

- **RLS en todas las tablas:** los usuarios solo acceden a sus propios datos, incluso con la clave anónima. Desde la migración 005 las políticas son granulares por operación y declaran `WITH CHECK` explícito, en lugar de apoyarse en que Postgres reutilice la expresión de `USING`.
- **Sin secretos en el código:** todas las credenciales se leen desde variables de entorno.
- **Autenticación en Route Handlers:** cada endpoint REST verifica la sesión con `getAuthContext()` antes de instanciar cualquier modelo.
- **Autenticación en Server Actions:** cada acción llama a `requireUser()` antes de tocar un modelo. Ser una Server Action no la hace privada: es un endpoint HTTP como cualquier otro.
- **Validación con Zod en un solo sitio:** `lib/api/schemas.ts` alimenta los formularios, los route handlers y las Server Actions. Antes los handlers hacían `model.create(await req.json())` con el body sin filtrar mientras el formulario sí validaba, así que cliente y servidor aceptaban cosas distintas.
- **`SUPABASE_SERVICE_ROLE_KEY`** solo se usa en Server Components y API Routes; nunca se envía al navegador.
- **Guard de rutas en dos capas:** `proxy.ts` refresca la cookie y redirige en las rutas de su `matcher`; `app/(app)/layout.tsx` obtiene el usuario y redirige a `/login` si no hay sesión. El límite real lo ponen las políticas RLS, no la redirección.
- **SOAP autenticado:** el `POST /api/soap` exige sesión y deriva el usuario de la cookie. El `userId` del envelope solo se acepta si coincide con el de la sesión; si no, `soap:Fault`. Los mensajes de error del servicio se devuelven, pero los de Postgres solo se registran en el servidor, porque describen el esquema.
- **Búsqueda con la entrada como parámetro:** el término de búsqueda llega a `search_everything` como argumento y se sanea en SQL, no se interpola en la consulta. La función es `SECURITY INVOKER`, así que sigue sujeta a RLS.
- **Caché offline acotada:** la copia local de notas se marca con el id del usuario —la de otra cuenta se ignora y se borra— y se limpia al cerrar sesión. El HTML de las rutas autenticadas no se guarda en el service worker.

---

## Deploy

### Vercel (recomendado)

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Agregar las tres variables de entorno en **Settings → Environment Variables**.
3. El deploy ocurre automáticamente en cada push a `main`.

### Consideraciones post-deploy

- Agregar el dominio de Vercel en Supabase: **Authentication → URL Configuration → Site URL** (necesario para los enlaces de recuperación de contraseña).
- Ejecutar en el proyecto de producción **las nueve migraciones** en orden. Sin la 007 la paleta de comandos falla al llamar a `search_everything`.
- Verificar que las políticas RLS estén activas desde el dashboard de Supabase.
- Actualizar la URL del servicio SOAP en `public/studyhub.wsdl` (elemento `<soap:address location="..."/>`), que apunta a `http://localhost:3000/api/soap`.

---

## Limitaciones y trabajo futuro

| Limitación | Estado |
|-----------|--------|
| Modo oscuro | ✅ Implementado (claro/oscuro con `data-theme`) |
| Soporte PWA (instalable, service worker) | ✅ Implementado |
| Recuperación de contraseña por email | ✅ Implementado |
| Metas de estudio diaria/semanal | ✅ Implementado |
| Búsqueda global de notas y tareas (`Ctrl+K`) | ✅ Implementado |
| Agenda de fechas límite | ✅ Implementado |
| Sesiones de estudio ligadas a una tarea | ✅ Implementado |
| Autenticación por sesión en el servicio SOAP | ✅ Implementado |
| Pruebas automatizadas de la lógica de estadísticas y fechas | ✅ Implementado (Vitest) |
| Lectura de apuntes sin conexión | 🟡 Parcial — se guardan las 50 notas más recientes; no hay escritura offline |
| Sincronización offline (escribir sin conexión y resolver conflictos) | No implementado |
| Exportación de notas a PDF / Markdown | No implementado |
| Compartir notas entre usuarios | No implementado |
| WS-Security en el servicio SOAP | No implementado (la autenticación es por cookie de sesión) |
| Operaciones de escritura vía SOAP (crear/actualizar) | No implementado |
| Documentación interactiva de la API REST (OpenAPI/Swagger) | No implementado |
| Pruebas de integración / end-to-end | No implementado (`scripts/verify-app.mjs` es solo un recorrido de humo manual) |