// ── Statistiques fun et badges, calculés à partir des parties de l'historique ──
// Seules les parties dont le vainqueur est indiqué comptent. Les seuils sont volontairement bas : entre amis, on a peu de parties.

const BADGES = {
    king:      { icon: '👑', label: t('badge.king'),      desc: t('badge.king.desc') },
    hot:       { icon: '🔥', label: t('badge.hot'),       desc: t('badge.hot.desc') },
    cold:      { icon: '🧊', label: t('badge.cold'),      desc: t('badge.cold.desc') },
    duo:       { icon: '🤝', label: t('badge.duo'),       desc: t('badge.duo.desc') },
    target:    { icon: '🎯', label: t('badge.target'),    desc: t('badge.target.desc') },
    collector: { icon: '🎭', label: t('badge.collector'), desc: t('badge.collector.desc') },
    loyal:     { icon: '🛡️', label: t('badge.loyal'),     desc: t('badge.loyal.desc') },
    unbeaten:  { icon: '🍀', label: t('badge.unbeaten'),  desc: t('badge.unbeaten.desc') }
};
function pct(n) { return t('pct', { n: Math.round(n * 100) }); }

// Plus longue série de victoires, de défaites, et série en cours (positive = victoires, négative = défaites)
function streaksOf(results) {
    let bestWin = 0, bestLose = 0, run = 0;
    results.forEach(win => {
        run = win ? (run > 0 ? run + 1 : 1) : (run < 0 ? run - 1 : -1);
        bestWin = Math.max(bestWin, run); bestLose = Math.max(bestLose, -run);
    });
    return { bestWin, bestLose, current: run };
}

function computeStats(allMatches, { minPair = 2, minVersus = 2 } = {}) {
    const matches = allMatches.filter(m => m.winner).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const players = new Map(), pairs = new Map(), versus = new Map(), champs = new Map();
    let blueWins = 0, redWins = 0;

    matches.forEach(m => {
        if (m.winner === 'blue') blueWins++; else redWins++;
        ['blue', 'red'].forEach(side => {
            const other = side === 'blue' ? 'red' : 'blue', won = m.winner === side, team = m[side];
            team.forEach(p => {
                let s = players.get(p.id);
                if (!s) { s = { id: p.id, name: p.name, played: 0, wins: 0, results: [], roles: {}, champions: new Map() }; players.set(p.id, s); }
                s.name = p.name; s.played++; if (won) s.wins++; s.results.push(won);
                if (p.role) s.roles[p.role] = (s.roles[p.role] || 0) + 1;
                if (p.champion) {
                    // Regroupé par id Data Dragon quand on l'a (indépendant de la langue), sinon par nom
                    const ckey = p.championId || p.champion;
                    s.champions.set(ckey, (s.champions.get(ckey) || 0) + 1);
                    const c = champs.get(ckey) || { id: p.championId || null, name: p.champion, games: 0, wins: 0 };
                    c.name = p.champion; // le nom le plus récent (les parties sont triées de la plus ancienne à la plus récente)
                    c.games++; if (won) c.wins++; champs.set(ckey, c);
                }
            });
            // Duos : deux joueurs de la même équipe
            for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
                const [x, y] = team[i].id < team[j].id ? [team[i], team[j]] : [team[j], team[i]], key = `${x.id}|${y.id}`;
                const pr = pairs.get(key) || { a: x, b: y, games: 0, wins: 0 };
                pr.games++; if (won) pr.wins++; pairs.set(key, pr);
            }
            // Face à face : chaque joueur de cette équipe contre chaque joueur de l'autre
            team.forEach(p => m[other].forEach(q => {
                const key = `${p.id}>${q.id}`;
                const v = versus.get(key) || { a: p, b: q, games: 0, aWins: 0 };
                v.games++; if (won) v.aWins++; versus.set(key, v);
            }));
        });
    });

    // ── Dérivés ──
    const ranking = [...players.values()].map(s => {
        const st = streaksOf(s.results), favorite = Object.entries(s.roles).sort((a, b) => b[1] - a[1])[0];
        const roleGames = Object.values(s.roles).reduce((sum, n) => sum + n, 0);
        return { ...s, losses: s.played - s.wins, rate: s.wins / s.played, streaks: st,
            favoriteRole: favorite ? favorite[0] : null, favoriteRoleShare: favorite ? favorite[1] / roleGames : 0, roleGames };
    }).sort((a, b) => b.wins - a.wins || b.rate - a.rate || a.name.localeCompare(b.name, LANG));

    const pairList = [...pairs.values()].filter(p => p.games >= minPair).map(p => ({ ...p, rate: p.wins / p.games }));
    const duoBest = pairList.filter(p => p.rate > 0.5).sort((a, b) => b.rate - a.rate || b.games - a.games)[0] || null;
    const duoWorst = pairList.filter(p => p.rate < 0.5).sort((a, b) => a.rate - b.rate || b.games - a.games)[0] || null;

    // Rivalité : un joueur qui bat presque toujours un même adversaire (au moins 75 % de victoires)
    const rivalry = [...versus.values()].filter(v => v.games >= minVersus).map(v => ({ ...v, rate: v.aWins / v.games }))
        .filter(v => v.rate >= 0.75).sort((a, b) => b.rate - a.rate || b.games - a.games)[0] || null;

    const bestWinStreak = ranking.filter(r => r.streaks.bestWin >= 2).sort((a, b) => b.streaks.bestWin - a.streaks.bestWin)[0] || null;
    const worstLoseStreak = ranking.filter(r => r.streaks.bestLose >= 2).sort((a, b) => b.streaks.bestLose - a.streaks.bestLose)[0] || null;

    const champList = [...champs.values()].map(c => ({ ...c, rate: c.wins / c.games }));
    const topChampions = [...champList].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, LANG));
    const topChampion = topChampions[0] && topChampions[0].games >= 2 ? topChampions[0] : null;
    const bestChampion = champList.filter(c => c.games >= 2 && c.rate > 0.5).sort((a, b) => b.rate - a.rate || b.games - a.games)[0] || null;
    const cursedChampion = champList.filter(c => c.games >= 2 && c.wins === 0).sort((a, b) => b.games - a.games)[0] || null;

    // ── Badges ──
    const badges = new Map(ranking.map(r => [r.id, []]));
    const give = (id, key) => { if (badges.has(id)) badges.get(id).push({ key, ...BADGES[key] }); };
    const maxWins = ranking.length ? ranking[0].wins : 0;
    // Le roi : le plus de victoires (au moins 2). Si plus de 2 joueurs sont à égalité, personne n'est roi (le badge ne veut plus rien dire).
    const kings = ranking.filter(r => r.wins === maxWins);
    if (maxWins >= 2 && kings.length <= 2) kings.forEach(r => give(r.id, 'king'));
    ranking.forEach(r => {
        if (r.streaks.current >= 3) give(r.id, 'hot');
        if (r.streaks.current <= -3) give(r.id, 'cold');
        if (r.played >= 3 && r.losses === 0) give(r.id, 'unbeaten');
        if (r.roleGames >= 3 && r.favoriteRoleShare >= 0.7) give(r.id, 'loyal');
    });
    if (duoBest && duoBest.rate >= 0.7) { give(duoBest.a.id, 'duo'); give(duoBest.b.id, 'duo'); }
    if (rivalry) give(rivalry.b.id, 'target');
    const mostChamps = Math.max(0, ...ranking.map(r => r.champions.size));
    if (mostChamps >= 5) ranking.filter(r => r.champions.size === mostChamps).forEach(r => give(r.id, 'collector'));

    return { matches: matches.length, blueWins, redWins, ranking, duoBest, duoWorst, rivalry, bestWinStreak, worstLoseStreak,
        topChampions, topChampion, bestChampion, cursedChampion, badges };
}

