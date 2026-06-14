$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
python app.py --init-db
python app.py --host 127.0.0.1 --port 8876
