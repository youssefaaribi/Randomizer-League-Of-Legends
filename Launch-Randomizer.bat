@echo off
rem Updates the playlist (new music in assets\music), starts the LoL helper (for the "Import from LoL" button), then opens the Randomizer. Double-click.
rem -ExecutionPolicy Bypass only applies to these runs: no Windows setting is changed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1" >nul
rem LoL helper: small window kept minimized, close it to stop it (it only READS the player names of your lobby, locally).
start "Randomizer - LoL helper (close to stop)" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\lobby-helper.ps1"
start "" "%~dp0index.html"
