'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const schema = z
  .object({
    full_name: z.string().min(2, 'Ingresa tu nombre completo'),
    email: z.email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('¡Cuenta creada! Revisa tu correo para confirmar.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
            <BookOpen size={22} className="text-white" />
          </div>
          <span className="font-bold text-2xl text-[var(--color-text)]">StudyHub</span>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
            Crea tu cuenta
          </h1>
          <p className="text-[var(--color-text-soft)] text-sm mb-6">
            Comienza a organizar tu estudio de forma inteligente.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Nombre completo
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-mid)]"
                  aria-label="Alternar visibilidad"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Confirmar contraseña
              </label>
              <input
                id="confirm_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] placeholder:text-[var(--color-gray-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Crear cuenta
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-soft)]">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-[var(--color-primary)] font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
