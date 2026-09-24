// ── Historique des parties et classement ──
// Une partie : { id, date, mode, hasRoles, blue: [joueurs], red: [joueurs], winner: 'blue' | 'red' | null }
// Un joueur de l'historique : { id, name, role, champion, championId } (photo de la partie : ne change plus si l'ami est renommé)
// `champion` est le nom dans la langue de l'époque ; `championId` (id Data Dragon) ne change pas d'une langue à l'autre.
const HISTORY_KEY = 'lolRandomizer.history.v1';
const HISTORY_MAX = 300;

let matchHistory = [];      // du plus récent au plus ancien
let currentMatchId = null;  // la partie qui vient d'être tirée : c'est elle dont on indique le vainqueur

function loadHistory() {
    matchHistory = [];
    try {
        const data = JSON.parse(localStorage.getItem(HISTORY_KEY));
        if (data && Array.isArray(data.matches)) matchHistory = data.matches.filter(isValidMatch);
    } catch (e) { /* historique absent ou corrompu : on repart de zéro */ }
}

function isValidMatch(m) {
    const team = t => Array.isArray(t) && t.length === TEAM_SIZE && t.every(p => p && typeof p.id === 'string' && typeof p.name === 'string');
    return m && typeof m.id === 'string' && team(m.blue) && team(m.red);
}

function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, matches: matchHistory })); }
    catch (e) { /* stockage indisponible : on ignore */ }
}

function findMatch(id) { return matchHistory.find(m => m.id === id); }

function snapshotTeam(assignment, side) {
    return assignment[side].map((p, i) => {
        const champ = assignment.champions && assignment.champions[p.id];
        return { id: p.id, name: p.name, role: assignment.hasRoles === false ? null : roles[i], champion: champ ? champ.name : null, championId: champ ? champ.id : null };
    });
}

// ── Enregistrement ──
function recordMatch(assignment) {
    const match = {
        id: newId(), date: new Date().toISOString(), mode: currentMode().id, hasRoles: assignment.hasRoles !== false,
        rematch: !!assignment.rematch,
        blue: snapshotTeam(assignment, 'blue'), red: snapshotTeam(assignment, 'red'), winner: null
    };
    matchHistory.unshift(match);
    if (matchHistory.length > HISTORY_MAX) matchHistory.length = HISTORY_MAX;
    currentMatchId = match.id;
    saveHistory(); renderHistory();
}

// Après un échange ou une relance : la partie enregistrée reflète le résultat final
function syncCurrentMatch(assignment) {
    const match = findMatch(currentMatchId);
    if (!match) return;
    match.blue = snapshotTeam(assignment, 'blue'); match.red = snapshotTeam(assignment, 'red');
    saveHistory(); renderHistory();
}

function forgetCurrentMatch() { currentMatchId = null; updateWinnerBar(); }

// Cliquer deux fois sur le même vainqueur annule le résultat
function setMatchWinner(id, side) {
    const match = findMatch(id);
    if (!match) return;
    match.winner = match.winner === side ? null : side;
    saveHistory(); renderHistory();
}

function deleteMatch(id) {
    matchHistory = matchHistory.filter(m => m.id !== id);
    if (currentMatchId === id) currentMatchId = null;
    saveHistory(); renderHistory();
}

// ── Classement : uniquement les parties dont on connaît le vainqueur ──
function computeLeaderboard() {
    const stats = new Map();
    // du plus ancien au plus récent : le nom retenu est le plus récent
    [...matchHistory].reverse().forEach(m => {
        if (!m.winner) return;
        ['blue', 'red'].forEach(side => m[side].forEach(p => {
            const s = stats.get(p.id) || { id: p.id, name: p.name, played: 0, wins: 0, roles: {} };
            s.name = p.name; s.played++;
            if (m.winner === side) s.wins++;
            if (p.role) s.roles[p.role] = (s.roles[p.role] || 0) + 1;
            stats.set(p.id, s);
        }));
    });
    return [...stats.values()].map(s => {
        const friend = roster.find(f => f.id === s.id);
        const favorite = Object.entries(s.roles).sort((a, b) => b[1] - a[1])[0];
        return { ...s, name: friend ? friend.name : s.name, losses: s.played - s.wins, rate: s.wins / s.played, favoriteRole: favorite ? favorite[0] : null };
    }).sort((a, b) => b.wins - a.wins || b.rate - a.rate || a.name.localeCompare(b.name, LANG));
}

// ── Affichage ──
function modeLabelOf(id) {
    const mode = GAME_MODES.find(m => m.id === id);
    return mode ? mode.label : id;
}

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

