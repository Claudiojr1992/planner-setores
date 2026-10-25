-- Reforço de segurança (recomendações do Supabase Advisor)
-- * funções de gatilho não podem ser chamadas pela API (/rest/v1/rpc/...)
-- * funções auxiliares de permissão: só usuários logados
-- * search_path fixo em tocar_atualizado_em
revoke execute on function public.ao_criar_usuario(), public.proteger_perfil(), public.proteger_setor(), public.tocar_atualizado_em() from public, anon, authenticated;
revoke execute on function public.eh_ativo(), public.eh_admin(), public.gestor_do_setor(uuid), public.eh_gestor(), public.meu_setor() from public, anon;
grant execute on function public.eh_ativo(), public.eh_admin(), public.gestor_do_setor(uuid), public.eh_gestor(), public.meu_setor() to authenticated, service_role;
alter function public.tocar_atualizado_em() set search_path = public;
