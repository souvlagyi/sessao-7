@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0node.exe" (
  set "SESSAO7_NODE=%~dp0node.exe"
) else (
  set "SESSAO7_NODE=node"
)
"%SESSAO7_NODE%" -e "require('node:sqlite')" >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js 24 LTS e execute este arquivo novamente.
  echo Download oficial: https://nodejs.org/pt-br/download
  pause
  exit /b 1
)
"%SESSAO7_NODE%" server.mjs --abrir
if errorlevel 1 pause
