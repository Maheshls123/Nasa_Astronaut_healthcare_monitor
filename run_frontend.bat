@echo off
title ASTRA - Decoupled Frontend Client
echo ===============================================================================
echo     ASTRA: AeroHealth Orbital Frontend Client
echo     Decoupled Web Client (Port 3000)
echo ===============================================================================
echo.
set PYTHON_EXE=C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" (
    echo Python executable not found. Opening frontend directly in default browser...
    start frontend\index.html
    exit /b 0
)

echo Starting static web server for frontend on http://localhost:3000 ...
echo Open your browser at: http://localhost:3000
echo Connected REST API: http://localhost:8000
echo.
start http://localhost:3000
"%PYTHON_EXE%" -m http.server 3000 --directory frontend
pause
