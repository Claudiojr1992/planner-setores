$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
function Falha($t) { Write-Host ''; Write-Host "ERRO: $t" -ForegroundColor Red; Read-Host 'Pressione Enter para sair'; exit 1 }
$cfg = @{}
if (Test-Path .env) { Get-Content .env | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $cfg[$matches[1]] = $matches[2].Trim() } } }
$porta = if ($cfg['PORTA_WEB']) { $cfg['PORTA_WEB'] } else { '8080' }
$chave = $cfg['ANON_KEY']
if (-not $chave) { Falha '.env sem ANON_KEY. Rode o INSTALAR.bat primeiro.' }
$senha = 'Planner@2026'
$usuarios = @(
  @{ email = 'admin@planner.local';       nome = 'Administrador Teste' },
  @{ email = 'gestor@planner.local';      nome = 'Gestor Fiscal Teste' },
  @{ email = 'colaborador@planner.local'; nome = 'Colaborador Fiscal Teste' }
)
Write-Host "== Criando usuários de teste em http://localhost:$porta ==" -ForegroundColor Cyan
foreach ($u in $usuarios) {
  $corpo = @{ email = $u.email; password = $senha; data = @{ nome = $u.nome } } | ConvertTo-Json -Depth 3
  try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:$porta/auth/v1/signup" -ContentType 'application/json; charset=utf-8' `
      -Headers @{ apikey = $chave; Authorization = "Bearer $chave" } -Body ([System.Text.Encoding]::UTF8.GetBytes($corpo)) | Out-Null
    Write-Host "  criado: $($u.email)" -ForegroundColor Green
  } catch {
    $msg = "$($_.ErrorDetails.Message)"
    if ($msg -match 'already|registered|exists') { Write-Host "  já existia: $($u.email)" -ForegroundColor Yellow }
    else { Falha "não foi possível criar $($u.email): $($_.Exception.Message) $msg. Confira se o sistema está no ar (docker compose ps)." }
  }
}
Write-Host '== Definindo papéis, setores, vínculo e atividades de exemplo ==' -ForegroundColor Cyan
$ErrorActionPreference = 'Continue'
docker compose cp docker/seed/usuarios-teste.sql db:/tmp/usuarios-teste.sql
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/usuarios-teste.sql
$codigo = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($codigo -ne 0) { Falha 'não foi possível preparar o cenário no banco (veja a mensagem acima).' }
Write-Host ''
Write-Host 'Pronto! Usuários de teste (senha de todos: Planner@2026):' -ForegroundColor Green
Write-Host '  Administrador ........ admin@planner.local        (Diretoria: acesso total)'
Write-Host '  Gestor do setor ...... gestor@planner.local       (gestor do Fiscal)'
Write-Host '  Colaborador .......... colaborador@planner.local  (analista do Fiscal)'
Write-Host ''
Write-Host 'Setores Fiscal e Financeiro, vínculo Fiscal -> Financeiro (com aceite) e 4 atividades de exemplo criados.'
Start-Process "http://localhost:$porta/"
Read-Host 'Pressione Enter para fechar'
