// ── Ajustements après le tirage : échanger deux joueurs, relancer un poste, changer un champion ──
// currentAssignment : { blue, red, hasRoles, champions } une fois le tirage terminé, sinon null.
// Les champions sont rangés par id de joueur : ils suivent donc leur joueur quand on échange deux places.
let currentAssignment = null;
let swapFrom = null;                  // slot choisi en premier pour un échange : { side, index }
let adjusting = false;                // une animation d'ajustement est en cours
let rerolledChampions = new Set();    // ids des joueurs qui ont déjà changé de champion (1 fois chacun)
let undoStack = [];                   // états précédents, pour "Annuler" (échanges, relances, changements de champion)
let dragFrom = null;                  // slot en cours de glisser-déposer : { side, index }
const UNDO_LIMIT = 20;

function slotInfo(slotId) {
    const m = /^(blue|red)(\d)$/.exec(slotId);
    return { side: m[1], index: Number(m[2]) - 1 };
}
function slotId(pos) { return `${pos.side}${pos.index + 1}`; }
function slotEl(pos) { return document.getElementById(slotId(pos)); }
function playerAt(pos) { return currentAssignment[pos.side][pos.index]; }
function canAdjust() { return currentAssignment !== null && !isRandomizing && !adjusting; }
// Mode Capitaines : le capitaine (1er slot) reste en place
function isFixedSlot(pos) { return currentAssignment !== null && currentAssignment.captains && pos.index === 0; }

function setAdjustHint(text) { document.getElementById('adjustHintText').textContent = text; }
function defaultAdjustHint() {
    if (currentAssignment.captains) return t('adjust.hint.captains');
    if (!currentAssignment.hasRoles) return t('adjust.hint.aram');
    return t('adjust.hint.roles') + (currentAssignment.champions ? t('adjust.hint.champions') : '');
}

// ── Annuler ──
// Un état = les deux équipes, les champions et qui a déjà changé de champion. Empilé juste avant chaque changement.
function snapshotAssignment() {
    return {
        blue: [...currentAssignment.blue], red: [...currentAssignment.red],
        champions: currentAssignment.champions ? { ...currentAssignment.champions } : null,
        rerolled: new Set(rerolledChampions)
    };
}

function pushUndo(snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    updateUndoButton();
}

function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    btn.hidden = undoStack.length === 0;
    btn.textContent = undoStack.length > 1 ? t('undo.labelN', { n: undoStack.length }) : t('undo.label');
}

function undoLast() {
    if (!canAdjust() || !undoStack.length) return;
    clearSwapSelection();
    const before = snapshotAssignment(), restored = undoStack.pop();
    currentAssignment.blue = restored.blue; currentAssignment.red = restored.red;
    currentAssignment.champions = restored.champions; rerolledChampions = restored.rerolled;
    refreshAfterAdjustment();
    // On fait "pop" uniquement les slots qui ont changé
    ['blue', 'red'].forEach(side => currentAssignment[side].forEach((p, i) => {
        const changed = before[side][i].id !== p.id ||
            (currentAssignment.champions && before.champions[p.id] !== currentAssignment.champions[p.id]);
        if (changed) popSlot({ side, index: i });
    }));
    sfx.tick(0.4);
    updateUndoButton();
}

function enableAdjustments(assignment) {
    currentAssignment = {
        blue: [...assignment.blue], red: [...assignment.red],
        hasRoles: assignment.hasRoles !== false,
        captains: !!assignment.captains, // mode Capitaines : le 1er de chaque équipe est le capitaine
        rematch: !!assignment.rematch,
        champions: assignment.champions ? { ...assignment.champions } : null
    };
    document.getElementById('rematchBtn').hidden = !currentAssignment.hasRoles; // pas de revanche sans rôles (Capitaines, ARAM)
    swapFrom = null; adjusting = false; rerolledChampions = new Set(); undoStack = []; dragFrom = null;
    updateUndoButton();
    document.querySelectorAll('.slot').forEach(s => {
        if (isFixedSlot(slotInfo(s.id))) return;
        s.classList.add('adjustable'); s.tabIndex = 0; s.setAttribute('role', 'button');
        s.draggable = true; // glisser-déposer pour échanger
    });
    setAdjustHint(defaultAdjustHint());
    document.getElementById('adjustHint').classList.add('visible');
}

