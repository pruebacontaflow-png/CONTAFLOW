@echo off
REM Reemplaza la base de ContaFlow por la recarga 2025 (contaflow.nuevo.db).
REM Antes de ejecutarlo: cerrar ContaFlow (Ctrl+C en la ventana de npm run dev / compartir).
cd /d "%~dp0.."
if not exist contaflow.nuevo.db (echo No se encontro contaflow.nuevo.db & pause & exit /b 1)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set FECHA=%%i
if not exist backups mkdir backups
copy /y contaflow.db "backups\contaflow.db.antes-recarga-%FECHA%" >nul
if exist contaflow.db-wal copy /y contaflow.db-wal "backups\contaflow.db-wal.antes-recarga-%FECHA%" >nul
del /q contaflow.db-wal 2>nul
del /q contaflow.db-shm 2>nul
move /y contaflow.nuevo.db contaflow.db >nul
if errorlevel 1 (echo No se pudo reemplazar: ContaFlow sigue abierto. Cerralo y volve a intentar. & pause & exit /b 1)
echo Listo. Base anterior guardada en backups\contaflow.db.antes-recarga-%FECHA%
echo Ahora volve a iniciar ContaFlow con: npm run dev
pause
