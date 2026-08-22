import { ImageResponse } from 'next/og';

/**
 * Capturas para el diálogo de instalación de la PWA  (C10).
 *
 * Chrome solo muestra el diálogo de instalación completo —el que explica qué
 * es la aplicación en lugar de una barra mínima— si el manifest declara
 * `screenshots` para los dos factores de forma.
 *
 * Se generan aquí, con los mismos tokens de color que la aplicación, en vez de
 * versionar dos PNG que envejecerían con el primer rediseño. Son
 * representaciones fieles del inicio: la meta del día, la racha, la semana y
 * lo que vence hoy.
 */

export const dynamic = 'force-static';

const BRAND = '#67b31f';
const PAPER = '#f8f9fa';
const SURFACE = '#ffffff';
const TEXT = '#1a1a1a';
const SOFT = '#444444';
const MUTED = '#6c757d';
const BORDER = '#e2e8f0';
const DANGER = '#dc2626';

const SIZES = {
  wide: { width: 1280, height: 720 },
  narrow: { width: 720, height: 1280 },
} as const;

type Variant = keyof typeof SIZES;

/**
 * `row` no es cosmético: en la variante ancha las tres tarjetas se reparten el
 * espacio (`flexGrow: 1` sobre base 0), pero aplicar esa misma base 0 en la
 * variante vertical colapsa su altura y el contenido se sale de la tarjeta.
 */
function Card({
  label,
  value,
  children,
  row,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  row: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...(row ? { flexGrow: 1, flexBasis: 0 } : {}),
        background: SURFACE,
        borderRadius: 18,
        padding: 20,
        border: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 15, letterSpacing: 2, color: MUTED, lineHeight: 1.4 }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 40,
          fontWeight: 700,
          color: TEXT,
          marginTop: 8,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {children}
    </div>
  );
}

const DUE_ITEMS = [
  { title: 'Taller de Cálculo', due: 'Ayer', overdue: true },
  { title: 'Ensayo de Historia', due: 'Hoy' },
  { title: 'Leer capítulo 4', due: 'Hoy' },
  { title: 'Repaso de Química', due: 'Mañana' },
  { title: 'Entrega de laboratorio', due: 'En 3 días' },
];

function DueRow({ title, due, overdue }: { title: string; due: string; overdue?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 24px',
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 10,
          height: 10,
          borderRadius: 5,
          background: overdue ? DANGER : BRAND,
          marginRight: 14,
        }}
      />
      <div style={{ display: 'flex', flexGrow: 1, fontSize: 22, color: TEXT, lineHeight: 1.3 }}>
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 20, color: overdue ? DANGER : SOFT, lineHeight: 1.3 }}>
        {due}
      </div>
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params;
  if (variant !== 'wide' && variant !== 'narrow') {
    return new Response('No encontrado', { status: 404 });
  }

  const size = SIZES[variant as Variant];
  const wide = variant === 'wide';

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          padding: wide ? 56 : 40,
          justifyContent: wide ? 'flex-start' : 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 12,
              background: BRAND,
              color: '#fff',
              fontSize: 28,
              fontWeight: 700,
              marginRight: 16,
            }}
          >
            S
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: TEXT }}>
            StudyHub
          </div>
        </div>

        {/* Satori no da altura de línea implícita a un contenedor flex: sin un
            `lineHeight` explícito el titular y su bajada se solapan. */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: wide ? 52 : 42,
              fontWeight: 700,
              color: TEXT,
              lineHeight: 1.2,
            }}
          >
            Tu día, de un vistazo
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: MUTED, marginTop: 12, lineHeight: 1.4 }}>
            Apuntes, tareas y tiempo de estudio en un solo lugar
          </div>
        </div>

        {/* Tarjetas del día */}
        <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', gap: 20 }}>
          <Card label="Meta de hoy" value="45m / 1h" row={wide}>
            <div
              style={{
                display: 'flex',
                height: 10,
                borderRadius: 5,
                background: BORDER,
                marginTop: 18,
              }}
            >
              <div style={{ display: 'flex', width: '75%', borderRadius: 5, background: BRAND }} />
            </div>
          </Card>

          <Card label="Racha" value="6 días" row={wide}>
            <div style={{ display: 'flex', fontSize: 18, color: MUTED, marginTop: 18 }}>
              Hoy ya cuenta. Sigue así.
            </div>
          </Card>

          <Card label="Últimos 7 días" value="4h 20m" row={wide}>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 34, marginTop: 14 }}>
              {[40, 65, 25, 90, 55, 15, 75].map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexGrow: 1,
                    marginRight: i === 6 ? 0 : 6,
                    height: `${h}%`,
                    borderRadius: 3,
                    background: '#67b31f66',
                  }}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Para hoy */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            marginTop: 24,
          }}
        >
          <div style={{ display: 'flex', padding: '16px 24px', fontSize: 24, fontWeight: 600, color: TEXT }}>
            Para hoy
          </div>
          {/* La variante vertical tiene alto de sobra: cabe más contexto. */}
          {DUE_ITEMS.slice(0, wide ? 3 : 5).map((item) => (
            <DueRow key={item.title} title={item.title} due={item.due} overdue={item.overdue} />
          ))}
        </div>
      </div>
    ),
    size
  );
}
