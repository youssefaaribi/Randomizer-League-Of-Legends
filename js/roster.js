// ── Roster d'amis : ajout, présence, préférences de rôles ──
// Toute l'interface est construite avec le DOM (textContent) : un pseudo avec < > ne peut rien casser.

function getPresentPlayers() { return roster.filter(f => f.present); }

function findFriend(id) { return roster.find(f => f.id === id); }

function nameExists(name, exceptId) {
    const n = name.trim().toLowerCase();
    return roster.some(f => f.id !== exceptId && f.name.toLowerCase() === n);
}

// ── Message sous la liste (erreur, avertissement) ──
function showRosterNotice(text, kind = 'warn') {
    const el = document.getElementById('rosterNotice');
    el.textContent = text;
    el.className = 'roster-notice' + (text ? ' ' + kind : '');
    if (kind === 'error') mirrorPresentationNotice(text); // en mode présentation, le roster est masqué
}

// Rôles que trop peu de joueurs présents acceptent : il en faut au moins 2 par rôle (un par équipe)
function findUnderstaffedRoles(present) {
    return roles.filter(role => present.filter(p => p.prefs[role] !== 'avoid').length < 2);
}

function updateRosterSummary() {
    const present = getPresentPlayers().length;
    const count = document.getElementById('rosterCount');
    count.textContent = t('roster.present', { n: present, max: PLAYERS_NEEDED });
    count.className = 'roster-count ' + (present === PLAYERS_NEEDED ? 'ok' : present > PLAYERS_NEEDED ? 'over' : 'under');

    const tight = present === PLAYERS_NEEDED ? findUnderstaffedRoles(getPresentPlayers()) : [];
    showRosterNotice(tight.length
        ? t('roster.tight', { roles: tight.join(', ') })
        : '');
}

// ── Actions (chacune sauvegarde puis réaffiche) ──
function commitRoster() { saveRoster(); renderRoster(); }

function addFriend(rawName) {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return false;
    if (nameExists(name)) { showRosterNotice(t('roster.exists', { name })); return false; }
    const friend = makeFriend(name);
    friend.present = getPresentPlayers().length < PLAYERS_NEEDED; // au-delà de 10, on ajoute sans cocher
    roster.push(friend);
    commitRoster();
    return true;
}

function removeFriend(id) {
    const f = findFriend(id);
    if (!f || !confirm(t('roster.delete.confirm', { name: f.name }))) return;
    roster = roster.filter(x => x.id !== id);
    commitRoster();
}

function renameFriend(id, rawName, inputEl) {
    const f = findFriend(id);
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name || nameExists(name, id)) {
        inputEl.value = f.name; // refusé : on remet l'ancien nom
        if (name) showRosterNotice(t('roster.exists', { name }));
        return;
    }
    f.name = name; inputEl.value = name;
    saveRoster();
}

function togglePresent(id) {
    const f = findFriend(id); f.present = !f.present; commitRoster();
}

function setAllPresent(present) {
    roster.forEach(f => { f.present = present; });
    commitRoster();
}

// neutre → préféré → à éviter → neutre
function cycleRolePref(id, role) {
    const f = findFriend(id), cur = f.prefs[role];
    if (!cur) f.prefs[role] = 'prefer';
    else if (cur === 'prefer') f.prefs[role] = 'avoid';
    else delete f.prefs[role];
    commitRoster();
}

function clearRoster() {
    if (roster.length === 0 || !confirm(t('roster.clear.confirm'))) return;
    roster = [];
    commitRoster();
}

// ── Affichage ──
const PREF_LABELS = {
    none:   t('roster.pref.none'),
    prefer: t('roster.pref.prefer'),
    avoid:  t('roster.pref.avoid')
};

// ── Sons d'un ami : jingle + champion fétiche (éditeur ouvert avec le bouton 🎵) ──
const openIntroEditors = new Set(); // amis dont l'éditeur est ouvert (gardé d'un affichage à l'autre)

// Le bouton 🎵 est "allumé" si l'ami a un jingle ou un champion fétiche
function hasCustomSound(f) { return f.jingle !== 'none' || !!f.voiceChampion; }

