@echo off
rem ============================================================
rem  RPG VA - liga o servidor local (sem GitHub)
rem  PC:      http://localhost:8000
rem  Celular: https://IP-DO-PC:8443  (mesmo Wi-Fi)
rem ============================================================
chcp 65001 >nul
title RPG VA - servidor
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  python --version >nul 2>nul && set "PY=python"
)
if not defined PY goto :sempython

if /i "%~1"=="baixar" goto :baixar
if not exist "servidor\cache\jsdelivr" (
  echo Primeira vez: baixando as bibliotecas para funcionar sem internet...
  %PY% servidor\servidor.py --baixar
)
%PY% servidor\servidor.py
goto :fim

:baixar
%PY% servidor\servidor.py --baixar
goto :fim

:sempython
echo.
echo  O Python nao foi encontrado neste computador.
echo  Ele e necessario para criar o servidor do jogo.
echo.
choice /C SN /M " Instalar o Python agora (precisa de internet)"
if errorlevel 2 goto :manual
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
echo.
echo  Pronto. FECHE esta janela e abra o INICIAR-SERVIDOR.bat de novo.
goto :fim

:manual
echo.
echo  Instale o Python em https://www.python.org/downloads/
echo  (marque "Add Python to PATH" na instalacao) e abra este arquivo de novo.

:fim
echo.
pause
