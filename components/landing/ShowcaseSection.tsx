import type { LucideIcon } from 'lucide-react';

const ACCENTS = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  green: 'bg-[#67b31f1a] text-[#67b31f]',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
} as const;

interface Bullet {
  icon: LucideIcon;
  text: string;
}

interface Props {
  id: string;
  badge: string;
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: Bullet[];
  accent: keyof typeof ACCENTS;
  reverse?: boolean;
  soft?: boolean;
  visual: React.ReactNode;
}

export function ShowcaseSection({
  id,
  badge,
  icon: Icon,
  title,
  description,
  bullets,
  accent,
  reverse = false,
  soft = false,
  visual,
}: Props) {
  const accentClass = ACCENTS[accent];

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`px-6 py-20 ${soft ? 'bg-[var(--color-surface-soft)]' : 'bg-[var(--color-bg)]'}`}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className={reverse ? 'lg:order-2' : ''}>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${accentClass}`}
          >
            <Icon size={16} />
            {badge}
          </span>
          <h2
            id={`${id}-title`}
            className="text-3xl font-bold text-[var(--color-text)] mt-4 mb-4"
          >
            {title}
          </h2>
          <p className="text-[var(--color-text-soft)] leading-relaxed mb-6">
            {description}
          </p>
          <ul className="space-y-3">
            {bullets.map(({ icon: BulletIcon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}
                >
                  <BulletIcon size={14} />
                </span>
                <span className="text-sm text-[var(--color-text-soft)]">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? 'lg:order-1' : ''} aria-hidden="true">
          {visual}
        </div>
      </div>
    </section>
  );
}
