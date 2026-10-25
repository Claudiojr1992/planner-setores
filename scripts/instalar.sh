#!/usr/bin/env bash
# Instalação em Linux/macOS (equivalente ao INSTALAR.bat) — só precisa do Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
docker info >/dev/null 2>&1 || { echo "Inicie o Docker primeiro."; exit 1; }
if [ ! -f .env ]; then
  docker run --rm -v "$PWD:/app" -w /app node:20-alpine node scripts/gerar-env.mjs .env
fi
docker compose up -d --build
echo "Pronto: http://localhost:8080 (a primeira conta criada vira Administrador) · e-mails: http://localhost:8025"
