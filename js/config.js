// ── Constantes du projet ──
const cdnBase = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/';
const roleIconUrls = {
    TOP:  cdnBase + 'icon-position-top.png',
    JGL:  cdnBase + 'icon-position-jungle.png',
    MID:  cdnBase + 'icon-position-middle.png',
    ADC:  cdnBase + 'icon-position-bottom.png',
    SUP:  cdnBase + 'icon-position-utility.png'
};
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];

// Jingles proposés pour chaque ami, joués quand il est tiré (générés par le navigateur, voir sound.js)
const JINGLES = [
    { id: 'none',     label: t('jingle.none') },
    { id: 'fanfare',  label: t('jingle.fanfare') },
    { id: 'airhorn',  label: t('jingle.airhorn') },
    { id: 'drumroll', label: t('jingle.drumroll') },
    { id: 'sad',      label: t('jingle.sad') }
];

const TEAM_SIZE = 5;
const PLAYERS_NEEDED = TEAM_SIZE * 2;
const MAX_NAME_LENGTH = 20;

// Position des cartes de noms sur assets/map3d.png (% de la largeur / hauteur de l'image).
// x = centre du pin (l'icône est déjà dessinée dans l'image), y = haut de la carte, juste sous l'icône.
const mapPositions = {
    TOP: { x: 11.5, y: 30.5 },
    JGL: { x: 24,   y: 42 },
    MID: { x: 36,   y: 53 },
    ADC: { x: 56.5, y: 74 },
    SUP: { x: 66.5, y: 74 }
};