function disableAdjustments() {
    currentAssignment = null; swapFrom = null; adjusting = false; undoStack = []; dragFrom = null;
    updateUndoButton();
    document.querySelectorAll('.slot').forEach(s => {
        s.classList.remove('adjustable', 'swap-selected', 'dragging', 'drop-target');
        s.removeAttribute('tabindex'); s.removeAttribute('role'); s.draggable = false;
    });
    document.getElementById('adjustHint').classList.remove('visible');
}

function clearSwapSelection() {
    if (swapFrom) slotEl(swapFrom).classList.remove('swap-selected');
    swapFrom = null;
    if (currentAssignment) setAdjustHint(defaultAdjustHint());
}

// ── Mise à jour de l'affichage après un changement ──
function popSlot(pos) {
    const el = slotEl(pos);
    el.classList.remove('locked'); void el.offsetWidth; el.classList.add('locked'); // relance l'animation
}

// Données pour l'écran final, avec les avertissements à jour
function versusData() {
    return { ...currentAssignment, warnings: currentAssignment.hasRoles ? computeWarnings(currentAssignment) : [] };
}

function refreshAfterAdjustment() {
    ['blue', 'red'].forEach(side => currentAssignment[side].forEach((p, i) => {
        const pos = { side, index: i }, el = slotEl(pos);
        el.querySelector('.slot-name').textContent = p.name;
        if (currentAssignment.champions) {
            setSlotChampion(slotId(pos), currentAssignment.champions[p.id]);
            const btn = el.querySelector('.slot-champ-reroll');
            if (btn) btn.disabled = rerolledChampions.has(p.id);
        }
    }));

    let warnings = [];
    if (currentAssignment.hasRoles) {
        renderMinimapTokens(currentAssignment.blue.map(p => p.name), currentAssignment.red.map(p => p.name), true);
        recordPreviousAssignments(currentAssignment);
        warnings = computeWarnings(currentAssignment);
    }
    setDrawWarning(warnings.join(' '));
    syncCurrentMatch(currentAssignment); // l'historique garde le résultat final, échanges compris
    if (document.getElementById('versusOverlay').classList.contains('visible')) showVersusScreen(versusData());
}

// ── Échange de deux joueurs ──
function swapPlayers(a, b) {
    const pa = playerAt(a), pb = playerAt(b);
    pushUndo(snapshotAssignment());
    currentAssignment[a.side][a.index] = pb;
    currentAssignment[b.side][b.index] = pa;
    refreshAfterAdjustment();
    popSlot(a); popSlot(b);
    sfx.lockIn(a.side);
}

function handleSlotSelect(pos) {
    if (!canAdjust() || isFixedSlot(pos)) return;
    if (!swapFrom) {
        swapFrom = pos;
        slotEl(pos).classList.add('swap-selected');
        setAdjustHint(t('adjust.pick', { name: playerAt(pos).name }));
    } else if (swapFrom.side === pos.side && swapFrom.index === pos.index) {
        clearSwapSelection();
    } else {
        const first = swapFrom;
        clearSwapSelection();
        swapPlayers(first, pos);
    }
}

// ── Relance d'un seul poste : échange avec un autre joueur tiré au hasard, sans briser de règle ──
async function rerollSlot(pos) {
    if (!canAdjust() || !currentAssignment.hasRoles) return;
    clearSwapSelection();
    const current = playerAt(pos), role = roles[pos.index];

    const options = [];
    ['blue', 'red'].forEach(side => currentAssignment[side].forEach((p, i) => {
        if (side === pos.side && i === pos.index) return;
        // l'échange doit convenir aux deux : ni l'un ni l'autre ne prend un rôle qu'il veut éviter
        if (current.prefs[roles[i]] === 'avoid' || p.prefs[role] === 'avoid') return;
        options.push({ pos: { side, index: i }, player: p });
    }));
    if (!options.length) {
        setDrawWarning(t('adjust.noSwap', { role }));
        return;
    }

    const chosen = options[Math.floor(Math.random() * options.length)];
    const myDraw = drawId, cancelled = () => myDraw !== drawId || currentAssignment === null;
    const before = snapshotAssignment(); // pour "Annuler" : empilé seulement si la relance va au bout
    adjusting = true; setDrawWarning('');
    const done = await animateSlot(slotId(pos), options.map(o => o.player), chosen.player, pos.side, cancelled);
    if (!done || cancelled()) return; // Reset pendant l'animation : disableAdjustments a déjà tout remis à zéro
    adjusting = false;

    pushUndo(before);
    currentAssignment[pos.side][pos.index] = chosen.player;
    currentAssignment[chosen.pos.side][chosen.pos.index] = current;
    refreshAfterAdjustment();
    popSlot(chosen.pos); // le slot relancé a déjà eu son animation et son son
}

