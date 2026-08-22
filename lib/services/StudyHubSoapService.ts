import { SupabaseClient } from '@supabase/supabase-js';
import { CategoryModel } from '@/lib/models/CategoryModel';
import { SessionModel } from '@/lib/models/SessionModel';

interface OperationArgs {
  /**
   * El WSDL declara `userId` en las tres peticiones, así que los clientes
   * existentes lo siguen enviando. **No se usa para consultar**: el usuario se
   * deriva siempre de la sesión del request. Si viene y no coincide con la
   * sesión, la operación falla en lugar de devolver datos ajenos.
   */
  userId?: string;
}

/**
 * Operaciones SOAP de StudyHub (solo lectura).
 *
 * Antes cada método consultaba con el `userId` que venía en el envelope, sin
 * comprobar sesión: la identidad la elegía quien llamaba. RLS lo contenía en
 * la práctica —el cliente usa la anon key con las cookies del request—, pero
 * el diseño era incorrecto y habría bastado cambiar ese cliente por uno con
 * service role para convertirlo en una fuga completa.
 */
export class StudyHubSoapService {
  constructor(
    private readonly supabase: SupabaseClient,
    /** Usuario autenticado del request. Única fuente de identidad. */
    private readonly sessionUserId: string
  ) {}

  /** Rechaza un envelope que pida datos de otro usuario. */
  private resolveUserId(args: OperationArgs): string {
    if (args.userId && args.userId !== this.sessionUserId) {
      throw new Error('No autorizado: el userId no corresponde a la sesión.');
    }
    return this.sessionUserId;
  }

  async GetCategories(args: OperationArgs) {
    const userId = this.resolveUserId(args);
    const list = await new CategoryModel(this.supabase).findAllByUser(userId);
    return {
      categories: {
        category: list.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          created_at: c.created_at,
        })),
      },
    };
  }

  async GetTaskStats(args: OperationArgs) {
    const userId = this.resolveUserId(args);

    const { data } = await this.supabase
      .from('tasks')
      .select('quadrant, completed')
      .eq('user_id', userId);

    const tasks = data ?? [];
    const count = (q: string) => tasks.filter((t) => t.quadrant === q).length;

    return {
      stats: {
        urgentImportant: count('urgent_important'),
        notUrgentImportant: count('not_urgent_important'),
        urgentNotImportant: count('urgent_not_important'),
        notUrgentNotImportant: count('not_urgent_not_important'),
        totalCompleted: tasks.filter((t) => t.completed).length,
        totalPending: tasks.filter((t) => !t.completed).length,
      },
    };
  }

  async GetStudyStats(args: OperationArgs) {
    const userId = this.resolveUserId(args);
    // Mismas métricas que la UI: getStats() delega en lib/stats.ts.
    const stats = await new SessionModel(this.supabase).getStats(userId);
    return {
      stats: {
        totalMinutesThisWeek: stats.totalMinutesThisWeek,
        currentStreak: stats.currentStreak,
        topCategoryThisMonth: stats.topCategoryThisMonth ?? '',
        dailyAverage: stats.dailyAverage,
      },
    };
  }
}

/** Objeto de servicio con la forma que espera node-soap (service → port → operation) */
export function buildSoapServiceObject(supabase: SupabaseClient, sessionUserId: string) {
  const impl = new StudyHubSoapService(supabase, sessionUserId);
  return {
    StudyHubService: {
      StudyHubPort: {
        GetCategories: (args: OperationArgs) => impl.GetCategories(args),
        GetTaskStats: (args: OperationArgs) => impl.GetTaskStats(args),
        GetStudyStats: (args: OperationArgs) => impl.GetStudyStats(args),
      },
    },
  };
}
