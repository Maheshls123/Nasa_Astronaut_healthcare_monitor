# ASTRA - Decoupled Frontend Client
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "    ASTRA: AeroHealth Orbital Frontend Client" -ForegroundColor White
Write-Host "    Decoupled Web Client (Port 3000)" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = "C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe"
Write-Host "Starting static frontend server on http://localhost:3000 ..." -ForegroundColor Green
Write-Host "Connects to backend REST API at: http://localhost:8000" -ForegroundColor Gray
Start-Process "http://localhost:3000"
& $pythonExe -m http.server 3000 --directory frontend
