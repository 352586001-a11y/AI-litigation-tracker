$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pythonw = "D:\miniconda3\pythonw.exe"
if (-not (Test-Path $Pythonw)) {
  $Pythonw = "pythonw.exe"
}

Set-Location $Root
python app.py --init-db

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $Pythonw
$psi.WorkingDirectory = $Root
$psi.Arguments = "app.py --monitor-loop --interval-minutes 60"
$psi.UseShellExecute = $true
$process = [System.Diagnostics.Process]::Start($psi)
Write-Host "24h monitor loop started (pid $($process.Id), interval 60 minutes)"
