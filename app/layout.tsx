import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { Toaster } from 'sonner';
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${roboto.variable} h-full`}>
      <body className="h-full antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