// badges : Map id du joueur → liste de badges (voir stats.js). Chaque badge s'explique au survol.
function buildLeaderboard(rows, badges) {
    const table = el('table', 'leaderboard');
    const head = el('tr');
    ['#', t('lb.player'), t('lb.games'), t('lb.wins'), t('lb.losses'), t('lb.rate'), t('lb.role'), t('lb.badges')].forEach(h => head.appendChild(el('th', '', h)));
    table.appendChild(el('thead')).appendChild(head);
    const body = el('tbody');
    rows.forEach((r, i) => {
        const tr = el('tr');
        [i + 1, r.name, r.played, r.wins, r.losses, pct(r.rate), r.favoriteRole || '—'].forEach((v, c) => {
            const td = el('td', c === 1 ? 'lb-name' : '', String(v));
            tr.appendChild(td);
        });
        const badgeCell = el('td', 'lb-badges');
        ((badges && badges.get(r.id)) || []).forEach(b => {
            const span = el('span', 'badge', b.icon);
            span.title = t('badge.tip', { label: b.label, desc: b.desc }); span.setAttribute('aria-label', b.label);
            badgeCell.appendChild(span);
        });
        tr.appendChild(badgeCell);
        body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
}

// Statistiques fun : une petite carte par fait marquant
function buildFactsBlock(facts) {
    const box = el('div', 'facts');
    facts.forEach(f => {
        const card = el('div', 'fact');
        card.appendChild(el('span', 'fact-icon', f.icon));
        card.appendChild(el('span', 'fact-text', f.text)); // textContent : un pseudo avec < > reste du texte
        box.appendChild(card);
    });
    return box;
}

function buildMatchRow(m) {
    const row = el('div', 'hist-match');
    const date = new Date(m.date);
    row.appendChild(el('div', 'hist-meta', `${date.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })} · ${modeLabelOf(m.mode)}` + (m.rematch ? t('hist.rematchTag') : '')));

    const teams = el('div', 'hist-teams');
    [['blue', '🔵'], ['red', '🔴']].forEach(([side, icon]) => {
        const teamEl = el('div', `hist-team ${side}` + (m.winner === side ? ' won' : ''),
            `${icon} ${m[side].map(p => p.name).join(', ')}` + (m.winner === side ? '  🏆' : ''));
        teams.appendChild(teamEl);
    });
    row.appendChild(teams);

    const actions = el('div', 'hist-actions');
    [['blue', t('hist.blueWon')], ['red', t('hist.redWon')]].forEach(([side, label]) => {
        const b = el('button', 'link-btn' + (m.winner === side ? ' active' : ''), label);
        b.type = 'button'; b.title = m.winner === side ? t('hist.cancelResult') : t('hist.setWinner');
        b.addEventListener('click', () => setMatchWinner(m.id, side));
        actions.appendChild(b);
    });
    const del = el('button', 'link-btn', '✕');
    del.type = 'button'; del.title = t('hist.delete'); del.setAttribute('aria-label', t('hist.delete'));
    del.addEventListener('click', () => deleteMatch(m.id));
    actions.appendChild(del);
    row.appendChild(actions);
    return row;
}

// Barre "Qui a gagné ?" sous le résultat du tirage
function updateWinnerBar() {
    const match = findMatch(currentMatchId);
    document.getElementById('winnerBar').hidden = !match;
    if (!match) return;
    document.getElementById('winnerText').textContent = match.winner
        ? t(match.winner === 'blue' ? 'winner.blueWon' : 'winner.redWon')
        : t('winner.who');
    document.getElementById('winBlueBtn').classList.toggle('active', match.winner === 'blue');
    document.getElementById('winRedBtn').classList.toggle('active', match.winner === 'red');
}

const HISTORY_SHOWN = 30;

function renderHistory() {
    updateWinnerBar();
    const played = matchHistory.filter(m => m.winner).length;
    document.getElementById('historySummary').textContent =
        tp('history.summary', played) +
        (matchHistory.length > played ? t('history.noResult', { n: matchHistory.length - played }) : '');

    const body = document.getElementById('historyBody');
    body.innerHTML = '';
    if (!matchHistory.length) {
        body.appendChild(el('div', 'hist-empty', t('history.empty')));
        return;
    }

    body.appendChild(buildRecapBox());

    const board = computeLeaderboard();
    if (board.length) {
        const stats = computeStats(matchHistory);
        body.appendChild(el('h3', 'hist-title', t('history.title.board')));
        body.appendChild(buildLeaderboard(board, stats.badges));
        const legend = el('div', 'badge-legend', Object.values(BADGES).map(b => `${b.icon} ${b.label}`).join('  ·  '));
        legend.title = Object.values(BADGES).map(b => `${b.icon} ${t('badge.tip', { label: b.label, desc: b.desc })}`).join('\n');
        body.appendChild(legend);
        const facts = describeStats(stats);
        if (facts.length) {
            body.appendChild(el('h3', 'hist-title', t('history.title.stats')));
            body.appendChild(buildFactsBlock(facts));
        }
    } else {
        body.appendChild(el('div', 'hist-empty', t('history.empty.board')));
    }

    body.appendChild(el('h3', 'hist-title', t('history.title.recent')));
    matchHistory.slice(0, HISTORY_SHOWN).forEach(m => body.appendChild(buildMatchRow(m)));
    if (matchHistory.length > HISTORY_SHOWN) body.appendChild(el('div', 'hist-empty', t('history.older', { n: matchHistory.length - HISTORY_SHOWN })));

    const footer = el('div', 'hist-footer');
    if (matchHistory.some(m => !m.winner)) {
        const clean = el('button', 'link-btn', t('history.cleanBtn'));
        clean.type = 'button';
        clean.addEventListener('click', () => {
            if (!confirm(t('history.cleanConfirm'))) return;
            matchHistory = matchHistory.filter(m => m.winner);
            if (!findMatch(currentMatchId)) currentMatchId = null;
            saveHistory(); renderHistory();
        });
        footer.appendChild(clean);
    }
    const clear = el('button', 'link-btn', t('history.clearBtn'));
    clear.type = 'button';
    clear.addEventListener('click', () => {
        if (!confirm(t('history.clearConfirm'))) return;
        matchHistory = []; currentMatchId = null;
        saveHistory(); renderHistory();
    });
    footer.appendChild(clear);
    body.appendChild(footer);
}

function initHistory() {
    loadHistory();
    document.getElementById('winBlueBtn').addEventListener('click', () => { if (currentMatchId) setMatchWinner(currentMatchId, 'blue'); });
    document.getElementById('winRedBtn').addEventListener('click', () => { if (currentMatchId) setMatchWinner(currentMatchId, 'red'); });
    renderHistory();
}
