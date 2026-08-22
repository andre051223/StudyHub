'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfileAction } from '@/app/(app)/profile/actions';
import { updateProfileSchema } from '@/lib/api/schemas';
import type { Profile } from '@/lib/types';
import type { z } from 'zod';

// Mismo esquema que valida el servidor.
const schema = updateProfileSchema;

type FormData = z.infer<typeof schema>;

interface Props {
  profile: Profile | null;
  email: string;
}

export function ProfileClient({ profile, email }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: profile?.full_name ?? '' },
  });

  async function onSubmit(data: FormData) {
    const result = await updateProfileAction(data);
    if (!result.ok) { toast.error(result.error); return; }
    // Reinicia el estado del formulario para que "Guardar" vuelva a quedar
    // deshabilitado hasta el siguiente cambio.
    reset({ full_name: result.data.full_name });
    toast.success('Perfil actualizado');
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--color-gray-border)]">
        <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-2xl font-bold">
          {(profile?.full_name || email)[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-[var(--color-text)]">{profile?.full_name || 'Sin nombre'}</p>
          <p className="text-sm text-[var(--color-text-soft)]">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Nombre completo
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-gray-mid)] bg-[var(--color-gray-light)] cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-[var(--color-gray-mid)]">El correo no se puede cambiar desde aquí.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
