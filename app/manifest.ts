import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyHub',
    short_name: 'StudyHub',
    description: 'Centraliza tus apuntes, tareas y sesiones de estudio en un solo lugar.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#67b31f',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Chrome solo enseña el diálogo de instalación completo si hay una captura
    // para cada factor de forma; sin ellas se conforma con una barra mínima.
    // Se generan en app/screenshots/[variant]/route.tsx.
    screenshots: [
      {
        src: '/screenshots/wide',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Resumen del día en StudyHub',
      },
      {
        src: '/screenshots/narrow',
        sizes: '720x1280',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Resumen del día en StudyHub',
      },
    ],
    // Accesos directos del icono instalado: el menú contextual de la app en el
    // escritorio o en la pantalla de inicio.
    shortcuts: [
      { name: 'Iniciar sesión de estudio', url: '/timer' },
      { name: 'Ver la agenda', url: '/agenda' },
      { name: 'Mis notas', url: '/notes' },
    ],
  };
}
