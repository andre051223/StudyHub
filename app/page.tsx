import Link from 'next/link';
import { BookOpen, CheckSquare, Timer, ArrowRight } from 'lucide-react';

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
          <span>✦</span>
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
              title="Temporizador Pomodoro"
              desc="Sesiones de estudio con modo simple o Pomodoro. Historial y estadísticas."
              colorClass="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
            />
          </div>
        </div>
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
