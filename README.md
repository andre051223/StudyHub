# StudyHub

> Plataforma web full-stack para estudiantes y autodidactas que centraliza tres herramientas del flujo de estudio diario: notas con editor enriquecido, gestión de tareas en la Matriz de Eisenhower y temporizador de estudio con estadísticas.

La app está en español, su color de marca es el verde `#67b31f`, e incluye modo claro/oscuro y capacidades PWA (instalable, service worker).

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
11. [Seguridad](#seguridad)
12. [Deploy](#deploy)
13. [Limitaciones y trabajo futuro](#limitaciones-y-trabajo-futuro)

---

## Descripción general

StudyHub es una aplicación web construida con **Next.js 16** y **Supabase** que integra en una sola plataforma las herramientas que un estudiante necesita en su día a día:

- **Notas** con editor de texto enriquecido (Tiptap), organización en carpetas, sistema de etiquetas y búsqueda full-text en español.
- **Tareas** organizadas en la Matriz de Eisenhower con tablero Kanban de 4 cuadrantes y drag & drop.
- **Temporizador** de estudio en modo simple (cuenta regresiva) o cronómetro (stopwatch), con historial de sesiones, estadísticas visuales y metas diarias/semanales.

Se apoya en un **dashboard** de resumen, **categorías/materias** compartidas entre tareas y sesiones, **modo claro/oscuro**, y capacidades **PWA**. Todo con autenticación segura, datos aislados por usuario mediante Row Level Security, diseño responsivo y una capa completa de servicios web **REST** y **SOAP** que expone la lógica de negocio como API consumible desde cualquier cliente.

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
| Utilidades CSS | clsx + tailwind-merge | — | Helper `cn()` en `lib/utils.ts` |

---

## Arquitectura

### Patrón MVC con capa de servicios web

StudyHub implementa el patrón **Modelo — Vista — Controlador** aprovechando las primitivas de Next.js App Router, y extiende la arquitectura con una capa de **API REST** y un **servicio SOAP** que expone los mismos modelos de negocio:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VISTA (View)                               │
│  components/  — Client Components React con "use client"            │
│  ├── tasks/TasksClient.tsx   ← tablero Kanban Eisenhower            │
│  ├── notes/NotesClient.tsx   ← lista de notas con filtros           │
│  ├── timer/TimerClient.tsx   ← temporizador (simple / stopwatch)   │
│  └── categories/CategoriesClient.tsx  ← CRUD de categorías        │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ fetch a /api/* (REST) o Server Actions
                       │ / cliente Supabase (browser) para auth e imágenes
┌──────────────────────▼──────────────────────────────────────────────┐
│               CONTROLADOR / API LAYER (Controller)                  │
│                                                                     │
│  app/api/  — Route Handlers Next.js (REST)                          │
│  ├── categories/route.ts       GET · POST                           │
│  ├── categories/[id]/route.ts  GET · PATCH · DELETE                 │
│  ├── tasks/route.ts            GET · POST                           │
│  ├── tasks/[id]/route.ts       GET · PATCH · DELETE                 │
│  ├── notes/route.ts            GET · POST  (soporta ?q= búsqueda)  │
│  ├── notes/[id]/route.ts       GET · PATCH · DELETE                 │
│  ├── folders/route.ts          GET · POST                           │
│  ├── folders/[id]/route.ts     GET · PATCH · DELETE                 │
│  ├── sessions/route.ts         GET · POST                           │
│  └── soap/route.ts             GET (WSDL) · POST (envelope XML)     │
│                                                                     │
│  app/(app)/categories/actions.ts  — Server Actions de categorías  │
│  lib/api/helpers.ts  — getAuthContext() · ok() · err()             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ instancia y llama métodos
┌──────────────────────▼──────────────────────────────────────────────┐
│                     MODELO (Model / DAO)                            │
│  lib/models/                                                        │
│  ├── BaseModel.ts        ← clase base + ModelError                  │
│  ├── CategoryModel.ts    ← CRUD + validación nombre y color         │
│  ├── TaskModel.ts        ← CRUD + subtareas + posición en kanban    │
│  ├── NoteModel.ts        ← CRUD + búsqueda full-text               │
│  ├── FolderModel.ts      ← CRUD + orphan cleanup de notas           │
│  ├── SessionModel.ts     ← CRUD + cálculo de racha y estadísticas   │
│  └── index.ts            ← barrel export                           │
│                                                                     │
│  lib/services/                                                      │
│  └── StudyHubSoapService.ts  ← implementación de operaciones SOAP  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ cliente @supabase/supabase-js
┌──────────────────────▼──────────────────────────────────────────────┐
│               CAPA DE DATOS (Supabase / PostgreSQL)                 │
│  RLS activo en todas las tablas: cada usuario accede a sus filas    │
└─────────────────────────────────────────────────────────────────────┘
```

| Componente | Implementación | Tecnología |
|---|---|---|
| **Vista** | `components/` — Client Components con `"use client"` | React + react-hook-form |
| **Controlador REST** | `app/api/` — Route Handlers HTTP | Next.js App Router |
| **Controlador SOAP** | `app/api/soap/route.ts` + WSDL | node-soap |
| **Server Actions** | `app/(app)/categories/actions.ts` | Next.js Server Actions |
| **Modelo** | `lib/models/` — clases con responsabilidad única | TypeScript + Supabase JS |
| **Patrón DAO** | Cada Model encapsula todo acceso a su tabla | Clase con métodos CRUD |

**Flujo de una petición REST (ejemplo: crear tarea):**

```
1. Cliente HTTP hace POST /api/tasks  con body JSON
2. Route Handler verifica sesión con getAuthContext()
3. Handler valida el body con Zod e instancia TaskModel(supabase)
4. TaskModel.create() valida y aplica reglas de negocio
5. Inserta en Supabase; RLS confirma user_id = auth.uid()
6. Handler responde con ok(data) — la tarea creada en JSON
```

**Flujo de una petición SOAP (ejemplo: GetTaskStats):**

```
1. Cliente envía envelope XML al POST /api/soap
2. Route Handler lee el WSDL desde public/studyhub.wsdl
3. node-soap parsea el envelope y despacha la operación
4. StudyHubSoapService.GetTaskStats() consulta la tabla tasks
5. El resultado se serializa de vuelta como XML SOAP response
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

**POST `/api/sessions` — body:**
```json
{
  "duration_minutes": 25,
  "actual_duration_seconds": 1487,
  "mode": "simple",
  "started_at": "2026-05-16T14:00:00Z",
  "completed_at": "2026-05-16T14:24:47Z",
  "category_id": "uuid-aqui"
}
```

Valores válidos para `mode`: `simple` · `stopwatch` (`pomodoro` se conserva solo por compatibilidad con sesiones antiguas).

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

```bash
curl -X POST http://localhost:3000/api/soap \
  -H "Content-Type: text/xml" \
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
│   │   ├── layout.tsx                # Guard de sesión (redirect a /login) + Navbar
│   │   ├── dashboard/                # Resumen: notas, tareas y sesiones
│   │   ├── notes/                    # Lista de notas con carpetas y tags
│   │   ├── notes/[noteId]/           # Editor individual de nota (Tiptap)
│   │   ├── tasks/                    # Kanban Eisenhower con drag & drop
│   │   ├── timer/                    # Temporizador + historial + estadísticas + metas
│   │   ├── categories/              # CRUD de categorías (page.tsx + actions.ts)
│   │   └── profile/                  # Perfil de usuario
│   ├── api/                          # ← Capa de servicios web (REST + SOAP)
│   │   ├── categories/               # route.ts · [id]/route.ts
│   │   ├── tasks/                    # route.ts · [id]/route.ts
│   │   ├── notes/                    # route.ts · [id]/route.ts
│   │   ├── folders/                  # route.ts · [id]/route.ts
│   │   ├── sessions/route.ts         # GET · POST
│   │   └── soap/route.ts             # GET (WSDL) · POST (envelope)
│   ├── icons/                        # icon-192, icon-512 (rutas dinámicas PWA)
│   ├── icon.tsx / apple-icon.tsx     # Favicons generados
│   ├── manifest.ts                   # Web App Manifest (PWA)
│   ├── layout.tsx                    # Layout raíz (theme init, fuente, Toaster, SW)
│   ├── page.tsx                      # Landing pública
│   └── globals.css                   # Tokens de tema (@theme) + estilos Tiptap
│
├── components/
│   ├── landing/                      # ShowcaseSection, mockups
│   ├── notes/                        # NoteEditor, NotesClient
│   ├── tasks/                        # TasksClient, KanbanColumn, TaskCard, TaskModal
│   ├── timer/                        # TimerClient, MiniTimer, SessionHistory, StudyStats, StudyGoals
│   ├── categories/                   # CategoriesClient, CategoryForm, CategoryList
│   └── shared/                       # Navbar, ThemeToggle, ProfileClient, ServiceWorkerRegistrar
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Cliente para Client Components (browser)
│   │   ├── server.ts                 # Cliente para Server Components / Route Handlers
│   │   └── middleware.ts             # updateSession(): refresco de sesión + guard de rutas
│   ├── models/                       # ← Capa de Modelos (patrón MVC/DAO)
│   │   ├── BaseModel.ts              # Clase base + ModelError
│   │   ├── CategoryModel.ts          # DAO de categorías: CRUD + reglas de negocio
│   │   ├── TaskModel.ts              # DAO de tareas: CRUD + subtareas + posición kanban
│   │   ├── NoteModel.ts              # DAO de notas: CRUD + búsqueda full-text
│   │   ├── FolderModel.ts            # DAO de carpetas: CRUD + orphan cleanup
│   │   ├── SessionModel.ts           # DAO de sesiones: CRUD + racha y estadísticas
│   │   └── index.ts                  # Barrel export de modelos y tipos Create/Update
│   ├── services/                     # ← Capa de servicios SOAP
│   │   └── StudyHubSoapService.ts    # GetCategories, GetTaskStats, GetStudyStats
│   ├── api/
│   │   └── helpers.ts                # getAuthContext() · ok() · err()
│   ├── types.ts                      # Interfaces y tipos TypeScript compartidos
│   └── utils.ts                      # cn() y utilidades
│
├── types/
│   └── node-soap.d.ts                # Declaraciones TypeScript para node-soap
│
├── public/
│   ├── studyhub.wsdl                 # Definición WSDL del servicio SOAP
│   └── sounds/
│       └── bell.wav                  # Sonido de notificación del temporizador
│
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql                   # Esquema completo de la base de datos
│       ├── 002_categories_constraints.sql    # Constraints y RLS granular en categories
│       ├── 003_user_goals.sql                # Metas diaria/semanal en profiles
│       └── 004_stopwatch_mode.sql            # Modo stopwatch en study_sessions
│
├── .env.example                # Plantilla de variables de entorno
└── next.config.ts              # Configuración de Next.js
```

> **Nota:** no hay `middleware.ts` en la raíz ni `tailwind.config.ts`. El guard de rutas
> efectivo se realiza en el Server Component `app/(app)/layout.tsx`; el helper
> `lib/supabase/middleware.ts` (`updateSession`) implementa refresco de sesión + guard y
> queda disponible para cablearse en un `middleware.ts` raíz si se necesita.

---

## Módulos

### Notas

Permite crear, editar y organizar notas con formato enriquecido.

**Funcionalidades:**
- Editor Tiptap con toolbar completa: negrita, cursiva, encabezados H1–H3, código en línea, bloques de código con resaltado (lowlight), listas ordenadas/desordenadas, checklists (TaskList), enlaces e imágenes.
- Organización en **carpetas** con contador de notas por carpeta (notas sin carpeta = "Inbox").
- Sistema de **tags** con filtro por chip seleccionable.
- **Búsqueda full-text en español** sobre título y texto plano de la nota (`content_text`).
- **Autoguardado** con debounce (sin botón de guardar explícito) e indicador Guardado/Guardando.
- Subida de imágenes directamente a **Supabase Storage** (bucket `notes-images`).

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
- Filtro por categoría y toggle para mostrar/ocultar tareas completadas.
- **Actualizaciones optimistas** para experiencia fluida sin esperar respuesta del servidor.

---

### Temporizador de estudio

Registra sesiones de estudio con estadísticas para seguimiento del hábito.

**Modos:**
- **Simple:** cuenta regresiva de duración libre de 10 a 120 minutos.
- **Stopwatch:** cronómetro ascendente sin límite fijo.

> El modo **pomodoro** es legado: ya no es seleccionable en la UI, pero se conserva en el enum
> para mostrar sesiones antiguas.

**Funcionalidades:**
- Estado del timer persistido en `localStorage` para sobrevivir recargas; el tiempo se calcula por timestamps (no por contadores) para funcionar en segundo plano.
- `MiniTimer` para ver el timer activo desde otras vistas.
- **Notificaciones sonoras** (`public/sounds/bell.wav`) y **Web Notifications API** al completar.
- **Historial** de sesiones con filtros (fecha, duración, categoría).
- **Estadísticas** (Recharts): minutos por día, distribución por categoría, racha actual, categoría top del mes y promedio diario.
- **Metas** diaria y semanal (`StudyGoals`), guardadas en `profiles` (`daily_goal_minutes`, `weekly_goal_minutes`).

---

### Categorías

CRUD de materias/áreas compartidas entre tareas y sesiones (listar, crear, renombrar, recolorear, eliminar). Constraints de unicidad, longitud y color hex a nivel de base de datos. Mutaciones vía Server Actions (`actions.ts`) y/o API REST.

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

# 4. Ejecutar migraciones en Supabase (en orden)
# Ir a supabase.com → SQL Editor → pegar y ejecutar en secuencia:
# supabase/migrations/001_initial.sql
# supabase/migrations/002_categories_constraints.sql
# supabase/migrations/003_user_goals.sql
# supabase/migrations/004_stopwatch_mode.sql

# 5. Iniciar el servidor de desarrollo
npm run dev
```

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

El esquema se construye en cuatro migraciones ejecutadas en orden. Todas las tablas tienen **Row Level Security (RLS)** activado: cada usuario solo puede leer y escribir sus propios registros.

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

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo (`next dev`) |
| `npm run build` | Build optimizado de producción (`next build`) |
| `npm start` | Servidor de producción (requiere build previo) |
| `npm run lint` | Análisis estático con ESLint |

---

## Seguridad

- **RLS en todas las tablas:** los usuarios solo acceden a sus propios datos, incluso con la clave anónima.
- **Sin secretos en el código:** todas las credenciales se leen desde variables de entorno.
- **Autenticación en Route Handlers:** cada endpoint REST verifica la sesión con `getAuthContext()` antes de instanciar cualquier modelo.
- **Validación con Zod** en formularios del cliente y en los route handlers del servidor.
- **`SUPABASE_SERVICE_ROLE_KEY`** solo se usa en Server Components y API Routes; nunca se envía al navegador.
- **Guard de rutas:** `app/(app)/layout.tsx` obtiene el usuario y redirige a `/login` si no hay sesión; `lib/supabase/middleware.ts` refresca el token y queda disponible para el guard en el edge.
- **SOAP sin exposición de credenciales:** el servicio SOAP usa el mismo cliente Supabase server-side; el `userId` del envelope es solo un filtro de consulta.

---

## Deploy

### Vercel (recomendado)

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Agregar las tres variables de entorno en **Settings → Environment Variables**.
3. El deploy ocurre automáticamente en cada push a `main`.

### Consideraciones post-deploy

- Agregar el dominio de Vercel en Supabase: **Authentication → URL Configuration → Site URL** (necesario para los enlaces de recuperación de contraseña).
- Verificar que las políticas RLS estén activas desde el dashboard de Supabase.
- Actualizar la URL del servicio SOAP en `public/studyhub.wsdl` (elemento `<soap:address location="..."/>`).

---

## Limitaciones y trabajo futuro

| Limitación | Estado |
|-----------|--------|
| Modo oscuro | ✅ Implementado (claro/oscuro con `data-theme`) |
| Soporte PWA (instalable, service worker) | ✅ Implementado |
| Recuperación de contraseña por email | ✅ Implementado |
| Metas de estudio diaria/semanal | ✅ Implementado |
| Exportación de notas a PDF / Markdown | No implementado |
| Compartir notas entre usuarios | No implementado |
| Soporte offline completo (sincronización) | No implementado |
| Autenticación en el servicio SOAP (WS-Security) | No implementado |
| Operaciones de escritura vía SOAP (crear/actualizar) | No implementado |
| Documentación interactiva de la API REST (OpenAPI/Swagger) | No implementado |