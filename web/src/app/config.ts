/* Configuração lida em tempo de execução de /config.js (gerado pelo container Docker ou no build da Vercel). */
export interface ConfigPlanner {
  supabaseUrl?: string; supabaseAnonKey?: string; nomeSistema?: string;
  /** Na Vercel: "/api/notificar" — a interface acorda o notificador logo após enfileirar um envio. */
  notificadorUrl?: string;
}
declare global { interface Window { __PLANNER_CONFIG__?: ConfigPlanner } }

const bruto: ConfigPlanner = (typeof window !== 'undefined' && window.__PLANNER_CONFIG__) || {};
/** "auto" = mesma origem da página (o container web encaminha /auth, /rest e /storage ao Supabase). */
export const config: ConfigPlanner = { ...bruto, supabaseUrl: bruto.supabaseUrl === 'auto' && typeof location !== 'undefined' ? location.origin : bruto.supabaseUrl };
export const usaSupabase = !!(config.supabaseUrl && config.supabaseAnonKey);
export const NOME_SISTEMA = config.nomeSistema || 'Planner de Setores';
