# Postgres portátil local (sem Docker, sem admin).
# Uso: .\scripts\pg.ps1 start|stop|status|reset
param([Parameter(Mandatory = $true)][ValidateSet("start", "stop", "status", "reset")][string]$Cmd)

$pg = "$env:LOCALAPPDATA\pg\pgsql"
$data = "$env:LOCALAPPDATA\pg\data"
$port = 5432
$passFile = "$env:LOCALAPPDATA\pg\pwfile"

switch ($Cmd) {
  "start" {
    if (-not (Test-Path "$data\PG_VERSION")) {
      New-Item -ItemType Directory -Force -Path $data | Out-Null
      Set-Content -Path $passFile -Value "loja_dev" -NoNewline
      & "$pg\bin\initdb.exe" -D $data -U postgres -E UTF8 --auth=password --pwfile=$passFile | Out-Null
    }
    & "$pg\bin\pg_ctl.exe" start -D $data -l "$env:LOCALAPPDATA\pg\server.log" -o "-p $port -c listen_addresses=127.0.0.1" -w
    $env:PGPASSWORD = "loja_dev"
    & "$pg\bin\psql.exe" -U postgres -p $port -c "CREATE DATABASE loja" 2>$null
    & "$pg\bin\psql.exe" -U postgres -p $port -d loja -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent;"
  }
  "stop"   { & "$pg\bin\pg_ctl.exe" stop -D $data -w }
  "status" { & "$pg\bin\pg_ctl.exe" status -D $data }
  "reset"  {
    & "$pg\bin\pg_ctl.exe" stop -D $data -w 2>$null
    Remove-Item -Recurse -Force $data
    & "$PSScriptRoot\pg.ps1" start
  }
}
