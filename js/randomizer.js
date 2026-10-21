// ── Logique du tirage ──
// Un joueur est un ami du roster : { id, name, present, prefs }.
// Un résultat ("assignment") : { blue: [TEAM_SIZE joueurs], red: [TEAM_SIZE joueurs], warnings: [], hasRoles: bool, champions: { idJoueur: champion } | absent }
let players = [], remainingPlayers = [], blueTeam = [], redTeam = [];
let isRandomizing = false;
let previousAssignments = {}; // id du joueur → rôle du tirage précédent
let drawId = 0;               // change à chaque tirage/reset : permet d'annuler un tirage en cours

// Un placement est valide si personne n'est sur un rôle "à éviter" (et, si demandé, ne retrouve pas son rôle précédent).
// Renvoie le nombre de joueurs sur un rôle "préféré", ou -1 si le placement est invalide.
function evaluateAssignment(blue, red, avoidRepeat) {
    let liked = 0;
    for (let i = 0; i < TEAM_SIZE; i++) {
        for (const p of [blue[i], red[i]]) {
            if (p.prefs[roles[i]] === 'avoid') return -1;
            if (avoidRepeat && previousAssignments[p.id] === roles[i]) return -1;
            if (p.prefs[roles[i]] === 'prefer') liked++;
        }
    }
    return liked;
}

// Tire au hasard parmi les placements valides. Les rôles préférés sont favorisés (poids 3^nb de préférés respectés)
// sans être garantis : il reste du hasard.
function collectCandidates(list, avoidRepeat) {
    const found = [];
    for (let attempt = 0; attempt < 20000 && found.length < 400; attempt++) {
        const s = shuffle(list), blue = s.slice(0, TEAM_SIZE), red = s.slice(TEAM_SIZE);
        const liked = evaluateAssignment(blue, red, avoidRepeat);
        if (liked >= 0) found.push({ blue, red, weight: Math.pow(3, liked) });
    }
    return found;
}

function weightedPick(candidates) {
    let r = Math.random() * candidates.reduce((sum, c) => sum + c.weight, 0);
    for (const c of candidates) { r -= c.weight; if (r <= 0) return c; }
    return candidates[candidates.length - 1];
}

function generateAssignment(list) {
    // 1) idéal : aucun rôle évité, et personne ne retrouve son rôle précédent
    // 2) sinon : on autorise de retrouver son rôle précédent
    for (const avoidRepeat of [true, false]) {
        const candidates = collectCandidates(list, avoidRepeat);
        if (candidates.length) { const c = weightedPick(candidates); return { blue: c.blue, red: c.red, warnings: [], hasRoles: true }; }
    }
    // 3) contraintes impossibles : on prend le placement qui brise le moins de règles, et on prévient
    let best = null, bestBroken = Infinity;
    for (let attempt = 0; attempt < 3000; attempt++) {
        const s = shuffle(list), blue = s.slice(0, TEAM_SIZE), red = s.slice(TEAM_SIZE);
        let broken = 0;
        for (let i = 0; i < TEAM_SIZE; i++) [blue[i], red[i]].forEach(p => { if (p.prefs[roles[i]] === 'avoid') broken++; });
        if (broken < bestBroken) { best = { blue, red }; bestBroken = broken; }
    }
    return { blue: best.blue, red: best.red, warnings: computeWarnings(best), hasRoles: true };
}

// Mode ARAM : aucune règle, juste deux équipes au hasard (ni rôles ni lanes)
function generateNoRoleAssignment(list) {
    const s = shuffle(list);
    return { blue: s.slice(0, TEAM_SIZE), red: s.slice(TEAM_SIZE), warnings: [], hasRoles: false };
}

// Joueurs placés sur un rôle "à éviter" (tirage impossible à satisfaire, ou échange manuel)
function computeWarnings(assignment) {
    const warnings = [];
    for (let i = 0; i < TEAM_SIZE; i++) [assignment.blue[i], assignment.red[i]].forEach(p => {
        if (p.prefs[roles[i]] === 'avoid') warnings.push(t('warn.avoid', { name: p.name, role: roles[i] }));
    });
    return warnings;
}

// Mémorise le rôle de chacun, pour ne pas le lui redonner au tirage suivant
function recordPreviousAssignments(assignment) {
    previousAssignments = {};
    for (let i = 0; i < TEAM_SIZE; i++) {
        previousAssignments[assignment.blue[i].id] = roles[i];
        previousAssignments[assignment.red[i].id] = roles[i];
    }
}

// ── Revanche : mêmes équipes, mêmes joueurs, seuls les rôles sont retirés au sort dans chaque équipe ──
// Toutes les façons de répartir les rôles entre les joueurs d'une équipe : perm[i] = numéro du joueur qui prend le rôle i
const ROLE_PERMUTATIONS = (() => {
    const all = [];
    const build = (rest, acc) => {
        if (!rest.length) { all.push(acc); return; }
        rest.forEach((v, i) => build([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, v]));
    };
    build(Array.from({ length: TEAM_SIZE }, (_, i) => i), []);
    return all;
})();

