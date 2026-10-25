#!/bin/sh
# Gera /config.js com as variáveis de ambiente do container (sem precisar recompilar a interface).
cat > /usr/share/nginx/html/config.js <<CFG
window.__PLANNER_CONFIG__ = {
  supabaseUrl: "${SUPABASE_URL_PUBLICA:-}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY:-}",
  nomeSistema: "${NOME_SISTEMA:-Planner de Setores}"
};
CFG
if [ -z "$SUPABASE_URL_PUBLICA" ]; then echo "[planner] Supabase não configurado: interface em MODO DEMONSTRAÇÃO"; else echo "[planner] Supabase: $SUPABASE_URL_PUBLICA"; fi
