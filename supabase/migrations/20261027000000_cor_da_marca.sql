-- Cor principal da marca da empresa (personaliza menu, botões e destaques).
-- Nula = cor padrão do Planner (verde-petróleo #0b7a75).
alter table public.empresa add column if not exists cor_primaria text
  check (cor_primaria is null or cor_primaria ~* '^#[0-9a-f]{6}$');
