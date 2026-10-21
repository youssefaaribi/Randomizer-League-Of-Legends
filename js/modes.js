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
    },
    {
        // ARAM : deux équipes tirées au hasard, sans rôles ni lanes (c'est le jeu qui donne les champions)
        id: 'aram', label: t('mode.aram.label'), startLabel: t('mode.aram.start'),
        description: t('mode.aram.desc'),
        roles: false, champions: false, captains: false
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

// Le mode (et le format) ne changent pas pendant un tirage
function setModeControlsDisabled(disabled) {
    ['modeSelect', 'prevModeBtn', 'nextModeBtn', 'formatSelect', 'prevFormatBtn', 'nextFormatBtn']
        .forEach(id => { document.getElementById(id).disabled = disabled; });
}

// ── Format de la partie : 5v5 / 4v4 / 3v3 (le changement recharge la page, comme la langue : tout est sauvegardé) ──
function initFormatPicker() {
    const sizes = Object.keys(TEAM_FORMATS).map(Number).sort((a, b) => b - a); // 5, 4, 3
    const select = document.getElementById('formatSelect');
    sizes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = String(n); opt.textContent = t('format.option', { size: n });
        select.appendChild(opt);
    });
    select.value = String(TEAM_SIZE);
    document.getElementById('formatDescription').textContent =
        t('format.desc', { n: PLAYERS_NEEDED, roles: roles.join(' · ') });

    const change = size => {
        if (size === TEAM_SIZE) return;
        saveSetting(TEAM_SIZE_KEY, String(size));
        location.reload();
    };
    select.addEventListener('change', () => change(Number(select.value)));
    const shift = step => change(sizes[(sizes.indexOf(TEAM_SIZE) + step + sizes.length) % sizes.length]);
    document.getElementById('prevFormatBtn').addEventListener('click', () => shift(-1));
    document.getElementById('nextFormatBtn').addEventListener('click', () => shift(1));
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

    updateRosterSummary(); // l'avertissement "trop peu de joueurs pour un rôle" n'a de sens que dans les modes avec rôles
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
