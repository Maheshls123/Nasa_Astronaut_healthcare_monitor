# ASTRA - Autonomous Spaceflight Health Intelligence System Startup Script
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "    ASTRA: Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response" -ForegroundColor White
Write-Host "    Offline-First Deep-Space Aerospace Medical Intelligence Platform" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

$PythonExe = "C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Error "Python 3.12 executable not found at $PythonExe"
    exit 1
}

Set-Location $PSScriptRoot

Write-Host "`n[1/3] Initializing local database..." -ForegroundColor Yellow
& $PythonExe backend/database.py

Write-Host "`n[2/3] Executing Master Verification Test Suite..." -ForegroundColor Yellow
& $PythonExe tests/test_master_suite.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "Master test suite encountered errors. Aborting launch."
    exit 1
}

Write-Host "`n[3/3] Launching Decoupled Backend & Frontend Processes..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "$PSScriptRoot\run_backend.ps1" -WorkingDirectory $PSScriptRoot
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "$PSScriptRoot\run_frontend.ps1" -WorkingDirectory $PSScriptRoot

Write-Host "`nBoth services running in separate processes:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Docs:     http://localhost:8000/docs" -ForegroundColor Gray
