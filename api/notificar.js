// Função da Vercel: processa a fila "envios" (e-mail via SMTP e Microsoft Teams).
// É chamada pela própria interface logo após enfileirar uma notificação e, de reserva, pelo agendamento (vercel.json).
// Variáveis: SUPABASE_URL (ou PLANNER_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY e SMTP_* — veja docs/08-PUBLICAR-NA-NUVEM.md.
import { ciclo, configurado, smtpAtivo } from '../notificador/index.mjs';

async function rodar() {
  if (!configurado()) return Response.json({ ok: false, erro: 'Defina SUPABASE_SERVICE_ROLE_KEY nas variáveis do projeto na Vercel.' }, { status: 503 });
  let processados = 0;
  for (let i = 0; i < 4; i++) { // até ~100 envios por chamada
    const n = await ciclo();
    if (n === -1) return Response.json({ ok: false, erro: 'Falha ao ler a fila no Supabase (veja os logs da função).' }, { status: 502 });
    if (!n) break;
    processados += n;
  }
  return Response.json({ ok: true, processados, smtp: smtpAtivo() }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = rodar;
export const POST = rodar;
