@echo off
rem Met a jour la playlist (nouvelles musiques de assets\music), demarre l'assistant LoL (bouton "Importer depuis LoL"), puis ouvre le Randomizer. Double-clic.
rem -ExecutionPolicy Bypass ne vaut que pour ces executions : aucun reglage Windows n'est modifie.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1" >nul
rem Assistant LoL : petite fenetre reduite, ferme-la pour l'arreter (il LIT seulement les pseudos de ton lobby, en local).
start "Randomizer - assistant LoL (fermer pour arreter)" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\lobby-helper.ps1"
start "" "%~dp0index.html"
