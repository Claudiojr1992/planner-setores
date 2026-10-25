$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
function Titulo($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Falha($t) { Write-Host ''; Write-Host "ERRO: $t" -ForegroundColor Red; Read-Host 'Pressione Enter para sair'; exit 1 }
function ExigirDocker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Falha 'Docker não encontrado. Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/' }
  $ErrorActionPreference = 'Continue'
  docker info *> $null
  $codigo = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($codigo -ne 0) { Falha 'O Docker Desktop não está em execução. Abra o Docker Desktop, aguarde ficar "Engine running" e rode novamente.' }
}
function LerEnv {
  $v = @{}
  if (Test-Path .env) { Get-Content .env | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $v[$matches[1]] = $matches[2].Trim() } } }
  return $v
}
function AguardarSistema {
  $cfg = LerEnv
  $porta = if ($cfg['PORTA_WEB']) { $cfg['PORTA_WEB'] } else { '8080' }
  $url = "http://localhost:$porta"
  Write-Host "Aguardando o sistema responder em $url (até 5 minutos)..."
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 -Uri "$url/rest/v1/empresa?select=nome" -Headers @{ apikey = $cfg['ANON_KEY']; Authorization = "Bearer $($cfg['ANON_KEY'])" }
      if ($r.StatusCode -eq 200) { return $url }
    } catch { }
    Start-Sleep -Seconds 5
  }
  Write-Host 'O sistema ainda não respondeu. Veja: docker compose ps   e   docker compose logs migrador auth rest' -ForegroundColor Yellow
  return $url
}

Titulo 'Parando o Planner de Setores (os dados são mantidos)'
ExigirDocker
$ErrorActionPreference = 'Continue'
docker compose down
docker compose -f docker-compose.demo.yml down 2>$null
$ErrorActionPreference = 'Stop'
Write-Host 'Tudo parado. Para voltar, use o INICIAR.bat.' -ForegroundColor Green
Start-Sleep -Seconds 3
