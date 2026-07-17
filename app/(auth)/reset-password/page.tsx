'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

type LinkState = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // El enlace del correo llega con ?code=... (o con un error si expiró).
    // El cliente de Supabase intercambia el código automáticamente al cargar;
    // aquí solo esperamos a que exista la sesión de recuperación.
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (params.get('error') || hashParams.get('error')) {
      setLinkState('invalid');
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setLinkState('ready');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLinkState('ready');
      } else if (!params.get('code')) {
        setLinkState('invalid');
      }
    });

    // Si el intercambio del código nunca produce sesión (enlace ya usado), no
    // dejamos la página cargando indefinidamente.
    const timeout = setTimeout(() => {
      setLinkState((state) => (state === 'checking' ? 'invalid' : state));
    }, 8000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      toast.error('No se pudo actualizar la contraseña. Solicita un nuevo enlace.');
      return;
    }

    toast.success('Contraseña actualizada correctamente.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
            <BookOpen size={22} className="text-white" />
          </div>
          <span className="font-bold text-2xl text-[var(--color-text)]">StudyHub</span>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
          {linkState === 'checking' && (
            <div className="flex flex-col items-center py-8 text-[var(--color-text-soft)]">
              <Loader2 size={28} className="animate-spin mb-3" />
              <p className="text-sm">Verificando el enlace de recuperación…</p>
            </div>
          )}

          {linkState === 'invalid' && (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <ShieldAlert size={24} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
                Enlace inválido o expirado
              </h1>
              <p className="text-[var(--color-text-soft)] text-sm mb-6">
                El enlace de recuperación ya fue usado o expiró. Solicita uno nuevo para
                continuar.
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center justify-center w-full py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                Solicitar nuevo enlace
              </Link>
            </div>
          )}

          {linkState === 'ready' && (
            <>
              <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
                Nueva contraseña
              </h1>
              <p className="text-[var(--color-text-soft)] text-sm mb-6">
                Define la nueva contraseña para tu cuenta.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-mid)] hover:text-[var(--color-text-soft)]"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Guardar contraseña
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
