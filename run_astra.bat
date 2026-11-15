@echo off
title ASTRA - Autonomous Spaceflight Health Intelligence System
echo ===============================================================================
echo     ASTRA: Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
echo     Offline-First Deep-Space Aerospace Medical Intelligence Platform
echo ===============================================================================
echo.
set PYTHON_EXE=C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" (
    echo Python 3.12 executable not found at %PYTHON_EXE%
    pause
    exit /b 1
)

echo Initializing local database and pre-cached telemetry...
"%PYTHON_EXE%" backend\database.py

echo.
echo Running ASTRA Master Test Suite...
"%PYTHON_EXE%" tests\test_master_suite.py
if errorlevel 1 (
    echo Unit tests failed. Review logs.
    pause
    exit /b 1
)

echo.
echo Launching Decoupled Backend REST Server (Port 8000)...
start "ASTRA Backend API" cmd /c "run_backend.bat"

echo Launching Decoupled Frontend Client (Port 3000)...
start "ASTRA Frontend Client" cmd /c "run_frontend.bat"

echo.
echo Both servers have been launched in separate, independent processes:
echo - Frontend Web Client: http://localhost:3000
echo - Backend REST API:    http://localhost:8000
echo - API Docs (Swagger):  http://localhost:8000/docs
echo.
pause
