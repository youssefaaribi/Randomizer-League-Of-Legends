# Regenere js\playlist.js a partir des fichiers audio presents dans assets\music
# (script volontairement sans accents : PowerShell 5.1 lit mal l'UTF-8 sans BOM)

$root     = Split-Path -Parent $PSScriptRoot
$musicDir = Join-Path $root 'assets\music'
$outFile  = Join-Path $root 'js\playlist.js'
$audioExt = '.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.opus'

if (-not (Test-Path -LiteralPath $musicDir)) {
    Write-Host "Dossier introuvable / Folder not found : $musicDir" -ForegroundColor Red
    exit 1
}

$files = @(Get-ChildItem -LiteralPath $musicDir -File |
    Where-Object { $audioExt -contains $_.Extension.ToLower() } |
    Sort-Object Name)

# ConvertTo-Json echappe correctement guillemets, accents et caracteres speciaux dans les noms
$entries = foreach ($f in $files) {
    $title = [IO.Path]::GetFileNameWithoutExtension($f.Name) | ConvertTo-Json -Compress
    $path  = ('assets/music/' + $f.Name) | ConvertTo-Json -Compress
    "    { title: $title, file: $path }"
}

$lines = @(
    '// Fichier genere par Mettre-a-jour-musiques.bat : ne pas modifier a la main.',
    '// Ajoute tes fichiers audio dans assets/music puis relance le .bat.',
    'const musicTracks = [',
    ($entries -join ",`r`n"),
    '];'
)
[IO.File]::WriteAllText($outFile, (($lines | Where-Object { $_ -ne $null }) -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))

Write-Host ''
Write-Host "$($files.Count) musique(s) dans la playlist / track(s) in the playlist :" -ForegroundColor Green
foreach ($f in $files) { Write-Host "  - $($f.Name)" }
if ($files.Count -eq 0) { Write-Host '  (aucune / none : mets des .mp3 / .ogg / .wav / .m4a dans assets\music  /  put .mp3 / .ogg / .wav / .m4a files in assets\music)' -ForegroundColor Yellow }
Write-Host ''
Write-Host 'Recharge la page (F5) pour voir les changements. / Reload the page (F5) to see the changes.'
