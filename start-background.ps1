$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) {
  $Python = "python.exe"
}

Set-Location $Root
python app.py --init-db

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $Python
$psi.WorkingDirectory = $Root
$psi.Arguments = "app.py --host 127.0.0.1 --port 8876"
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$process = [System.Diagnostics.Process]::Start($psi)
Write-Host "Tracker started at http://127.0.0.1:8876 (pid $($process.Id))"
