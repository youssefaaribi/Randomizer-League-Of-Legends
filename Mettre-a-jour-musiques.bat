@echo off
rem Met a jour la playlist a partir des fichiers de assets\music (double-clic).
rem -ExecutionPolicy Bypass ne vaut que pour cette execution : aucun reglage Windows n'est modifie.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1"
echo.
pause