// Les faits marquants, en phrases (neutres : on ne devine pas le genre des joueurs)
function describeStats(s) {
    const facts = [];
    const wins = n => tp('count.wins', n); // "1 victoire" / "3 victoires"
    if (s.duoBest) facts.push({ icon: '🤝', text: t('fact.duoBest', { a: s.duoBest.a.name, b: s.duoBest.b.name, wins: wins(s.duoBest.wins), games: s.duoBest.games, rate: pct(s.duoBest.rate) }) });
    if (s.duoWorst) facts.push({ icon: '🥶', text: t('fact.duoWorst', { a: s.duoWorst.a.name, b: s.duoWorst.b.name, wins: wins(s.duoWorst.wins), games: s.duoWorst.games }) });
    if (s.rivalry) facts.push({ icon: '⚔️', text: t('fact.rivalry', { a: s.rivalry.a.name, b: s.rivalry.b.name, wins: wins(s.rivalry.aWins), games: s.rivalry.games }) });
    if (s.bestWinStreak) facts.push({ icon: '🔥', text: t('fact.bestStreak', { name: s.bestWinStreak.name, n: s.bestWinStreak.streaks.bestWin }) });
    if (s.worstLoseStreak) facts.push({ icon: '🧊', text: t('fact.worstStreak', { name: s.worstLoseStreak.name, n: s.worstLoseStreak.streaks.bestLose }) });
    if (s.topChampion) facts.push({ icon: '🎭', text: t('fact.topChampion', { name: s.topChampion.name, n: s.topChampion.games }) });
    if (s.bestChampion) facts.push({ icon: '🏅', text: t('fact.bestChampion', { name: s.bestChampion.name, wins: wins(s.bestChampion.wins), games: s.bestChampion.games }) });
    if (s.cursedChampion) facts.push({ icon: '😬', text: t('fact.cursedChampion', { name: s.cursedChampion.name, games: s.cursedChampion.games }) });
    if (s.matches >= 3) facts.push({ icon: '🔵🔴', text: t('fact.sides', { blue: wins(s.blueWins), red: wins(s.redWins) }) });
    return facts;
}
function badgeIcons(list) { return (list || []).map(b => b.icon).join(''); }