// Même logique que le tirage classique, mais sur une seule équipe : rôle "à éviter" interdit, rôle "préféré" favorisé,
// et (si avoidRepeat) personne ne garde le rôle qu'il vient de jouer. Renvoie l'équipe rangée par rôle, ou null.
function arrangeTeam(team, avoidRepeat) {
    const candidates = [];
    ROLE_PERMUTATIONS.forEach(perm => {
        let liked = 0, ok = true;
        for (let i = 0; i < TEAM_SIZE && ok; i++) {
            const p = team[perm[i]];
            if (p.prefs[roles[i]] === 'avoid') ok = false;
            else if (avoidRepeat && previousAssignments[p.id] === roles[i]) ok = false;
            else if (p.prefs[roles[i]] === 'prefer') liked++;
        }
        if (ok) candidates.push({ arranged: perm.map(k => team[k]), weight: Math.pow(3, liked) });
    });
    return candidates.length ? weightedPick(candidates).arranged : null;
}

// Règles impossibles à respecter : on garde la répartition qui en brise le moins (le résultat est signalé par computeWarnings)
function arrangeTeamBestEffort(team) {
    let best = [], bestBroken = Infinity;
    ROLE_PERMUTATIONS.forEach(perm => {
        let broken = 0;
        for (let i = 0; i < TEAM_SIZE; i++) if (team[perm[i]].prefs[roles[i]] === 'avoid') broken++;
        if (broken < bestBroken) { best = [perm]; bestBroken = broken; } else if (broken === bestBroken) best.push(perm);
    });
    return pickRandom(best).map(k => team[k]);
}

function generateRematchAssignment(previous) {
    const arranged = {};
    ['blue', 'red'].forEach(side => {
        arranged[side] = arrangeTeam(previous[side], true) || arrangeTeam(previous[side], false) || arrangeTeamBestEffort(previous[side]);
    });
    const result = { blue: arranged.blue, red: arranged.red, hasRoles: true, rematch: true, warnings: [] };
    result.warnings = computeWarnings(result);
    return result;
}

// Un champion différent pour chaque joueur : { idJoueur: champion }
function assignChampions(assignment) {
    const picked = pickChampions(PLAYERS_NEEDED), byPlayer = {};
    [...assignment.blue, ...assignment.red].forEach((p, i) => { byPlayer[p.id] = picked[i]; });
    return byPlayer;
}

// ── Début et fin communs à tous les modes ──
// Renvoie la liste des joueurs présents, ou null (avec un message) s'il n'y en a pas exactement PLAYERS_NEEDED (10, 8 ou 6)
function validatePresent() {
    const present = getPresentPlayers();
    if (present.length === PLAYERS_NEEDED) return present;
    const diff = present.length - PLAYERS_NEEDED;
    showRosterNotice(diff < 0
        ? t('roster.missing', { max: PLAYERS_NEEDED, n: -diff })
        : t('roster.tooMany', { max: PLAYERS_NEEDED, n: diff }), 'error');
    document.getElementById('rosterCount').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
}

function lockDrawUi() {
    isRandomizing = true; document.getElementById('startBtn').disabled = true; setModeControlsDisabled(true);
    document.body.classList.add('drawing'); // affiche le bouton "Passer la cinématique"
}
function unlockDrawUi() {
    isRandomizing = false; document.getElementById('startBtn').disabled = false; setModeControlsDisabled(false);
    document.body.classList.remove('drawing');
}

