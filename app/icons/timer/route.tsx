import { ImageResponse } from 'next/og';

// Icono de la ventana flotante del temporizador. Sin él, la ventana
// Picture-in-Picture se muestra con el icono genérico del navegador y no se
// distingue de cualquier otra ventana de Edge/Chrome. Mismo fondo y radio que
// el logo (`app/icon.tsx`), con un reloj en lugar del libro.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: '#67b31f',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={42}
          height={42}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3 2 6" />
          <path d="m22 6-3-3" />
        </svg>
      </div>
    ),
    { width: 64, height: 64 }
  );
}
