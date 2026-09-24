// ── Modes de jeu : se choisissent comme la musique (précédent / suivant / liste) ──
const GAME_MODES = [
    {
        id: 'classic', label: t('mode.classic.label'), startLabel: t('mode.classic.start'),
        description: t('mode.classic.desc'),
        roles: true, champions: false, captains: false
    },
    {
        id: 'champions', label: t('mode.champions.label'), startLabel: t('mode.champions.start'),
        description: t('mode.champions.desc'),
        roles: true, champions: true, captains: false
    },
    {
        id: 'captains', label: t('mode.captains.label'), startLabel: t('mode.captains.start'),
        description: t('mode.captains.desc'),
        roles: false, champions: false, captains: true
    }
];
const MODE_KEY = 'lolRandomizer.mode';
let currentModeIndex = 0;

function currentMode() { return GAME_MODES[currentModeIndex]; }

function setModeStatus(text, kind = 'info') {
    const el = document.getElementById('modeStatus');
    el.textContent = text;
    el.className = 'mode-status' + (text ? ' ' + kind : '');
    if (kind === 'error') mirrorPresentationNotice(text);
}

// Message sous le sélecteur : l'état du chargement des champions, uniquement dans le mode qui en a besoin
function refreshModeStatus() {
    if (!currentMode().champions) { setModeStatus(''); return; }
    if (championData.status === 'ready') setModeStatus(t('mode.status.ready', { n: championData.list.length, v: championData.version }), 'ok');
    else if (championData.status === 'loading') setModeStatus(t('champions.loading'), 'info');
    else if (championData.status === 'error') setModeStatus(t('champions.error'), 'error');
    else setModeStatus('');
}

// Le mode ne change pas pendant un tirage
function setModeControlsDisabled(disabled) {
    ['modeSelect', 'prevModeBtn', 'nextModeBtn'].forEach(id => { document.getElementById(id).disabled = disabled; });
}

function setMode(index, save = true) {
    currentModeIndex = (index + GAME_MODES.length) % GAME_MODES.length;
    const mode = currentMode();
    if (save) saveSetting(MODE_KEY, mode.id);

    document.body.dataset.mode = mode.id;
    generateSlots();  // les slots dépendent du mode (rôles, champions, capitaines)
    resetDraw(true);  // on efface le résultat précédent, mais la musique continue

    document.getElementById('modeSelect').value = String(currentModeIndex);
    document.getElementById('modeDescription').textContent = mode.description;
    document.getElementById('startBtn').textContent = mode.startLabel;
    document.getElementById('captainOptions').classList.toggle('visible', mode.captains);
    renderCaptainOptions();

    refreshModeStatus();
    if (mode.champions) loadChampions(); // on prépare la liste dès qu'on choisit le mode
}

function initModePlayer() {
    const select = document.getElementById('modeSelect');
    GAME_MODES.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i); opt.textContent = m.label;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => setMode(Number(select.value)));
    document.getElementById('prevModeBtn').addEventListener('click', () => setMode(currentModeIndex - 1));
    document.getElementById('nextModeBtn').addEventListener('click', () => setMode(currentModeIndex + 1));

    const saved = GAME_MODES.findIndex(m => m.id === loadSetting(MODE_KEY));
    setMode(saved >= 0 ? saved : 0, false);
}
