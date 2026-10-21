function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Nom affiché d'une équipe. En interne les côtés restent 'blue' / 'red' (ids, couleurs, historique) ; à l'écran : Team 1 / Team 2.
function teamName(side) { return t('team.' + side); }

// ── Bouton "Passer la cinématique" ──
// Pendant un tirage, toutes les animations et pauses s'arrêtent d'un coup (skipTimeout / skippableWait / orSkip) :
// les joueurs, rôles et champions s'affichent directement. Le résultat du tirage, lui, est déjà décidé : rien ne change.
let skipDraw = false;
const skipWaiters = new Set(); // ce qui attend en ce moment et doit être réveillé par le skip

function requestSkipDraw() {
    skipDraw = true;
    championLine.cancel(); // coupe la réplique de champion en cours
    [...skipWaiters].forEach(wake => wake());
    skipWaiters.clear();
}
function resetSkipDraw() { skipDraw = false; skipWaiters.clear(); }

// Comme setTimeout, mais s'exécute tout de suite si on passe la cinématique
function skipTimeout(fn, ms) {
    if (skipDraw) { fn(); return; }
    const run = () => { clearTimeout(timer); skipWaiters.delete(run); fn(); };
    const timer = setTimeout(run, ms);
    skipWaiters.add(run);
}
function skippableWait(ms) { return new Promise(resolve => skipTimeout(resolve, ms)); }
// Attend `promise`, sauf si on passe la cinématique (ex. un jingle ou une réplique qui ne doit plus retarder le tirage)
function orSkip(promise) {
    if (skipDraw) return Promise.resolve();
    return Promise.race([promise, new Promise(resolve => skipWaiters.add(resolve))]);
}

// Pause du tirage : suit la vitesse choisie (DRAW_SPEED dans config.js) et s'arrête au skip
function drawWait(ms) { return skippableWait(ms / DRAW_SPEED); }
