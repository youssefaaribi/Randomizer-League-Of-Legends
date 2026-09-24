// ── Sauvegarde du roster d'amis (localStorage) ──
// Un ami : { id, name, present, prefs }  avec prefs = { TOP: 'prefer' | 'avoid', ... } (un rôle absent = neutre)
// Tout est dans un try/catch : si le navigateur bloque le stockage, l'appli marche quand même, sans sauvegarde.
const ROSTER_KEY = 'lolRandomizer.roster.v1';
const LEGACY_PLAYERS_KEY = 'lolRandomizer.players'; // ancienne version : liste de 10 noms
const SFX_KEY = 'lolRandomizer.sfx';

let roster = [];

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// jingle : effet sonore joué quand l'ami est tiré ('none' = aucun).
// voiceChampion : id Data Dragon du "champion fétiche" (ex. 'Garen') dont on joue la réplique quand aucun champion n'est tiré ; '' = aucun.
function makeFriend(name) { return { id: newId(), name, present: true, prefs: {}, jingle: 'none', voiceChampion: '' }; }

// Un jingle valide. Reprend aussi l'ancien format (intro: { text, jingle }) : la phrase de l'annonceur n'existe plus, le jingle est gardé.
function sanitizeJingle(f) {
    const wanted = typeof f.jingle === 'string' ? f.jingle : (f.intro && f.intro.jingle);
    return JINGLES.some(j => j.id === wanted) ? wanted : 'none';
}

function sanitizeFriend(f) {
    if (!f || typeof f.name !== 'string') return null;
    const name = f.name.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return null;
    const prefs = {};
    roles.forEach(role => {
        const v = f.prefs && f.prefs[role];
        if (v === 'prefer' || v === 'avoid') prefs[role] = v;
    });
    const voiceChampion = typeof f.voiceChampion === 'string' && /^[A-Za-z0-9]{1,30}$/.test(f.voiceChampion) ? f.voiceChampion : '';
    return { id: typeof f.id === 'string' && f.id ? f.id : newId(), name, present: !!f.present, prefs, jingle: sanitizeJingle(f), voiceChampion };
}

function saveRoster() {
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify({ version: 1, friends: roster })); }
    catch (e) { /* stockage indisponible : on ignore */ }
}

function loadRoster() {
    roster = [];
    try {
        const raw = localStorage.getItem(ROSTER_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.friends)) roster = data.friends.map(sanitizeFriend).filter(Boolean);
            return;
        }
        // Première ouverture depuis la mise à jour : on récupère l'ancienne liste de 10 noms
        const legacy = JSON.parse(localStorage.getItem(LEGACY_PLAYERS_KEY));
        if (Array.isArray(legacy)) {
            legacy.forEach(n => {
                const name = typeof n === 'string' ? n.trim().slice(0, MAX_NAME_LENGTH) : '';
                if (name && !roster.some(f => f.name.toLowerCase() === name.toLowerCase())) roster.push(makeFriend(name));
            });
            saveRoster();
        }
    } catch (e) { /* données absentes ou corrompues : on repart de zéro */ }
}

// Préférences du lecteur : { track: 'assets/music/xxx.mp3', volume: 0-100 }
// (la piste est retenue par son chemin, pas par sa position : ajouter des musiques ne décale rien)
const MUSIC_KEY = 'lolRandomizer.music';

function loadMusicPrefs() {
    try {
        const p = JSON.parse(localStorage.getItem(MUSIC_KEY));
        return p && typeof p === 'object' ? p : {};
    } catch (e) { return {}; }
}

function saveMusicPrefs(patch) {
    try { localStorage.setItem(MUSIC_KEY, JSON.stringify({ ...loadMusicPrefs(), ...patch })); }
    catch (e) { /* ignoré */ }
}

// Réglage texte simple (ex. le mode de jeu choisi)
function loadSetting(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function saveSetting(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignoré */ }
}

// Options activé/désactivé (effets sonores, annonceur vocal) : activées par défaut
function loadFlag(key) {
    try { return localStorage.getItem(key) !== 'off'; } catch (e) { return true; }
}
function saveFlag(key, on) {
    try { localStorage.setItem(key, on ? 'on' : 'off'); } catch (e) { /* ignoré */ }
}