function buildIntroEditor(f, introBtn) {
    const box = document.createElement('div');
    box.className = 'friend-intro';

    const jingle = document.createElement('select');
    jingle.setAttribute('aria-label', t('roster.jingle.aria', { name: f.name }));
    jingle.title = t('roster.jingle.title');
    JINGLES.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id; opt.textContent = j.label;
        jingle.appendChild(opt);
    });
    jingle.value = f.jingle;

    // Champion fétiche : sa réplique est jouée quand cet ami est tiré dans un mode sans champion (réglage "Répliques des champions")
    const champ = document.createElement('select');
    champ.setAttribute('aria-label', t('roster.champ.aria', { name: f.name }));
    champ.title = t('roster.champ.title');
    const addOption = (value, label) => {
        const opt = document.createElement('option');
        opt.value = value; opt.textContent = label;
        champ.appendChild(opt);
    };
    addOption('', t('roster.champ.none'));
    if (f.voiceChampion) addOption(f.voiceChampion, f.voiceChampion); // en attendant que la liste soit chargée
    champ.value = f.voiceChampion || '';
    loadChampions().then(ok => { // la liste complète arrive (internet la 1re fois, ensuite gardée dans le navigateur)
        if (!ok) return;
        champ.innerHTML = '';
        addOption('', t('roster.champ.none'));
        championData.list.forEach(c => addOption(c.id, c.name));
        champ.value = f.voiceChampion || '';
    });

    const test = document.createElement('button');
    test.type = 'button'; test.className = 'link-btn'; test.textContent = t('roster.test');
    test.title = t('roster.test.title');

    // Sauvegarde sans réafficher la liste (sinon la sélection en cours serait perdue)
    const save = () => {
        f.jingle = JINGLES.some(j => j.id === jingle.value) ? jingle.value : 'none';
        f.voiceChampion = champ.value;
        saveRoster();
        introBtn.classList.toggle('set', hasCustomSound(f));
    };
    jingle.addEventListener('change', save);
    champ.addEventListener('change', save);
    test.addEventListener('click', () => { save(); testPickSounds(f); });

    box.append(jingle, champ, test);
    return box;
}

function buildFriendCard(f) {
    const card = document.createElement('div');
    card.className = 'friend' + (f.present ? ' present' : '');

    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = f.present;
    check.title = t('roster.check.title'); check.setAttribute('aria-label', t('roster.check.aria', { name: f.name }));
    check.addEventListener('change', () => togglePresent(f.id));

    const name = document.createElement('input');
    name.type = 'text'; name.className = 'friend-name'; name.value = f.name; name.maxLength = MAX_NAME_LENGTH;
    name.setAttribute('aria-label', t('roster.name.aria'));
    name.addEventListener('change', () => renameFriend(f.id, name.value, name));

    const rolesBox = document.createElement('div');
    rolesBox.className = 'friend-roles';
    roles.forEach(role => {
        const state = f.prefs[role] || 'none';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'role-pref ' + state;
        btn.title = t('roster.pref.title', { role, state: PREF_LABELS[state] });
        btn.setAttribute('aria-label', t('roster.pref.aria', { name: f.name, role, state: PREF_LABELS[state] }));
        const img = document.createElement('img');
        img.src = roleIconUrls[role]; img.alt = role;
        btn.appendChild(img);
        btn.addEventListener('click', () => cycleRolePref(f.id, role));
        rolesBox.appendChild(btn);
    });

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'friend-del'; del.textContent = '✕';
    del.title = t('roster.del.title'); del.setAttribute('aria-label', t('roster.del.aria', { name: f.name }));
    del.addEventListener('click', () => removeFriend(f.id));

    const introBtn = document.createElement('button');
    introBtn.type = 'button'; introBtn.className = 'friend-intro-btn' + (hasCustomSound(f) ? ' set' : ''); introBtn.textContent = '🎵';
    introBtn.title = t('roster.sound.title');
    introBtn.setAttribute('aria-label', t('roster.sound.aria', { name: f.name }));
    introBtn.addEventListener('click', () => {
        if (openIntroEditors.has(f.id)) {
            openIntroEditors.delete(f.id);
            card.querySelector('.friend-intro').remove();
        } else {
            openIntroEditors.add(f.id);
            const editor = buildIntroEditor(f, introBtn);
            card.appendChild(editor);
            editor.querySelector('select').focus();
        }
    });

    card.append(check, name, rolesBox, introBtn, del);
    if (openIntroEditors.has(f.id)) card.appendChild(buildIntroEditor(f, introBtn));
    return card;
}

function renderRoster() {
    const grid = document.getElementById('rosterGrid');
    grid.innerHTML = '';
    if (roster.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'roster-empty';
        empty.textContent = t('roster.empty');
        grid.appendChild(empty);
    }
    roster.forEach(f => grid.appendChild(buildFriendCard(f)));
    updateRosterSummary();
    renderCaptainOptions(); // la liste des capitaines possibles suit les joueurs présents
}
