// ── Constantes du projet ──
const cdnBase = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/';
const roleIconUrls = {
    TOP:  cdnBase + 'icon-position-top.png',
    JGL:  cdnBase + 'icon-position-jungle.png',
    MID:  cdnBase + 'icon-position-middle.png',
    ADC:  cdnBase + 'icon-position-bottom.png',
    SUP:  cdnBase + 'icon-position-utility.png'
};
const ALL_ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];

// Formats de partie : taille d'équipe → rôles joués (l'ordre = l'ordre des postes à l'écran et sur la carte).
// Pour changer les rôles d'un format, c'est ici et nulle part ailleurs.
const TEAM_FORMATS = {
    5: ['TOP', 'JGL', 'MID', 'ADC', 'SUP'],
    4: ['TOP', 'JGL', 'MID', 'ADC'],
    3: ['TOP', 'MID', 'ADC']
};
const TEAM_SIZE_KEY = 'lolRandomizer.teamSize';

// Le format se règle avec le sélecteur "Format" (le changement recharge la page, comme la langue : tout est sauvegardé)
function loadTeamSize() {
    try {
        const saved = Number(localStorage.getItem(TEAM_SIZE_KEY));
        if (TEAM_FORMATS[saved]) return saved;
    } catch (e) { /* stockage indisponible : 5v5 */ }
    return 5;
}

// Jingles proposés pour chaque ami, joués quand il est tiré (générés par le navigateur, voir sound.js)
const JINGLES = [
    { id: 'none',     label: t('jingle.none') },
    { id: 'fanfare',  label: t('jingle.fanfare') },
    { id: 'airhorn',  label: t('jingle.airhorn') },
    { id: 'drumroll', label: t('jingle.drumroll') },
    { id: 'sad',      label: t('jingle.sad') }
];

const TEAM_SIZE = loadTeamSize();
const PLAYERS_NEEDED = TEAM_SIZE * 2;
const roles = TEAM_FORMATS[TEAM_SIZE]; // les rôles de la partie en cours
const MAX_NAME_LENGTH = 20;
const MAX_LOL_NAME_LENGTH = 40; // pseudo LoL retenu pour reconnaître un ami importé (même renommé)

// Vitesse du tirage (roulettes + pauses entre deux joueurs) : 1 = vitesse d'origine, 2 = deux fois plus vite.
// Le compte à rebours, les jingles et les répliques de champions ne changent pas.
const DRAW_SPEED = 2;

// Position des cartes de noms sur assets/map3d.png (% de la largeur / hauteur de l'image).
// x = centre du pin (l'icône est déjà dessinée dans l'image), y = haut de la carte, juste sous l'icône.
const mapPositions = {
    TOP: { x: 11.5, y: 30.5 },
    JGL: { x: 24,   y: 42 },
    MID: { x: 36,   y: 53 },
    ADC: { x: 56.5, y: 74 },
    SUP: { x: 66.5, y: 74 }
};
