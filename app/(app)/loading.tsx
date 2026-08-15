/**
 * Fallback de las rutas autenticadas. Se muestra dentro del layout, así que la
 * navbar ya está pintada y solo se sustituye el contenido mientras llegan los
 * datos de Supabase. También cubre la navegación entre /notes, /tasks y /timer.
 */
export default function AppLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8 animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-52 rounded-lg bg-[var(--color-gray-border)] mb-3" />
        <div className="h-4 w-72 rounded bg-[var(--color-gray-border)] opacity-60" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[104px] rounded-xl bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          />
        ))}
      </div>

      <div className="h-5 w-40 rounded bg-[var(--color-gray-border)] mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[92px] rounded-xl bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          />
        ))}
      </div>
    </main>
  );
}
