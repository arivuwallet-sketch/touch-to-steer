param([ValidateRange(1,16)][int]$MaxPlayers = 16)
$ErrorActionPreference = 'Stop'
$bridge = Join-Path $PSScriptRoot 'TouchToSteer-Bridge.exe'
if (-not (Test-Path $bridge)) { throw 'Extract the latest Windows bridge ZIP and run this script beside TouchToSteer-Bridge.exe.' }
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) { throw 'Install cloudflared first: winget install --id Cloudflare.cloudflared. Then reopen PowerShell.' }
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+','-').Replace('/','_')
$names = @('RIG_PUBLIC','RIG_ACCESS_TOKEN','RIG_MAX_PLAYERS','RIG_PORT','RIG_REMOTE_MOUSE')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$tunnel = $null
try {
    $env:RIG_PUBLIC = '1'
    $env:RIG_ACCESS_TOKEN = $key
    $env:RIG_MAX_PLAYERS = "$MaxPlayers"
    $env:RIG_PORT = '8787'
    $env:RIG_REMOTE_MOUSE = '0'
    Write-Host 'Share the pairing key privately with invited players:'
    Write-Host $key
    Write-Host 'Use the tunnel URL printed below, replacing https:// with wss:// in phone Settings.'
    Write-Host 'For more than four controllers, select DS4/HID on the extra phones. Game/driver support is required.'
    $tunnel = Start-Process -FilePath $cloudflared.Source -ArgumentList @('tunnel','--url','http://127.0.0.1:8787','--no-autoupdate') -NoNewWindow -PassThru
    & $bridge
} finally {
    if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
