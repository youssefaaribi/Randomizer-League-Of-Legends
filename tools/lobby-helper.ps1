# Assistant "lobby" : lit les pseudos du lobby / de la custom ouverte dans le client League of Legends
# et les donne a la page du Randomizer (bouton "Importer depuis LoL").
# - Lecture seule : il ne fait que LIRE la liste des joueurs (jamais d'ecriture dans le client).
# - Reste en local : ecoute uniquement sur 127.0.0.1:8766, ne repond qu'a la page du Randomizer (fichier local ou localhost).
# - N'expose jamais le mot de passe du client : seuls les pseudos sortent.
# (script volontairement sans accents : PowerShell 5.1 lit mal l'UTF-8 sans BOM)
param(
    [switch]$Once,     # test : affiche le resultat une fois et s'arrete
    [switch]$Inspect   # test : affiche la structure (noms des champs) du lobby
)

$ErrorActionPreference = 'Stop'
$Port = 8766
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Le client LoL utilise un certificat local auto-signe : on ne l'accepte QUE pour 127.0.0.1
Add-Type -TypeDefinition @"
using System.Net;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
public static class TrustLocalClient {
    public static void Enable() {
        ServicePointManager.ServerCertificateValidationCallback = delegate(object s, X509Certificate c, X509Chain ch, SslPolicyErrors e) {
            var req = s as HttpWebRequest;
            return req != null && req.RequestUri.Host == "127.0.0.1";
        };
    }
}
"@
[TrustLocalClient]::Enable()

# ── Connexion au client : port + mot de passe (fichier lockfile) ──
function Get-ClientConnection {
    $dirs = @()
    $proc = Get-CimInstance Win32_Process -Filter "Name='LeagueClientUx.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and $proc.CommandLine -match '--install-directory=("([^"]+)"|(\S+))') {
        $dirs += $(if ($Matches[2]) { $Matches[2] } else { $Matches[3] })
    }
    $dirs += 'C:\Riot Games\League of Legends'
    foreach ($d in $dirs) {
        $lock = Join-Path $d 'lockfile'
        if (Test-Path -LiteralPath $lock) {
            try {
                $fs = [IO.File]::Open($lock, 'Open', 'Read', 'ReadWrite')   # le client garde le fichier ouvert
                $text = (New-Object IO.StreamReader($fs)).ReadToEnd(); $fs.Close()
                $p = $text.Trim().Split(':')       # nom:pid:port:mot-de-passe:protocole
                if ($p.Count -ge 5) { return @{ Port = [int]$p[2]; Password = $p[3] } }
            } catch { }
        }
    }
    return $null
}

function Invoke-Lcu($conn, $path) {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('riot:' + $conn.Password))
    $r = Invoke-WebRequest -UseBasicParsing -Uri ("https://127.0.0.1:{0}{1}" -f $conn.Port, $path) -Headers @{ Authorization = "Basic $auth" } -TimeoutSec 5
    # Decodage UTF-8 explicite : sinon PowerShell 5.1 abime les pseudos avec accents / alphabets non latins
    $bytes = New-Object byte[] $r.RawContentStream.Length
    [void]$r.RawContentStream.Read($bytes, 0, $bytes.Length)
    [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
}

# Pseudo d'un participant : Riot ID (gameName) en priorite, sinon l'ancien nom d'invocateur, sinon on le demande avec son puuid
function Get-ParticipantName($conn, $p) {
    foreach ($field in 'gameName', 'summonerName', 'summonerInternalName', 'displayName') {
        $v = $p.$field
        if ($v -is [string] -and $v.Trim()) { return $v.Trim() }
    }
    if ($p.puuid) {
        try {
            $s = Invoke-Lcu $conn ("/lol-summoner/v2/summoners/puuid/" + $p.puuid)
            foreach ($field in 'gameName', 'displayName', 'internalName') { if ($s.$field -is [string] -and $s.$field.Trim()) { return $s.$field.Trim() } }
        } catch { }
    }
    return $null
}