// Prépare l'écran : tout est remis à zéro, la musique démarre
function beginDraw(present) {
    document.getElementById('minimapSection').classList.remove('visible');
    hideVersusScreen(); setDrawWarning('');
    disableAdjustments(); championLine.cancel();
    sfx.unlock();
    players = [...present]; blueTeam = []; redTeam = [];
    // Réplique d'un champion sans champion tiré : la liste doit être prête quand le 1er joueur est tiré
    const line = championLine.getSettings();
    if (line.enabled && line.fallback !== 'none') loadChampions();
    resetSlots(); setTurn(null);
    setPickLabel(t('draw.ready')); setCurrentPick('');
    if (!isPlaying) toggleMusic();
    document.getElementById('drawArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function finishDraw(assignment, cancelled) {
    const hasRoles = assignment.hasRoles !== false;
    if (hasRoles) recordPreviousAssignments(assignment);

    setTurn(null);
    setPickLabel(assignment.rematch ? t('draw.done.rematch') : t('draw.done'));
    setCurrentPick(t('draw.glhf'));
    setDrawWarning(assignment.warnings.join(' '));
    launchConfetti();
    sfx.fanfare();

    const delay = skipDraw ? 0 : 600; // cinématique passée : l'écran final s'affiche tout de suite
    resetSkipDraw();
    setTimeout(() => {
        if (cancelled()) return;
        if (hasRoles) renderMinimapTokens(assignment.blue.map(p => p.name), assignment.red.map(p => p.name));
        showVersusScreen(assignment);
    }, delay);

    unlockDrawUi();
    enableAdjustments(assignment); // échanger deux joueurs / relancer un poste
    recordMatch(assignment);       // historique : on indiquera le vainqueur plus tard
}

// ── Point d'entrée du bouton "Lancer" : dépend du mode choisi ──
async function startRandomizer() {
    if (isRandomizing) return;
    const present = validatePresent();
    if (!present) return;
    const mode = currentMode();
    if (mode.captains && !validateCaptainChoices()) return;

    const myDraw = ++drawId, cancelled = () => myDraw !== drawId;
    resetSkipDraw();
    lockDrawUi();

    if (mode.champions) { // il faut la liste des champions avant de commencer
        const ok = await loadChampions();
        if (cancelled()) return;
        if (!ok) { refreshModeStatus(); unlockDrawUi(); return; }
    }

    if (mode.captains) await runCaptainsDraw(present, cancelled);
    else await runRoleDraw(present, mode, cancelled);
}

// Bouton "Revanche" : mêmes équipes, rôles remélangés (et de nouveaux champions dans le mode Champions)
async function startRematch() {
    if (isRandomizing || !currentAssignment || !currentAssignment.hasRoles) return;
    const mode = currentMode();
    const rematch = generateRematchAssignment(currentAssignment);
    const everyone = [...currentAssignment.blue, ...currentAssignment.red];

    const myDraw = ++drawId, cancelled = () => myDraw !== drawId;
    resetSkipDraw();
    lockDrawUi();
    if (mode.champions) {
        const ok = await loadChampions();
        if (cancelled()) return;
        if (!ok) { refreshModeStatus(); unlockDrawUi(); return; }
    }
    await runRoleDraw(everyone, mode, cancelled, rematch);
}

// ── Modes "Classique" et "Champions au hasard" : équipes + rôles (+ un champion par joueur) ──
// forcedAssignment : répartition déjà décidée (revanche) ; sinon elle est tirée au hasard
async function runRoleDraw(present, mode, cancelled, forcedAssignment = null) {
    const assignment = forcedAssignment || (mode.roles ? generateAssignment(present) : generateNoRoleAssignment(present));
    if (mode.champions) {
        assignment.champions = assignChampions(assignment);
        await orSkip(preloadChampionIcons(Object.values(assignment.champions)));
        if (cancelled()) return;
    }

    beginDraw(present);
    remainingPlayers = shuffle([...assignment.blue, ...assignment.red]);
    updateRemainingPool(players, remainingPlayers);

    await runCountdown(cancelled, assignment.rematch ? t('count.rematch') : t('count.teams'));
    if (cancelled()) return;

    // Ordre des picks : Blue puis Red, poste par poste
    const picks = [];
    roles.forEach((role, i) => {
        const place = assignment.hasRoles === false ? `#${i + 1}` : role; // ARAM : pas de rôle, juste un numéro
        picks.push({ slot: `blue${i + 1}`, team: blueTeam, side: 'blue', role, label: `🔵 ${teamName('blue').toUpperCase()} - ${place}`, player: assignment.blue[i] });
        picks.push({ slot: `red${i + 1}`,  team: redTeam,  side: 'red',  role, label: `🔴 ${teamName('red').toUpperCase()} - ${place}`,  player: assignment.red[i] });
    });

    for (const pick of picks) {
        setPickLabel(pick.label);
        if (!await animateSlot(pick.slot, remainingPlayers, pick.player, pick.side, cancelled)) return;

        const champ = assignment.champions && assignment.champions[pick.player.id];
        if (champ) {
            setPickLabel(`${pick.label} · 🎭 CHAMPION`);
            if (!await animateChampion(pick.slot, champ, cancelled)) return;
        }

        remainingPlayers.splice(remainingPlayers.indexOf(pick.player), 1);
        pick.team.push(pick.player);
        updateRemainingPool(players, remainingPlayers);

        // Pause avant le pick suivant : au moins le temps du jingle de l'ami puis de la réplique de son champion (si activée)
        await Promise.all([drawWait(1300), skipDraw ? null : orSkip(playPickSounds(pick.player, champ || null))]);
        if (cancelled()) return;
    }

    finishDraw(assignment, cancelled);
}

// Remet le tirage à zéro (équipes, carte, résultat) et garde le roster.
// keepMusic = true : la musique n'est pas coupée (changement de mode).
function resetDraw(keepMusic = false) {
    drawId++; // annule un éventuel tirage en cours
    resetSkipDraw();
    championLine.cancel(); disableAdjustments(); cancelCaptainPick(); forgetCurrentMatch();
    if (!keepMusic && isPlaying) toggleMusic();
    stopConfetti();
    hideCountdown(); hideVersusScreen();
    unlockDrawUi();
    hideMinimap();
    resetSlots(); setTurn(null);
    document.getElementById('remainingPool').innerHTML = '';
    setPickLabel(t('draw.ready'));
    setCurrentPick(''); setDrawWarning('');
    players = []; remainingPlayers = []; blueTeam = []; redTeam = []; previousAssignments = {};
}

// Bouton Reset
function reset() { resetDraw(false); }
