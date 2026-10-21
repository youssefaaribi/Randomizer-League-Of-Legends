// ── Import des pseudos depuis le lobby / la custom ouverte dans le client League of Legends ──
// La page ne peut pas parler au client toute seule : c'est l'assistant tools/lobby-helper.ps1 (lancé par Launch-Randomizer.bat)
// qui lit la liste des joueurs et la sert sur http://127.0.0.1:8766/lobby. Lecture seule, en local uniquement.
const LOBBY_URL = 'http://127.0.0.1:8766/lobby';

async function fetchLobby() {
    let res;
    try { res = await fetch(LOBBY_URL, { cache: 'no-store' }); }
    catch (e) { return { ok: false, error: 'helper' }; } // assistant pas lancé
    if (!res.ok) return { ok: false, error: 'helper' };
    try { return await res.json(); }
    catch (e) { return { ok: false, error: 'helper' }; }
}

// Reconnaît un ami déjà dans le roster : par son nom, ou par le pseudo LoL dont il a été importé (même s'il a été renommé depuis)
function findFriendByLolName(lolName) {
    const n = lolName.toLowerCase();
    return roster.find(f => f.name.toLowerCase() === n || (f.lolName && f.lolName.toLowerCase() === n));
}

// Coche exactement les joueurs du lobby ; ceux qui n'étaient pas encore dans le roster y sont ajoutés
function applyLobbyPlayers(lolNames) {
    const inLobby = new Set();
    let created = 0;
    lolNames.forEach(lolName => {
        let friend = findFriendByLolName(lolName);
        if (!friend) {
            friend = makeFriend(lolName.slice(0, MAX_NAME_LENGTH));
            friend.lolName = lolName.slice(0, MAX_LOL_NAME_LENGTH);
            roster.push(friend);
            created++;
        }
        inLobby.add(friend.id);
    });
    roster.forEach(f => { f.present = inLobby.has(f.id); });
    commitRoster();
    return created;
}

async function importFromLobby() {
    const btn = document.getElementById('importLobbyBtn');
    btn.disabled = true;
    const lobby = await fetchLobby();
    btn.disabled = false;

    if (!lobby.ok) {
        showRosterNotice(t('lobby.err.' + (lobby.error || 'helper')), 'error');
        return;
    }
    // Les mêmes pseudos en double (ou deux amis au même nom) ne comptent qu'une fois
    const names = [...new Map(lobby.players.map(p => [p.toLowerCase(), p])).values()];
    if (!names.length) { showRosterNotice(t('lobby.err.empty'), 'error'); return; }

    const created = applyLobbyPlayers(names);
    const size = names.length / 2;
    if (names.length % 2 === 0 && TEAM_FORMATS[size] && size !== TEAM_SIZE) {
        // Ex. une custom 4v4 alors que la page est en 5v5 : on propose de changer le format
        if (confirm(t('lobby.switch', { n: names.length, size }))) {
            saveSetting(TEAM_SIZE_KEY, String(size));
            location.reload();
            return;
        }
    }
    const summary = t('lobby.done', { n: names.length, created });
    if (names.length === PLAYERS_NEEDED) showRosterNotice(summary, 'ok');
    else showRosterNotice(summary + ' ' + t('lobby.sizeMismatch', { size: TEAM_SIZE, need: PLAYERS_NEEDED }), 'warn');
}

function initLobbyImport() {
    document.getElementById('importLobbyBtn').addEventListener('click', importFromLobby);
}
