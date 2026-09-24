// ── Mode Capitaines : deux capitaines choisissent leurs joueurs à tour de rôle, sans rôles ──
let captainPickResolver = null; // appelée quand un capitaine choisit un joueur (avec son id), ou avec null si on annule
let captainRemaining = [];      // joueurs encore disponibles pendant la draft

function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

// ── Choix des capitaines (au hasard par défaut, ou imposés) ──
function renderCaptainOptions() {
    const present = getPresentPlayers();
    ['captainBlue', 'captainRed'].forEach(id => {
        const sel = document.getElementById(id), previous = sel.value;
        sel.innerHTML = '';
        const random = document.createElement('option');
        random.value = 'random'; random.textContent = t('captain.optRandom');
        sel.appendChild(random);
        present.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name; // textContent : un pseudo avec < > reste du texte
            sel.appendChild(opt);
        });
        sel.value = previous === 'random' || present.some(p => p.id === previous) ? previous : 'random';
    });
}

function readCaptainChoices() {
    return { blue: document.getElementById('captainBlue').value, red: document.getElementById('captainRed').value };
}

// Deux capitaines différents : on refuse de lancer si le même joueur est choisi des deux côtés
function validateCaptainChoices() {
    const c = readCaptainChoices();
    if (c.blue !== 'random' && c.blue === c.red) {
        setModeStatus(t('captain.same'), 'error');
        return false;
    }
    refreshModeStatus();
    return true;
}

function chooseCaptains(present) {
    const c = readCaptainChoices();
    let blueCap = present.find(p => p.id === c.blue) || null, redCap = present.find(p => p.id === c.red) || null;
    const blueRandom = !blueCap, redRandom = !redCap;
    if (!blueCap) blueCap = pickRandom(present.filter(p => p !== redCap));
    if (!redCap) redCap = pickRandom(present.filter(p => p !== blueCap));
    return { blueCap, redCap, blueRandom, redRandom };
}

// ── Attente du choix d'un capitaine ──
function showCaptainActions(visible) {
    document.getElementById('captainActions').classList.toggle('visible', visible);
}

function waitForCaptainPick() {
    return new Promise(resolve => { captainPickResolver = resolve; });
}

function resolveCaptainPick(playerId) {
    if (!captainPickResolver) return;
    const resolve = captainPickResolver;
    captainPickResolver = null;
    resolve(playerId);
}

// Appelée par Reset / changement de mode : libère la draft en attente
function cancelCaptainPick() {
    showCaptainActions(false);
    resolveCaptainPick(null);
}

function initCaptains() {
    const pool = document.getElementById('remainingPool');
    const choose = target => {
        const chip = target.closest('.pool-player.pickable');
        if (chip) resolveCaptainPick(chip.dataset.id);
    };
    pool.addEventListener('click', e => choose(e.target));
    pool.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(e.target); }
    });
    document.getElementById('captainRandomBtn').addEventListener('click', () => {
        if (captainRemaining.length) resolveCaptainPick(pickRandom(captainRemaining).id);
    });
}

// ── Déroulé de la draft ──
async function runCaptainsDraw(present, cancelled) {
    beginDraw(present);
    const { blueCap, redCap, blueRandom, redRandom } = chooseCaptains(present);
    captainRemaining = [...present];
    updateRemainingPool(players, captainRemaining);

    await runCountdown(cancelled, t('count.captains'));
    if (cancelled()) return;

    // 1) Les capitaines : roulette s'ils sont tirés au hasard, placés directement s'ils ont été choisis
    setPickLabel(t('captain.drawing'));
    for (const cap of [
        { side: 'blue', player: blueCap, random: blueRandom, other: redCap },
        { side: 'red',  player: redCap,  random: redRandom,  other: blueCap }
    ]) {
        const slot = `${cap.side}1`;
        if (cap.random) {
            const candidates = present.filter(p => p !== cap.other); // l'autre capitaine ne peut pas sortir
            if (!await animateSlot(slot, candidates, cap.player, cap.side, cancelled)) return;
        } else lockSlot(slot, cap.player, cap.side);
        (cap.side === 'blue' ? blueTeam : redTeam).push(cap.player);
        captainRemaining = captainRemaining.filter(p => p !== cap.player);
        updateRemainingPool(players, captainRemaining);
        await Promise.all([wait(900), playPickSounds(cap.player)]);
        if (cancelled()) return;
    }

    // 2) Les 8 autres joueurs : les capitaines choisissent chacun leur tour, le premier est tiré au hasard
    const first = Math.random() < 0.5 ? 'blue' : 'red', second = first === 'blue' ? 'red' : 'blue';
    const order = [first, second, first, second, first, second, first, second];
    setPickLabel(t('captain.starts', { icon: first === 'blue' ? '🔵' : '🔴', name: (first === 'blue' ? blueCap : redCap).name }));
    await wait(900);
    if (cancelled()) return;

    for (const side of order) {
        const cap = side === 'blue' ? blueCap : redCap, team = side === 'blue' ? blueTeam : redTeam;
        let chosenId;

        if (captainRemaining.length === 1) { // dernier joueur : plus rien à choisir
            chosenId = captainRemaining[0].id;
            setPickLabel(t('captain.last', { icon: side === 'blue' ? '🔵' : '🔴', name: cap.name }));
            await wait(900);
            if (cancelled()) return;
        } else {
            setTurn(side);
            setPickLabel(t('captain.turn', { icon: side === 'blue' ? '🔵' : '🔴', name: cap.name }));
            setCurrentPick(t('captain.click'));
            updateRemainingPool(players, captainRemaining, true);
            showCaptainActions(true);
            sfx.turn();
            chosenId = await waitForCaptainPick();
            showCaptainActions(false);
            if (chosenId === null || cancelled()) return; // Reset pendant l'attente
        }

        const player = captainRemaining.find(p => p.id === chosenId);
        captainRemaining = captainRemaining.filter(p => p !== player);
        team.push(player);
        lockSlot(`${side}${team.length}`, player, side);
        updateRemainingPool(players, captainRemaining);
        await Promise.all([wait(900), playPickSounds(player)]);
        if (cancelled()) return;
    }

    finishDraw({ blue: blueTeam, red: redTeam, warnings: [], hasRoles: false }, cancelled);
}
