import Link from 'next/link';
import {
  BookOpen,
  CheckSquare,
  Timer,
  ArrowRight,
  Type,
  Code2,
  ListChecks,
  Save,
  FolderOpen,
  LayoutGrid,
  MousePointer2,
  Filter,
  Palette,
  PictureInPicture2,
  BarChart3,
  Target,
} from 'lucide-react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { ShowcaseSection } from '@/components/landing/ShowcaseSection';
import { NotesMockup, KanbanMockup, TimerMockup } from '@/components/landing/mockups';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {/* Navbar */}
      <header className="border-b border-[var(--color-gray-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <BookOpen size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl text-[var(--color-text)]">StudyHub</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-primary)] transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Registrarse gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#67b31f1a] text-[var(--color-primary)] rounded-full text-sm font-medium mb-8">
          <span>Tu espacio de estudio todo en uno</span>
        </div>

        <h1 className="text-5xl font-bold text-[var(--color-text)] leading-tight max-w-3xl mb-6">
          Estudia más inteligente,<br />
          <span className="text-[var(--color-primary)]">no más duro</span>
        </h1>

        <p className="text-lg text-[var(--color-text-soft)] max-w-xl mb-10 leading-relaxed">
          StudyHub centraliza tus apuntes, gestión de tareas y cronómetro de
          sesiones en una sola aplicación diseñada para estudiantes universitarios.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-all hover:-translate-y-0.5"
          >
            Comenzar ahora
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-semibold rounded-xl hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="px-6 py-20 bg-[var(--color-surface-soft)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-[var(--color-text)] mb-12">
            Todo lo que necesitas para estudiar mejor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={BookOpen}
              title="Toma notas con tu propio editor"
              desc="Escribe apuntes con formato, código, imágenes y listas de tareas. Autoguardado incluido."
              colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
            />
            <FeatureCard
              icon={CheckSquare}
              title="Matriz de Eisenhower"
              desc="Organiza tus tareas por urgencia e importancia con un Kanban drag & drop."
              colorClass="bg-[#67b31f1a] text-[#67b31f]"
            />
            <FeatureCard
              icon={Timer}
              title="Temporizador y cronómetro"
              desc="Mide tus sesiones de estudio con temporizador o cronómetro. Historial y estadísticas."
              colorClass="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
            />
          </div>
        </div>
      </section>

      {/* Showcase: Notas */}
      <ShowcaseSection
        id="notas"
        badge="Notas"
        icon={BookOpen}
        accent="blue"
        title="Apuntes con un editor de verdad"
        description="Escribe tus apuntes de clase con un editor enriquecido pensado para estudiar: formato completo, código, imágenes y listas de tareas, todo guardado automáticamente mientras escribes."
        bullets={[
          { icon: Type, text: 'Formato completo: títulos, listas, citas y enlaces' },
          { icon: Code2, text: 'Bloques de código con resaltado de sintaxis' },
          { icon: ListChecks, text: 'Imágenes y listas de tareas dentro de la nota' },
          { icon: Save, text: 'Autoguardado automático mientras escribes' },
          { icon: FolderOpen, text: 'Organización por carpetas y etiquetas' },
        ]}
        visual={<NotesMockup />}
      />

      {/* Showcase: Tareas */}
      <ShowcaseSection
        id="tareas"
        badge="Tareas"
        icon={CheckSquare}
        accent="green"
        soft
        reverse
        title="Prioriza con la matriz de Eisenhower"
        description="Organiza tus pendientes en un tablero visual por urgencia e importancia. Arrastra cada tarea al cuadrante que le corresponde y enfócate primero en lo que de verdad importa."
        bullets={[
          { icon: LayoutGrid, text: 'Cuatro cuadrantes: Hacer ahora, Planificar, Delegar y Eliminar' },
          { icon: MousePointer2, text: 'Arrastra y suelta tarjetas entre cuadrantes' },
          { icon: Filter, text: 'Filtros por categoría y estado' },
          { icon: Palette, text: 'Categorías con colores personalizados' },
        ]}
        visual={<KanbanMockup />}
      />

      {/* Showcase: Tiempo de estudio */}
      <ShowcaseSection
        id="tiempo"
        badge="Tiempo de estudio"
        icon={Timer}
        accent="orange"
        title="Mide y mejora tus sesiones"
        description="Cronometra tus sesiones de estudio, revisa tu historial y sigue tu progreso con estadísticas, metas y rachas que te motivan a mantener el ritmo."
        bullets={[
          { icon: Timer, text: 'Temporizador de 10 a 120 minutos o cronómetro libre' },
          { icon: PictureInPicture2, text: 'Mini-timer flotante Picture-in-Picture' },
          { icon: BarChart3, text: 'Estadísticas: minutos por día, distribución y racha' },
          { icon: Target, text: 'Metas diarias y semanales de estudio' },
        ]}
        visual={<TimerMockup />}
      />

      {/* CTA final */}
      <section className="px-6 py-20 bg-[var(--color-surface-soft)] text-center">
        <h2 className="text-3xl font-bold text-[var(--color-text)] mb-4">
          Empieza a estudiar mejor hoy
        </h2>
        <p className="text-[var(--color-text-soft)] max-w-xl mx-auto mb-8 leading-relaxed">
          StudyHub es gratis y puedes instalarlo como app en tu computador o celular.
          Crea tu cuenta y organiza tu semestre en minutos.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-all hover:-translate-y-0.5"
        >
          Registrarse gratis
          <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="border-t border-[var(--color-gray-border)] px-6 py-6 text-center text-sm text-[var(--color-gray-mid)]">
        StudyHub © 2026 | Desarrollado por Diego Andrés Lopez | Fundación Universitaria del Área Andina
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  colorClass,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  colorClass: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass}`}>
        <Icon size={24} />
      </div>
      <h3 className="font-semibold text-[var(--color-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-soft)] leading-relaxed">{desc}</p>
    </div>
  );
}
