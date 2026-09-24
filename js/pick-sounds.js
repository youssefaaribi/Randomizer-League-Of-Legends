// ── Sons d'un pick : le jingle de l'ami, puis la réplique officielle du champion ──
// La réplique est l'audio du jeu (réplique de sélection du champion, publiée par CommunityDragon) : elle appartient à Riot,
// on l'écoute en ligne et on ne la copie pas dans le projet. La vraie voix d'un champion ne peut pas dire un pseudo :
// on joue donc sa réplique habituelle quand le joueur est tiré.
const CHAMPION_LINE_KEY = 'lolRandomizer.championLine';
const OLD_VOICE_SETTINGS_KEY = 'lolRandomizer.voiceSettings'; // réglages de l'ancien annonceur vocal (supprimé)
const OLD_VOICE_FLAG_KEY = 'lolRandomizer.voice';

const championLine = (() => {
    // Une réplique dure 6 s au maximum (la plus longue en fait plus de 10 s), avec un fondu de sortie ;
    // si elle ne démarre pas en 3,5 s (connexion lente), on passe à la suite.
    const START_TIMEOUT_MS = 3500, FADE_AT_MS = 5500, FADE_MS = 500, ABSOLUTE_MAX_MS = 9000, VOLUME = 0.9;
    let active = 0;
    const playing = new Set(); // répliques en cours (pour pouvoir les couper)

    // Réglages : enabled (jouer les répliques) ; fallback = quel champion utiliser quand aucun n'est tiré
    // ('none' | 'favorite' = le champion fétiche de l'ami | 'random')
    function normalize(s) {
        return { enabled: s.enabled === true, fallback: ['none', 'favorite', 'random'].includes(s.fallback) ? s.fallback : 'none' };
    }
    function readSettings() {
        try { const s = JSON.parse(loadSetting(CHAMPION_LINE_KEY)); if (s) return normalize(s); } catch (e) { /* absent ou corrompu */ }
        // Première ouverture après la suppression de l'annonceur : on reprend ce qui concernait les répliques
        try {
            const old = JSON.parse(loadSetting(OLD_VOICE_SETTINGS_KEY));
            if (old) return normalize({ enabled: old.championLine === true, fallback: old.championFallback });
        } catch (e) { /* absent ou corrompu */ }
        return normalize({});
    }
    const settings = readSettings();
    saveSetting(CHAMPION_LINE_KEY, JSON.stringify(settings)); // on enregistre AVANT de supprimer les anciens réglages
    try { localStorage.removeItem(OLD_VOICE_SETTINGS_KEY); localStorage.removeItem(OLD_VOICE_FLAG_KEY); } catch (e) { /* ignoré */ }

    // La musique baisse pendant une réplique, puis remonte
    function begin() { if (active++ === 0) duckMusic(true); }
    function end() { if (--active === 0) duckMusic(false); }

    return {
        isEnabled() { return settings.enabled; },
        getSettings() { return { ...settings }; },
        updateSettings(patch) {
            Object.assign(settings, normalize({ ...settings, ...patch }));
            saveSetting(CHAMPION_LINE_KEY, JSON.stringify(settings));
        },

        // Joue un fichier audio. Résolue à la fin, ou tout de suite si le fichier est introuvable (hors ligne) :
        // le tirage continue alors normalement. force = true : joue même si les répliques sont désactivées (boutons "Tester").
        play(url, { force = false } = {}) {
            return new Promise(resolve => {
                if (!settings.enabled && !force) { resolve(); return; }
                const audio = new Audio(url);
                audio.volume = VOLUME;

                let done = false, started = false, fadeTimer = null, fadeStep = null;
                const line = { stop: () => finish() };
                const finish = () => {
                    if (done) return; done = true;
                    clearTimeout(startTimer); clearTimeout(fadeTimer); clearInterval(fadeStep); clearTimeout(absoluteTimer);
                    playing.delete(line);
                    audio.pause(); end(); resolve();
                };
                // Fondu de sortie sur la dernière demi-seconde, puis arrêt
                const startFade = () => {
                    const t0 = performance.now();
                    fadeStep = setInterval(() => {
                        const k = 1 - (performance.now() - t0) / FADE_MS;
                        if (k <= 0) finish(); else audio.volume = VOLUME * k;
                    }, 40);
                };
                const startTimer = setTimeout(() => { if (!started) finish(); }, START_TIMEOUT_MS);
                const absoluteTimer = setTimeout(finish, ABSOLUTE_MAX_MS);
                begin(); playing.add(line);
                audio.onplaying = () => { if (started) return; started = true; fadeTimer = setTimeout(startFade, FADE_AT_MS); };
                audio.onended = finish; audio.onerror = finish;
                const p = audio.play();
                if (p && p.catch) p.catch(finish); // lecture refusée : on passe à la suite
            });
        },

        // Coupe tout de suite la réplique en cours (Reset, nouveau tirage)
        cancel() { [...playing].forEach(l => l.stop()); }
    };
})();

