// ── Point d'entrée : initialisation + branchement des événements ──
applyTranslations();     // textes du HTML dans la langue choisie
initLanguageSwitcher();
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Roster d'amis : restauré au chargement, sauvegardé à chaque modification
loadRoster();
renderRoster();

document.getElementById('addFriendForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('newFriendName');
    if (addFriend(input.value)) input.value = '';
    input.focus();
});
document.getElementById('checkAllBtn').addEventListener('click', () => setAllPresent(true));
document.getElementById('uncheckAllBtn').addEventListener('click', () => setAllPresent(false));
document.getElementById('clearRosterBtn').addEventListener('click', clearRoster);

// Musique + effets sonores
initMusicPlayer();
document.getElementById('volume').addEventListener('input', e => setVolume(e.target.value));
const sfxToggle = document.getElementById('sfxToggle');
sfxToggle.checked = loadFlag(SFX_KEY);
sfx.setEnabled(sfxToggle.checked);
sfxToggle.addEventListener('change', () => { sfx.setEnabled(sfxToggle.checked); saveFlag(SFX_KEY, sfxToggle.checked); });

// Répliques officielles des champions (case à côté des effets sonores + petit panneau de réglages)
initChampionLineSettings();

// Tirage
document.getElementById('startBtn').addEventListener('click', startRandomizer);
document.getElementById('resetBtn').addEventListener('click', reset);
initThemePicker();
initOverlays();
initAdjustments();
initCaptains();
initHistory();
initShare();
initPresentation();

// Mode de jeu (Classique / Champions / Capitaines) : dernier réglage retrouvé, crée les slots du mode
initModePlayer();
