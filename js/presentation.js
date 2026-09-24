// ── Mode présentation : pour partager l'écran (Discord, télé) ──
// Gros textes, interface allégée : il ne reste que le tirage, les équipes et la carte, avec une petite télécommande en bas.
let presentationTimer = null;
let presentationNoticeTimer = null;

// Affiche un message d'erreur dans la télécommande (il s'efface au bout de 6 s)
function mirrorPresentationNotice(text) {
    const el = document.getElementById('presentationNotice');
    if (!el) return;
    el.textContent = text;
    clearTimeout(presentationNoticeTimer);
    if (text) presentationNoticeTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

function isPresentation() { return document.body.classList.contains('presentation'); }

// La télécommande reflète l'état de l'appli (mode, tirage en cours, revanche possible)
function refreshPresentationBar() {
    const mode = currentMode();
    document.getElementById('presentationMode').textContent = mode.label;
    const start = document.getElementById('presStartBtn');
    start.textContent = mode.startLabel; start.disabled = isRandomizing;
    const rematch = document.getElementById('presRematchBtn');
    rematch.hidden = !(currentAssignment && currentAssignment.hasRoles);
    rematch.disabled = isRandomizing;
    ['presPrevModeBtn', 'presNextModeBtn'].forEach(id => { document.getElementById(id).disabled = isRandomizing; });
    document.getElementById('presResetBtn').disabled = false;
}

function setPresentation(on) {
    document.body.classList.toggle('presentation', on);
    document.getElementById('presentationBtn').setAttribute('aria-pressed', String(on));
    clearInterval(presentationTimer);
    if (on) {
        refreshPresentationBar();
        presentationTimer = setInterval(refreshPresentationBar, 300); // simple et fiable : on relit l'état régulièrement
        window.scrollTo(0, 0);
    } else if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}

function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}

function initPresentation() {
    document.getElementById('presentationBtn').addEventListener('click', () => setPresentation(!isPresentation()));
    document.getElementById('presExitBtn').addEventListener('click', () => setPresentation(false));
    document.getElementById('presFullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('presStartBtn').addEventListener('click', startRandomizer);
    document.getElementById('presRematchBtn').addEventListener('click', startRematch);
    document.getElementById('presResetBtn').addEventListener('click', reset);
    document.getElementById('presPrevModeBtn').addEventListener('click', () => { if (!isRandomizing) setMode(currentModeIndex - 1); });
    document.getElementById('presNextModeBtn').addEventListener('click', () => { if (!isRandomizing) setMode(currentModeIndex + 1); });

    // Raccourcis : P = entrer / quitter ; Espace = lancer le tirage (en présentation). Jamais quand on tape dans un champ.
    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPresentation(!isPresentation()); }
        else if (e.key === ' ' && isPresentation() && target.tagName !== 'BUTTON' && !document.getElementById('versusOverlay').classList.contains('visible')) {
            e.preventDefault(); if (!isRandomizing) startRandomizer();
        }
    });
}
