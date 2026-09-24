// ── Thèmes visuels : se choisissent comme les modes et la musique (précédent / suivant / liste) ──
// Un thème change : les couleurs (variables CSS, voir css/style.css), les confettis, l'image de partage et la couleur des sons.
// sound.pitch : multiplie la hauteur de toutes les notes ; sound.waves : remplace certains timbres (voir sound.js).
const THEMES = [
    { id: 'hextech', label: t('theme.hextech.label'), description: t('theme.hextech.desc'),
      sound: { pitch: 1, waves: {} } },
    { id: 'noxus', label: t('theme.noxus.label'), description: t('theme.noxus.desc'),
      sound: { pitch: 0.84, waves: { triangle: 'sawtooth', sine: 'triangle' } } },
    { id: 'demacia', label: t('theme.demacia.label'), description: t('theme.demacia.desc'),
      sound: { pitch: 1.12, waves: { sawtooth: 'triangle', square: 'triangle' } } },
    { id: 'zaun', label: t('theme.zaun.label'), description: t('theme.zaun.desc'),
      sound: { pitch: 0.94, waves: { triangle: 'square', sine: 'sawtooth' } } },
    { id: 'shadow', label: t('theme.shadow.label'), description: t('theme.shadow.desc'),
      sound: { pitch: 0.75, waves: { sawtooth: 'sine', square: 'sine', triangle: 'sine' } } }
];
const THEME_KEY = 'lolRandomizer.theme';
let currentThemeIndex = 0;

// Valeur actuelle d'une variable CSS du thème (ex. '--gold') : sert au canvas de l'image de partage et aux confettis
function themeColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Les couleurs du thème actuel dont ont besoin les images dessinées sur un canvas (partage d'un match, récap de soirée)
function themePalette() {
    return {
        bgA: themeColor('--bg-a'), bgC: themeColor('--bg-c'), border: themeColor('--border'), light: themeColor('--gold-light'),
        gold: themeColor('--gold'), deep: themeColor('--gold-deep'), muted: themeColor('--muted'), mutedDark: themeColor('--muted-dark'),
        input: themeColor('--input-bg')
    };
}

// preview = true : le changement vient d'un clic de l'utilisateur, on joue un son pour entendre la couleur du thème
function setTheme(index, { save = true, preview = false } = {}) {
    currentThemeIndex = (index + THEMES.length) % THEMES.length;
    const theme = THEMES[currentThemeIndex];
    document.documentElement.dataset.theme = theme.id;
    sfx.setTheme(theme.sound);
    if (save) saveSetting(THEME_KEY, theme.id);

    document.getElementById('themeSelect').value = String(currentThemeIndex);
    document.getElementById('themeDescription').textContent = theme.description;
    if (preview) { sfx.unlock(); sfx.lockIn('blue'); }
}

function initThemePicker() {
    const select = document.getElementById('themeSelect');
    THEMES.forEach((theme, i) => {
        const opt = document.createElement('option');
        opt.value = String(i); opt.textContent = theme.label;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => setTheme(Number(select.value), { preview: true }));
    document.getElementById('prevThemeBtn').addEventListener('click', () => setTheme(currentThemeIndex - 1, { preview: true }));
    document.getElementById('nextThemeBtn').addEventListener('click', () => setTheme(currentThemeIndex + 1, { preview: true }));

    const saved = THEMES.findIndex(theme => theme.id === loadSetting(THEME_KEY));
    setTheme(saved >= 0 ? saved : 0, { save: false });
}
