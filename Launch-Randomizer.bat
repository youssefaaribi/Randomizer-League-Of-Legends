@echo off
rem Updates the playlist (new music in assets\music) then opens the Randomizer. Double-click.
rem -ExecutionPolicy Bypass only applies to this run: no Windows setting is changed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1" >nul
start "" "%~dp0index.html"
