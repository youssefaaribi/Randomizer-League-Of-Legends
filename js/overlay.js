// ── Écrans plein écran : compte à rebours + écran final "match prêt" ──

// ── Compte à rebours 3-2-1-GO ──
async function runCountdown(shouldStop, label = t('count.teams')) {
    const overlay = document.getElementById('countdownOverlay'), num = document.getElementById('countdownNumber');
    document.getElementById('countdownLabel').textContent = label;
    overlay.classList.add('visible');
    for (const step of ['3', '2', '1', 'GO !']) {
        if (shouldStop() || skipDraw) break;
        const isGo = step === 'GO !';
        num.textContent = step;
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop'); // relance l'animation
        sfx.countdown(isGo);
        await skippableWait(isGo ? 600 : 750);
    }
    overlay.classList.remove('visible');
}

function hideCountdown() { document.getElementById('countdownOverlay').classList.remove('visible'); }

// ── Écran final ──
// assignment.hasRoles === false (Capitaines, ARAM) : pas de rôles, on affiche #1, #2, #3... (👑 pour le capitaine en mode Capitaines)
// assignment.champions (mode Champions) : le champion de chaque joueur est affiché à côté de son nom
function buildVersusRow(player, index, side, assignment) {
    const hasRoles = assignment.hasRoles !== false, role = roles[index];
    const row = document.createElement('div');
    row.className = 'versus-row';
    row.style.setProperty('--i', index * 2 + (side === 'red' ? 1 : 0)); // Blue et Red arrivent en alternance

    const roleBox = document.createElement('span');
    roleBox.className = 'versus-role';
    if (hasRoles) {
        const img = document.createElement('img');
        img.src = roleIconUrls[role]; img.alt = '';
        roleBox.append(img, document.createTextNode(role));
    } else {
        roleBox.textContent = assignment.captains && index === 0 ? t('slot.captain') : `#${index + 1}`;
    }

    const name = document.createElement('span');
    name.className = 'versus-name'; name.textContent = player.name; name.title = player.name;

    row.append(roleBox, name);

    const champ = assignment.champions && assignment.champions[player.id];
    if (champ) {
        const box = document.createElement('span');
        box.className = 'versus-champ';
        const icon = document.createElement('img');
        icon.src = championIconUrl(champ); icon.alt = '';
        icon.onerror = () => { icon.style.display = 'none'; }; // icône introuvable : on garde le nom
        const label = document.createElement('span');
        label.textContent = champ.name;
        box.append(icon, label);
        row.appendChild(box);
    }

    const pref = hasRoles ? player.prefs[role] : null;
    if (pref === 'prefer' || pref === 'avoid') {
        const badge = document.createElement('span');
        badge.className = 'versus-badge ' + pref;
        badge.textContent = pref === 'prefer' ? '★' : '⚠';
        badge.title = pref === 'prefer' ? t('versus.badge.prefer') : t('versus.badge.avoid');
        row.appendChild(badge);
    }
    return row;
}

function showVersusScreen(assignment) {
    const blueBox = document.getElementById('versusBlue'), redBox = document.getElementById('versusRed');
    blueBox.innerHTML = ''; redBox.innerHTML = '';
    roles.forEach((role, i) => {
        blueBox.appendChild(buildVersusRow(assignment.blue[i], i, 'blue', assignment));
        redBox.appendChild(buildVersusRow(assignment.red[i], i, 'red', assignment));
    });
    document.getElementById('versusTitle').textContent = assignment.rematch ? t('versus.rematch') : t('versus.ready');
    document.getElementById('versusNotes').textContent = assignment.warnings.join('  ');
    document.getElementById('versusMapBtn').hidden = assignment.hasRoles === false; // pas de carte sans rôles
    document.getElementById('versusOverlay').classList.add('visible');
    (assignment.hasRoles === false ? document.getElementById('versusCloseBtn') : document.getElementById('versusMapBtn')).focus();
}

function hideVersusScreen() { document.getElementById('versusOverlay').classList.remove('visible'); }

function initOverlays() {
    const overlay = document.getElementById('versusOverlay');
    document.getElementById('versusCloseBtn').addEventListener('click', hideVersusScreen);
    document.getElementById('versusMapBtn').addEventListener('click', () => {
        hideVersusScreen();
        document.getElementById('minimapSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) hideVersusScreen(); }); // clic sur le fond
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideVersusScreen(); });
}