// ── Nouveau champion pour un joueur (une seule fois chacun) ──
async function rerollChampion(pos) {
    if (!canAdjust() || !currentAssignment.champions) return;
    const player = playerAt(pos);
    if (rerolledChampions.has(player.id)) return;
    clearSwapSelection();

    const taken = new Set(Object.values(currentAssignment.champions).map(c => c.id));
    const available = championData.list.filter(c => !taken.has(c.id)); // pas de doublon avec les autres joueurs
    if (!available.length) return;
    const chosen = available[Math.floor(Math.random() * available.length)];

    const myDraw = drawId, cancelled = () => myDraw !== drawId || currentAssignment === null;
    const before = snapshotAssignment(); // avant que le joueur soit marqué "a déjà changé de champion"
    adjusting = true; rerolledChampions.add(player.id);
    slotEl(pos).querySelector('.slot-champ-reroll').disabled = true;
    await preloadChampionIcons([chosen]);
    if (cancelled()) return;
    const done = await animateChampion(slotId(pos), chosen, cancelled);
    if (!done || cancelled()) return;
    adjusting = false;

    pushUndo(before);
    currentAssignment.champions[player.id] = chosen;
    refreshAfterAdjustment();
}

// ── Branchement des événements (une seule fois : les slots sont recréés à chaque changement de mode, donc on écoute leur conteneur) ──
function initAdjustments() {
    ['blueTeam', 'redTeam'].forEach(id => {
        const box = document.getElementById(id);
        box.addEventListener('click', e => {
            const slot = e.target.closest('.slot');
            if (!slot) return;
            const pos = slotInfo(slot.id);
            if (e.target.closest('.slot-reroll')) rerollSlot(pos);
            else if (e.target.closest('.slot-champ-reroll')) rerollChampion(pos);
            else handleSlotSelect(pos);
        });
        box.addEventListener('keydown', e => {
            const slot = e.target.closest('.slot');
            if (slot && e.target === slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleSlotSelect(slotInfo(slot.id)); }
        });

        // Glisser-déposer : on glisse un joueur sur un autre pour les échanger (à la souris ; sur téléphone : clic sur les deux)
        const clearDropTargets = () => document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
        box.addEventListener('dragstart', e => {
            const slot = e.target.closest ? e.target.closest('.slot') : null;
            const pos = slot ? slotInfo(slot.id) : null;
            if (!pos || !canAdjust() || isFixedSlot(pos)) { e.preventDefault(); return; }
            clearSwapSelection();
            dragFrom = pos; slot.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', slot.id); // requis par certains navigateurs pour démarrer le glisser
        });
        box.addEventListener('dragover', e => {
            const slot = e.target.closest('.slot');
            if (!dragFrom || !slot) return;
            const pos = slotInfo(slot.id);
            if (isFixedSlot(pos) || (pos.side === dragFrom.side && pos.index === dragFrom.index)) return;
            e.preventDefault(); // autorise le dépôt ici
            e.dataTransfer.dropEffect = 'move';
            if (!slot.classList.contains('drop-target')) { clearDropTargets(); slot.classList.add('drop-target'); }
        });
        box.addEventListener('drop', e => {
            const slot = e.target.closest('.slot');
            if (!dragFrom || !slot) return;
            e.preventDefault();
            const from = dragFrom, to = slotInfo(slot.id);
            dragFrom = null; clearDropTargets();
            document.querySelectorAll('.slot.dragging').forEach(s => s.classList.remove('dragging'));
            if (canAdjust() && !isFixedSlot(to) && !(to.side === from.side && to.index === from.index)) swapPlayers(from, to);
        });
        box.addEventListener('dragend', () => {
            dragFrom = null; clearDropTargets();
            document.querySelectorAll('.slot.dragging').forEach(s => s.classList.remove('dragging'));
        });
    });
    document.getElementById('undoBtn').addEventListener('click', undoLast);
    document.addEventListener('keydown', e => { // Ctrl+Z (ou Cmd+Z), sauf quand on tape dans un champ
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing && currentAssignment) { e.preventDefault(); undoLast(); }
    });
    document.getElementById('rematchBtn').addEventListener('click', startRematch);
    document.getElementById('showVersusBtn').addEventListener('click', () => {
        if (currentAssignment) showVersusScreen(versusData());
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') clearSwapSelection(); });
}
