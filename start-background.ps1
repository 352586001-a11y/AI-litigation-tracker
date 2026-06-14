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
$psi.Arguments = "app.py --host 127.0.0.1 --port 8876"
$psi.UseShellExecute = $true
$process = [System.Diagnostics.Process]::Start($psi)
Write-Host "Tracker started at http://127.0.0.1:8876 (pid $($process.Id))"
