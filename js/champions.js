// ── Champions (Data Dragon, la base de données officielle de Riot) ──
// Liste + icônes viennent d'internet ; la liste est gardée dans le navigateur pour ne pas la retélécharger à chaque fois.
// v3 : une copie par langue (les noms des champions changent) ; chaque champion garde aussi son numéro (`key`, pour la réplique audio)
const DDRAGON_LOCALE = LANG === 'fr' ? 'fr_FR' : 'en_US';
const CHAMPIONS_KEY = `lolRandomizer.champions.v3.${DDRAGON_LOCALE}`;
const LEGACY_CHAMPIONS_KEYS = ['lolRandomizer.champions.v1', 'lolRandomizer.champions.v2']; // anciennes copies (français seulement)
const DDRAGON = 'https://ddragon.leagueoflegends.com';
// Répliques de sélection des champions (fichiers du jeu, publiés par CommunityDragon) : ils appartiennent à Riot,
// on les écoute en ligne, on ne les copie pas dans le projet.
const CHAMPION_VOICE_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-choose-vo';
const championData = { status: 'idle', version: null, list: [] }; // status : idle | loading | ready | error
let championsPromise = null;

function championIconUrl(champ) {
    return `${DDRAGON}/cdn/${championData.version}/img/champion/${encodeURIComponent(champ.id)}.png`;
}

function championVoiceUrl(champ) { return `${CHAMPION_VOICE_BASE}/${encodeURIComponent(champ.key)}.ogg`; }

// Un champion de la liste, retrouvé par son id Data Dragon (ex. 'Garen'), ou null (liste pas encore chargée, id inconnu)
function championById(id) { return championData.list.find(c => c.id === id) || null; }

function readChampionCache() {
    try {
        const c = JSON.parse(localStorage.getItem(CHAMPIONS_KEY));
        const valid = c && typeof c.version === 'string' && Array.isArray(c.list) && c.list.length >= PLAYERS_NEEDED &&
            c.list.every(x => x && typeof x.id === 'string' && typeof x.key === 'string' && Array.isArray(x.tags));
        return valid ? c : null;
    } catch (e) { return null; }
}

function writeChampionCache(version, list) {
    try {
        localStorage.setItem(CHAMPIONS_KEY, JSON.stringify({ version, list }));
        LEGACY_CHAMPIONS_KEYS.forEach(k => localStorage.removeItem(k)); // anciennes copies
    } catch (e) { /* stockage indisponible : on ignore */ }
}

async function fetchJson(url, timeoutMs = 8000) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally { clearTimeout(timer); }
}

function applyChampions(version, list) {
    championData.version = version; championData.list = list; championData.status = 'ready';
}

// Charge la liste une seule fois. Renvoie true si elle est disponible (en ligne, ou depuis la copie gardée).
function loadChampions() {
    if (championsPromise) return championsPromise;
    championData.status = 'loading'; refreshModeStatus();
    championsPromise = (async () => {
        const cached = readChampionCache();
        try {
            const version = (await fetchJson(`${DDRAGON}/api/versions.json`))[0];
            if (cached && cached.version === version) applyChampions(version, cached.list);
            else {
                const data = await fetchJson(`${DDRAGON}/cdn/${version}/data/${DDRAGON_LOCALE}/champion.json`);
                const list = Object.values(data.data)
                    .map(c => ({ id: c.id, name: c.name, key: String(c.key), tags: Array.isArray(c.tags) ? c.tags : [] }))
                    .sort((a, b) => a.name.localeCompare(b.name, LANG));
                applyChampions(version, list);
                writeChampionCache(version, list);
            }
        } catch (e) {
            if (cached) applyChampions(cached.version, cached.list); // hors ligne : on utilise la dernière liste connue
            else { championData.status = 'error'; championsPromise = null; } // pas de liste du tout : on pourra réessayer
        }
        refreshModeStatus();
        return championData.status === 'ready';
    })();
    return championsPromise;
}

// Tire `count` champions différents
function pickChampions(count) { return shuffle(championData.list).slice(0, count); }

// Charge les icônes à l'avance pour qu'elles s'affichent d'un coup à la révélation (3 s maximum d'attente)
function preloadChampionIcons(champs) {
    const loads = champs.map(c => new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = championIconUrl(c);
    }));
    return Promise.race([Promise.all(loads), wait(3000)]);
}
