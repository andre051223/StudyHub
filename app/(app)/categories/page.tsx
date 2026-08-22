import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { CategoryModel } from '@/lib/models';
import { CategoriesClient } from '@/components/categories/CategoriesClient';

export default async function CategoriesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const model = new CategoryModel(supabase);
  const categories = await model.findAllByUser(user!.id);

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="heading-page text-[var(--color-text)] mb-1">Categorías</h1>
      <p className="text-[var(--color-text-soft)] text-sm mb-6">
        Organiza tus tareas y sesiones de estudio por materias o áreas.
      </p>
      <CategoriesClient initialCategories={categories} />
    </main>
  );
}
