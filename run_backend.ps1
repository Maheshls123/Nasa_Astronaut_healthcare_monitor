# ASTRA - Backend REST API Service
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "    ASTRA: Autonomous Spaceflight Biomedical REST API Server" -ForegroundColor White
Write-Host "    Decoupled Backend Microservice (Port 8000)" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = "C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Python 3.12 executable not found at $pythonExe"
    exit 1
}

Write-Host "Initializing local SQLite database..." -ForegroundColor Yellow
& $pythonExe backend\database.py

Write-Host "`nStarting ASTRA REST API Server on http://localhost:8000 ..." -ForegroundColor Green
Write-Host "Swagger / OpenAPI Documentation at: http://localhost:8000/docs" -ForegroundColor Gray
& $pythonExe -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