function Get-Names($conn, $list) {
    $names = @()
    foreach ($p in @($list)) { if ($p) { $n = Get-ParticipantName $conn $p; if ($n) { $names += $n } } }
    return $names
}

# Resultat : { ok, custom, players[], blue[], red[], spectators[] }  ou  { ok:false, error, message }
function Get-LobbyPlayers {
    $conn = Get-ClientConnection
    if (-not $conn) { return @{ ok = $false; error = 'client'; message = 'Client League of Legends introuvable : ouvre-le d abord.' } }
    try { $lobby = Invoke-Lcu $conn '/lol-lobby/v2/lobby' }
    catch { return @{ ok = $false; error = 'nolobby'; message = 'Aucun lobby ouvert : cree ou rejoins ta custom dans le client.' } }

    if ($Inspect) {
        '--- structure du lobby (noms des champs) ---'
        $lobby.PSObject.Properties.Name -join ', '
        'gameConfig : ' + ($lobby.gameConfig.PSObject.Properties.Name -join ', ')
        if ($lobby.members -and @($lobby.members).Count) { 'members[0] : ' + (@($lobby.members)[0].PSObject.Properties.Name -join ', ') }
        $c = $lobby.gameConfig
        if ($c.customTeam100 -and @($c.customTeam100).Count) { 'customTeam100[0] : ' + (@($c.customTeam100)[0].PSObject.Properties.Name -join ', ') }
        '---'
    }

    $cfg = $lobby.gameConfig
    $blue = Get-Names $conn $cfg.customTeam100
    $red  = Get-Names $conn $cfg.customTeam200
    $spec = Get-Names $conn $cfg.customSpectators
    $isCustom = [bool]$cfg.isCustom
    if ($blue.Count + $red.Count -gt 0) {
        $players = @($blue + $red)
    } else {
        # lobby classique (ou custom dont les equipes ne sont pas encore remplies) : tous les membres qui ne sont pas spectateurs
        $members = @($lobby.members | Where-Object { -not $_.isSpectator })
        $players = Get-Names $conn $members
        $blue = @(); $red = @()
    }
    return @{ ok = $true; custom = $isCustom; players = @($players); blue = @($blue); red = @($red); spectators = @($spec) }
}

if ($Once) { Get-LobbyPlayers | ConvertTo-Json -Depth 4; return }

# ── Mini serveur local ──
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try { $listener.Start() } catch { Write-Host "Port $Port deja utilise : l'assistant tourne probablement deja."; return }
Write-Host "Assistant lobby actif sur 127.0.0.1:$Port (ferme cette fenetre pour l'arreter)."

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
        $origin = $ctx.Request.Headers['Origin']
        $hostHeader = $ctx.Request.Headers['Host']
        $okHost = $hostHeader -in @("127.0.0.1:$Port", "localhost:$Port")
        # Seule la page du Randomizer (ouverte depuis un fichier -> Origin "null", ou depuis localhost) peut lire la reponse
        $okOrigin = (-not $origin) -or $origin -eq 'null' -or $origin -match '^http://(localhost|127\.0\.0\.1)(:\d+)?$'
        if (-not $okHost -or -not $okOrigin) { $res.StatusCode = 403 }
        elseif ($ctx.Request.Url.AbsolutePath -eq '/lobby') {
            $json = Get-LobbyPlayers | ConvertTo-Json -Depth 4
            $bytes = [Text.Encoding]::UTF8.GetBytes($json) # ConvertTo-Json laisse les caracteres tels quels : la page lit de l'UTF-8
            if ($origin) { $res.Headers.Add('Access-Control-Allow-Origin', $origin) }
            $res.ContentType = 'application/json; charset=utf-8'
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else { $res.StatusCode = 404 }
    } catch { $res.StatusCode = 500 }
    $res.Close()
}
