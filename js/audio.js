// ── Lecteur de musique (playlist générée dans js/playlist.js) ──
const bgMusic = document.getElementById('bgMusic');
const tracks = typeof musicTracks !== 'undefined' ? musicTracks : [];
let isPlaying = false;
let currentTrack = 0;

function setVolume(percent) {
    bgMusic.volume = percent / 100;
    saveMusicPrefs({ volume: Number(percent) });
}

// Baisse la musique pendant que l'annonceur parle, puis la remet au niveau du curseur de volume
function duckMusic(on) {
    const level = Number(document.getElementById('volume').value) / 100;
    bgMusic.volume = on ? level * 0.35 : level;
}

// Encode chaque morceau du chemin : les noms avec espaces, #, ?, accents ou [ ] restent lisibles par le navigateur
function trackUrl(track) { return track.file.split('/').map(encodeURIComponent).join('/'); }

function updateMusicUI() {
    const btn = document.getElementById('musicBtn');
    btn.textContent = isPlaying ? '⏸' : '▶';
    btn.title = t(isPlaying ? 'music.pause' : 'music.play');
    btn.setAttribute('aria-label', btn.title);
    document.getElementById('trackSelect').value = String(currentTrack);
}

function setMusicStatus(text) { document.getElementById('musicStatus').textContent = text; }

// Charge une piste (sans la lancer)
function loadTrack(index) {
    if (!tracks.length) return;
    currentTrack = (index + tracks.length) % tracks.length;
    bgMusic.src = trackUrl(tracks[currentTrack]);
    bgMusic.loop = tracks.length === 1; // une seule piste : on la boucle ; sinon, on enchaîne avec la suivante
    saveMusicPrefs({ track: tracks[currentTrack].file });
    setMusicStatus(''); // on efface un éventuel message d'erreur de la piste précédente
    updateMusicUI();
}

function playMusic() {
    if (!tracks.length) return;
    isPlaying = true; updateMusicUI();
    // play() peut être refusé (autoplay bloqué, fichier introuvable) : on remet l'état à jour
    bgMusic.play().catch(() => { isPlaying = false; updateMusicUI(); });
}

function pauseMusic() { bgMusic.pause(); isPlaying = false; updateMusicUI(); }

function toggleMusic() { if (isPlaying) pauseMusic(); else playMusic(); }

// Précédente / suivante : on lance toujours la lecture
function changeTrack(delta) {
    if (!tracks.length) return;
    loadTrack(currentTrack + delta);
    playMusic();
}

function initMusicPlayer() {
    const select = document.getElementById('trackSelect');
    const controls = ['prevBtn', 'musicBtn', 'nextBtn'].map(id => document.getElementById(id));

    if (!tracks.length) {
        select.innerHTML = `<option>${t('music.none')}</option>`;
        select.disabled = true; controls.forEach(b => { b.disabled = true; });
        return;
    }

    tracks.forEach((track, i) => {
        const opt = document.createElement('option');
        opt.value = String(i); opt.textContent = track.title; // textContent : un titre avec < > reste du texte
        select.appendChild(opt);
    });

    // Volume et piste de la dernière fois
    const prefs = loadMusicPrefs();
    const volume = typeof prefs.volume === 'number' ? prefs.volume : 50;
    bgMusic.volume = volume / 100;
    document.getElementById('volume').value = volume;
    const savedIndex = tracks.findIndex(track => track.file === prefs.track);
    loadTrack(savedIndex >= 0 ? savedIndex : 0);

    document.getElementById('prevBtn').addEventListener('click', () => changeTrack(-1));
    document.getElementById('nextBtn').addEventListener('click', () => changeTrack(1));
    document.getElementById('musicBtn').addEventListener('click', toggleMusic);
    select.addEventListener('change', () => { loadTrack(Number(select.value)); if (isPlaying) playMusic(); });

    bgMusic.addEventListener('ended', () => changeTrack(1)); // fin de piste : suivante (playlist bouclée)
    bgMusic.addEventListener('error', () => {
        isPlaying = false;
        updateMusicUI();
        setMusicStatus(t('music.notFound'));
    });
}
