@echo off
rem Updates the playlist from the files in assets\music (double-click).
rem -ExecutionPolicy Bypass only applies to this run: no Windows setting is changed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1"
echo.
pause
