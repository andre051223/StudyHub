/**
 * Límite de Suspense a nivel raíz.
 *
 * Sin este archivo Next.js no tiene dónde suspender: no puede enviar nada al
 * navegador hasta que TODO el árbol de servidor (layout + página + sus consultas
 * a Supabase) termina de resolverse. Ese es el origen de la pantalla en blanco:
 * el navegador se queda esperando el primer byte y luego pinta todo de golpe.
 *
 * Con este fallback, Next emite de inmediato el HTML del `<html>`/`<body>` —con
 * su CSS, su fuente y el color de fondo del tema— y va sustituyendo el contenido
 * por streaming a medida que el servidor lo produce.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div
        role="status"
        aria-label="Cargando"
        className="w-8 h-8 rounded-full border-2 border-[var(--color-gray-border)] border-t-[var(--color-primary)] animate-spin"
      />
    </div>
  );
}
