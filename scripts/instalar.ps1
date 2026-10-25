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

function NovoHex([int]$n) {
  $b = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}
function B64Url([byte[]]$b) { return [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function NovoJwt([string]$papel, [string]$segredo) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $agora = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $h = B64Url ($utf8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
  $carga = '{{"role":"{0}","iss":"supabase","iat":{1},"exp":{2}}}' -f $papel, $agora, ($agora + 315360000)
  $p = B64Url ($utf8.GetBytes($carga))
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = $utf8.GetBytes($segredo)
  $s = B64Url ($hmac.ComputeHash($utf8.GetBytes("$h.$p")))
  return "$h.$p.$s"
}
function CriarEnv {
  if (Test-Path .env) { Write-Host 'Arquivo .env já existe — mantido (suas senhas e chaves continuam as mesmas).'; return }
  $segredo = NovoHex 36
  $novos = @{ POSTGRES_PASSWORD = (NovoHex 18); JWT_SECRET = $segredo; ANON_KEY = (NovoJwt 'anon' $segredo); SERVICE_ROLE_KEY = (NovoJwt 'service_role' $segredo) }
  $linhas = Get-Content .env.example -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=' -and $novos.ContainsKey($matches[1])) { "$($matches[1])=$($novos[$matches[1]])" } else { $_ }
  }
  [System.IO.File]::WriteAllText((Join-Path $raiz '.env'), (([string[]]$linhas) -join "`n") + "`n", (New-Object System.Text.UTF8Encoding $false))
  Write-Host 'Arquivo .env criado com senhas e chaves novas.'
}

Write-Host 'Planner de Setores — instalação (tudo em Docker)' -ForegroundColor Green
Titulo '1/3 Verificando o Docker'
ExigirDocker
Write-Host 'Docker OK.'

Titulo '2/3 Preparando a configuração (.env)'
CriarEnv

Titulo '3/3 Baixando imagens e subindo os serviços (a primeira vez pode levar alguns minutos)'
$ErrorActionPreference = 'Continue'
docker compose up -d --build --force-recreate --remove-orphans
$codigo = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($codigo -ne 0) { Falha 'docker compose falhou. Veja as mensagens acima ou rode: docker compose logs migrador' }

$url = AguardarSistema
Write-Host ''
Write-Host 'Pronto! Endereços:' -ForegroundColor Green
Write-Host "  Sistema ............ $url"
Write-Host '  Caixa de e-mails ... http://localhost:8025  (recuperação de senha e notificações)'
Write-Host ''
Write-Host 'Primeiro acesso: clique em "Criar conta". A PRIMEIRA conta criada vira Administrador.' -ForegroundColor Yellow
Start-Process $url
Read-Host 'Pressione Enter para fechar'