function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }

// Le champion dont on joue la réplique : celui que le joueur a tiré (mode Champions), sinon (modes sans champion) selon le réglage
// "sans champion tiré" : son champion fétiche, ou un champion au hasard. null = pas de réplique.
async function resolveLineChampion(player, drawn) {
    if (drawn) return drawn;
    const fallback = championLine.getSettings().fallback;
    if (fallback === 'none') return null;
    if (!championData.list.length && !(await loadChampions())) return null; // hors ligne et sans copie : pas de réplique
    if (fallback === 'favorite') return player.voiceChampion ? championById(player.voiceChampion) : null;
    return randomItem(championData.list);
}

async function playChampionLineFor(player, drawn = null) {
    if (!championLine.isEnabled()) return;
    const champ = await resolveLineChampion(player, drawn);
    if (champ) await championLine.play(championVoiceUrl(champ));
}

// Jingle de l'ami : un effet sonore, donc soumis à la case "Effets sonores" (durée 0 s si coupée ou si l'ami n'en a pas)
async function playJingleFor(player) {
    if (player.jingle && player.jingle !== 'none') await wait(sfx.jingle(player.jingle));
}

// Tout ce qui se joue quand un joueur est tiré : son jingle, puis la réplique de son champion
async function playPickSounds(player, drawnChampion = null) {
    await playJingleFor(player);
    await playChampionLineFor(player, drawnChampion);
}

// Bouton "Tester" de l'éditeur d'un ami : son jingle, puis la réplique de son champion fétiche (même si les répliques sont désactivées)
async function testPickSounds(friend) {
    championLine.cancel();
    await playJingleFor(friend);
    const champ = friend.voiceChampion ? championById(friend.voiceChampion) : null;
    if (champ) await championLine.play(championVoiceUrl(champ), { force: true });
}

// ── Réglages des répliques (case à côté des effets sonores + petit panneau) ──
function initChampionLineSettings() {
    const s = championLine.getSettings();
    const toggle = document.getElementById('championLineToggle'), fallback = document.getElementById('championFallback');
    toggle.checked = s.enabled; fallback.value = s.fallback;
    toggle.addEventListener('change', () => { championLine.updateSettings({ enabled: toggle.checked }); if (!toggle.checked) championLine.cancel(); });
    fallback.addEventListener('change', () => championLine.updateSettings({ fallback: fallback.value }));

    // Test avec un champion au choix. La liste se charge à l'ouverture du panneau (pas au démarrage de la page).
    const details = document.getElementById('championLineSettings');
    const testSel = document.getElementById('championTestSelect'), info = document.getElementById('championTestInfo');
    let filled = false;
    details.addEventListener('toggle', async () => {
        if (!details.open || filled) return;
        info.textContent = t('champions.loading');
        if (!await loadChampions()) { info.textContent = t('line.test.unavailable'); return; }
        filled = true; info.textContent = '';
        testSel.innerHTML = '';
        championData.list.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id; opt.textContent = c.name;
            testSel.appendChild(opt);
        });
        testSel.value = championById('Garen') ? 'Garen' : championData.list[0].id;
    });
    document.getElementById('championTestBtn').addEventListener('click', () => {
        const c = championById(testSel.value);
        if (!c) return;
        championLine.cancel(); championLine.play(championVoiceUrl(c), { force: true });
    });
}
