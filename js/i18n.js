// ── Langues : français / anglais ──
// Tous les textes affichés passent par t('clé') ; les traductions sont dans js/lang-fr.js et js/lang-en.js.
// La langue est retenue dans le navigateur (sinon : celle du navigateur). Changer de langue recharge la page :
// toutes les données (amis, historique, réglages) sont sauvegardées, donc rien ne se perd.
const LANG_KEY = 'lolRandomizer.lang';
const SUPPORTED_LANGS = ['fr', 'en'];
const I18N = {}; // rempli par lang-fr.js et lang-en.js

function detectLang() {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (e) { /* stockage indisponible */ }
    return (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const LANG = detectLang();
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-GB'; // format des dates
document.documentElement.lang = LANG;

const missingKeys = new Set();

// Texte d'une clé, avec des paramètres {nom} remplacés. Repli : français, puis la clé elle-même (visible = facile à repérer).
function t(key, params) {
    let s = I18N[LANG] && I18N[LANG][key];
    if (s === undefined) s = I18N.fr && I18N.fr[key];
    if (s === undefined) {
        if (!missingKeys.has(key)) { missingKeys.add(key); console.warn('[i18n] traduction manquante :', key); }
        return key;
    }
    return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m)) : s;
}

// Pluriel : cherche `clé.one` / `clé.other` selon les règles de la langue ({n} = le nombre)
function tp(key, n, params) {
    const rule = new Intl.PluralRules(LANG).select(n);
    const dict = I18N[LANG] || {};
    const k = dict[`${key}.${rule}`] !== undefined ? `${key}.${rule}` : `${key}.other`;
    return t(k, { n, ...params });
}

// Traduit le HTML statique : data-i18n (texte), data-i18n-html (texte avec <b>), data-i18n-title, -aria, -placeholder
function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); }); // textes du dictionnaire uniquement
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

function initLanguageSwitcher() {
    const select = document.getElementById('langSelect');
    select.value = LANG;
    select.addEventListener('change', () => {
        try { localStorage.setItem(LANG_KEY, select.value); } catch (e) { /* ignoré */ }
        location.reload();
    });
}
