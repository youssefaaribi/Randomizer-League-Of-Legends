@echo off
rem Met a jour la playlist (nouvelles musiques de assets\music) puis ouvre le Randomizer. Double-clic.
rem -ExecutionPolicy Bypass ne vaut que pour cette execution : aucun reglage Windows n'est modifie.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1" >nul
start "" "%~dp0index.html"
