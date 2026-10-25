-- =====================================================================
-- Planner de Setores — agenda o notificador a cada minuto (opcional, recomendado)
-- A interface já acorda o notificador da Vercel quando cria uma notificação.
-- Este agendamento é a garantia: reenvia o que falhou e o que ficou pendente.
-- (O plano gratuito da Vercel só permite agendamento diário; aqui quem agenda é o Supabase.)
--
-- 1. No Supabase: Database → Extensions → ative "pg_cron" e "pg_net".
-- 2. Troque o endereço abaixo pelo do seu site na Vercel e execute no SQL Editor.
-- Para remover: select cron.unschedule('planner-notificador');
-- =====================================================================
select cron.schedule(
  'planner-notificador',
  '* * * * *',
  $$ select net.http_post(url := 'https://SEU-PROJETO.vercel.app/api/notificar', body := '{}'::jsonb) $$
);
