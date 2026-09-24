// ── Noms des joueurs affichés sur la carte 3D ──
// Sous chaque pin : une carte avec le joueur Blue (en haut) et le joueur Red (en bas).
// Les noms trop longs sont coupés par le CSS (…) ; le nom complet apparaît au survol.
function makeNameLabel(name, side) {
    const label = document.createElement('div');
    label.className = `token-name-label ${side}`;
    label.textContent = name; // textContent : un pseudo avec < > ne casse pas l'affichage
    label.title = name;
    return label;
}

// instant = true : affichage immédiat, sans l'animation d'apparition (mise à jour après un échange)
function renderMinimapTokens(blueAssignment, redAssignment, instant = false) {
    const overlay = document.getElementById('mapTokensOverlay');
    overlay.innerHTML = '';

    roles.forEach((role, i) => {
        const pos = mapPositions[role];
        const el = document.createElement('div');
        el.className = 'map-token';
        el.style.left = pos.x + '%';
        el.style.top = pos.y + '%';
        el.append(makeNameLabel(blueAssignment[i], 'blue'), makeNameLabel(redAssignment[i], 'red'));

        overlay.appendChild(el);
        if (instant) el.classList.add('visible');
        else setTimeout(() => el.classList.add('visible'), 200 + i * 200);
    });

    document.getElementById('minimapSection').classList.add('visible');
}

function hideMinimap() {
    document.getElementById('minimapSection').classList.remove('visible');
    document.getElementById('mapTokensOverlay').innerHTML = '';
}
