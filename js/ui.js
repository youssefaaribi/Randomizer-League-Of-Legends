// ── Slots des équipes (leur contenu dépend du mode de jeu) ──
function generateSlots() {
    const mode = currentMode();
    ['blueTeam', 'redTeam'].forEach(teamId => {
        const prefix = teamId === 'blueTeam' ? 'blue' : 'red';
        const container = document.getElementById(teamId);
        container.innerHTML = '';
        roles.forEach((role, i) => {
            const div = document.createElement('div');
            div.className = 'slot'; div.id = `${prefix}${i + 1}`;
            // Contenu 100 % statique (rôles + URLs de config.js) : pas de saisie utilisateur ici
            const badge = mode.roles
                ? `<span class="slot-role"><img src="${roleIconUrls[role]}" alt="${role}"> ${role}</span>`
                : `<span class="slot-role slot-role-plain">${i === 0 ? t('slot.captain') : '#' + (i + 1)}</span>`;
            const champ = mode.champions
                ? '<span class="slot-champ"><img class="slot-champ-icon" alt=""><span class="slot-champ-name"></span></span>'
                : '';
            const champBtn = mode.champions
                ? `<button type="button" class="slot-champ-reroll" title="${t('slot.champReroll.title')}" aria-label="${t('slot.champReroll.aria', { role })}">🎭</button>`
                : '';
            const roleBtn = mode.roles
                ? `<button type="button" class="slot-reroll" title="${t('slot.reroll.title')}" aria-label="${t('slot.reroll.aria', { role })}">🎲</button>`
                : '';
            div.innerHTML = badge + `<span class="slot-name">${t('slot.waiting')}</span>` + champ + champBtn + roleBtn;
            container.appendChild(div);
        });
    });
}

function resetSlots() {
    for (let i = 1; i <= TEAM_SIZE; i++) ['blue', 'red'].forEach(s => {
        const sl = document.getElementById(`${s}${i}`);
        sl.classList.remove('filled', 'selecting', 'locked');
        sl.querySelector('.slot-name').textContent = t('slot.waiting');
        setSlotChampion(sl.id, null);
        const champBtn = sl.querySelector('.slot-champ-reroll');
        if (champBtn) champBtn.disabled = false;
    });
}

// ── Champion affiché dans un slot (mode "Champions au hasard") ──
function setSlotChampion(slotId, champ) {
    const box = document.getElementById(slotId).querySelector('.slot-champ');
    if (!box) return;
    const icon = box.querySelector('.slot-champ-icon');
    box.classList.remove('rolling');
    if (!champ) {
        box.classList.remove('has-champ');
        icon.removeAttribute('src'); box.querySelector('.slot-champ-name').textContent = '';
        return;
    }
    icon.style.visibility = '';
    icon.onerror = () => { icon.style.visibility = 'hidden'; }; // icône introuvable : on garde le nom seul
    icon.src = championIconUrl(champ); icon.alt = champ.name;
    box.querySelector('.slot-champ-name').textContent = champ.name;
    box.classList.add('has-champ');
}

// Roulette de noms de champions puis révélation. Résolue à true, ou à false si `shouldStop()` annule (Reset).
function animateChampion(slotId, finalChamp, shouldStop) {
    return new Promise(resolve => {
        const box = document.getElementById(slotId).querySelector('.slot-champ');
        const nameEl = box.querySelector('.slot-champ-name');
        box.classList.add('has-champ', 'rolling');
        let it = 0; const max = 12; let spd = 60;
        function step() {
            if (shouldStop()) { box.classList.remove('rolling'); resolve(false); return; }
            if (it >= max) {
                setSlotChampion(slotId, finalChamp);
                box.classList.remove('champ-locked'); void box.offsetWidth; box.classList.add('champ-locked');
                sfx.champion(); resolve(true); return;
            }
            nameEl.textContent = championData.list[Math.floor(Math.random() * championData.list.length)].name;
            sfx.tick(it / max);
            it++; spd += 8; setTimeout(step, spd);
        }
        step();
    });
}

// ── Pool des joueurs restants ──
// pickable = true : les joueurs encore disponibles sont cliquables (mode Capitaines)
function updateRemainingPool(allPlayers, remaining, pickable = false) {
    const pool = document.getElementById('remainingPool'); pool.innerHTML = '';
    allPlayers.forEach(p => {
        const d = document.createElement('div');
        d.className = 'pool-player'; d.textContent = p.name; d.dataset.id = p.id;
        if (!remaining.includes(p)) d.classList.add('selected');
        else if (pickable) { d.classList.add('pickable'); d.tabIndex = 0; d.setAttribute('role', 'button'); }
        pool.appendChild(d);
    });
}

function highlightPlayer(id) {
    document.querySelectorAll('.pool-player').forEach(el => {
        el.classList.toggle('highlight', el.dataset.id === id);
    });
}

// Met en avant l'équipe dont c'est le tour (mode Capitaines)
function setTurn(side) {
    document.querySelector('.team-blue').classList.toggle('on-turn', side === 'blue');
    document.querySelector('.team-red').classList.toggle('on-turn', side === 'red');
}

function setPickLabel(text) { document.getElementById('pickLabel').textContent = text; }
function setCurrentPick(text) { document.getElementById('currentPick').textContent = text; }
function setDrawWarning(text) { document.getElementById('drawWarning').textContent = text; }

// Place directement un joueur dans un slot, avec l'effet de validation (sans roulette)
function lockSlot(slotId, player, side) {
    const slot = document.getElementById(slotId);
    slot.querySelector('.slot-name').textContent = player.name;
    slot.classList.remove('locked', 'selecting'); slot.classList.add('filled');
    void slot.offsetWidth; slot.classList.add('locked');
    highlightPlayer(player.id); setCurrentPick(player.name);
    sfx.lockIn(side);
}

// ── Animation de roulette sur un slot ──
// Fait défiler les joueurs de `candidates` puis fixe `finalPlayer`. Ne modifie aucun état du tirage.
// `side` ('blue' | 'red') sert au son. `shouldStop()` permet d'annuler (Reset) : la promesse vaut alors false.
function animateSlot(slotId, candidates, finalPlayer, side, shouldStop) {
    return new Promise(resolve => {
        const slot = document.getElementById(slotId), nameSpan = slot.querySelector('.slot-name');
        slot.classList.remove('locked'); slot.classList.add('selecting'); // 'locked' retiré : l'effet se rejoue à la validation
        let it = 0, max = 20 + Math.floor(Math.random() * 10), spd = 50;
        function anim() {
            if (shouldStop()) { slot.classList.remove('selecting'); resolve(false); return; }
            if (it >= max) {
                nameSpan.textContent = finalPlayer.name;
                slot.classList.remove('selecting'); slot.classList.add('filled', 'locked');
                highlightPlayer(finalPlayer.id); setCurrentPick(finalPlayer.name);
                sfx.lockIn(side);
                resolve(true); return;
            }
            const rp = candidates[Math.floor(Math.random() * candidates.length)];
            nameSpan.textContent = rp.name; highlightPlayer(rp.id); setCurrentPick(rp.name);
            sfx.tick(it / max);
            it++; spd += 10; setTimeout(anim, spd);
        }
        anim();
    });
}
