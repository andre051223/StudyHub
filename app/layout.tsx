import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { Toaster } from 'sonner';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import './globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'StudyHub | Tu espacio de estudio',
  description:
    'Centraliza tus apuntes, tareas y sesiones de estudio en un solo lugar.',
};

// Se ejecuta antes del primer render para evitar el "flash" de tema incorrecto (FOUC).
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('studyhub_theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${roboto.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
