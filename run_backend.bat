@echo off
title ASTRA - Backend REST API Service
echo ===============================================================================
echo     ASTRA: Autonomous Spaceflight Biomedical REST API Server
echo     Decoupled Backend Microservice (Port 8000)
echo ===============================================================================
echo.
set PYTHON_EXE=C:\Users\lsmah\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" (
    echo Python executable not found at %PYTHON_EXE%
    pause
    exit /b 1
)

echo Initializing local SQLite database...
"%PYTHON_EXE%" backend\database.py

echo.
echo Starting ASTRA REST API Server on http://localhost:8000 ...
echo API Documentation available at: http://localhost:8000/docs
echo.
"%PYTHON_EXE%" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
pause
