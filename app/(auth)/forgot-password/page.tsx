'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Loader2, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const schema = z.object({
  email: z.email('Correo inválido'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('resetPasswordForEmail:', error.status, error.code, error.message);
      if (error.code === 'over_email_send_rate_limit') {
        toast.error('Ya solicitaste un enlace hace poco. Espera 60 segundos e intenta de nuevo.');
      } else if (error.status === 429) {
        toast.error('Se alcanzó el límite de correos por hora. Intenta más tarde.');
      } else {
        toast.error(`No se pudo enviar el correo: ${error.message}`);
      }
      return;
    }

    setSentTo(data.email);
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
          {sentTo ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
                <MailCheck size={24} className="text-[var(--color-primary)]" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
                Revisa tu correo
              </h1>
              <p className="text-[var(--color-text-soft)] text-sm">
                Si existe una cuenta asociada a{' '}
                <span className="font-medium text-[var(--color-text)]">{sentTo}</span>,
                recibirás un enlace para reestablecer tu contraseña. Revisa también la
                carpeta de spam.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-[var(--color-text-soft)] text-sm mb-6">
                Ingresa tu correo y te enviaremos un enlace para reestablecerla.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
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
                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Enviar enlace de recuperación
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-[var(--color-text-soft)]">
            <Link
              href="/login"
              className="text-[var(--color-primary)] font-medium hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
