// ── Récap de la soirée : texte Discord et image (dans le style de l'image de match) ──
// Une "soirée" = des parties (avec vainqueur) qui se suivent : un écart de plus de 5 h entre deux parties en commence une nouvelle.
const SESSION_GAP_MS = 5 * 60 * 60 * 1000;
let recapSessionStart = null; // début (en ms) de la soirée choisie ; null = la plus récente

// Les soirées, de la plus récente à la plus ancienne : { start, matches }
function groupSessions(matches, gapMs = SESSION_GAP_MS) {
    const played = matches.filter(m => m.winner).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const sessions = [];
    let current = null, lastTs = 0;
    played.forEach(m => {
        const ts = Date.parse(m.date);
        if (!current || ts - lastTs > gapMs) { current = { start: ts, matches: [] }; sessions.push(current); }
        current.matches.push(m); lastTs = ts;
    });
    return sessions.reverse();
}

function sessionLabel(s) {
    const d = new Date(s.start).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
    return `${d} · ${tp('count.games', s.matches.length)}`;
}

function selectedSession() {
    const sessions = groupSessions(matchHistory);
    return sessions.find(s => s.start === recapSessionStart) || sessions[0] || null;
}

// ── Texte Discord ──
function buildRecapText(session) {
    if (!session) return '';
    const stats = computeStats(session.matches), facts = describeStats(stats);
    const date = new Date(session.start).toLocaleDateString(LOCALE);
    const lines = [t('recap.text.title', { date }),
        t('recap.text.summary', { games: tp('count.games', stats.matches), blue: tp('count.wins', stats.blueWins), red: tp('count.wins', stats.redWins) }), '',
        t('recap.text.board')];
    stats.ranking.slice(0, 10).forEach((r, i) => {
        const icons = badgeIcons(stats.badges.get(r.id));
        lines.push(t('recap.text.row', { rank: i + 1, name: r.name, wins: r.wins, losses: r.losses, rate: pct(r.rate) }) + (icons ? ' ' + icons : ''));
    });
    if (facts.length) { lines.push('', t('recap.text.facts')); facts.slice(0, 6).forEach(f => lines.push(`• ${f.icon} ${f.text}`)); }
    return lines.join('\n');
}

// ── Image ──
// Coupe un texte en lignes qui tiennent dans maxWidth (la dernière est terminée par … si elle est trop longue)
function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = text.split(' '), lines = [];
    let line = '';
    words.forEach(w => {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width <= maxWidth || !line) line = test;
        else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        let last = lines[maxLines - 1];
        while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = last + '…';
    }
    return lines;
}

async function buildRecapCanvas(session) {
    if (!session) return null;
    const stats = computeStats(session.matches), facts = describeStats(stats).slice(0, 6);
    const rows = stats.ranking.slice(0, 8);
    const C = themePalette();

    // Icônes des champions les plus tirés (seulement si la liste est disponible, sinon on saute cette bande)
    const topChamps = stats.topChampions.filter(c => c.games >= 1).slice(0, 6);
    let champIcons = [];
    if (topChamps.length) {
        await loadChampions();
        champIcons = await Promise.all(topChamps.map(c => {
            const found = (c.id && championById(c.id)) || championData.list.find(x => x.name === c.name);
            return found ? loadImage(championIconUrl(found)) : Promise.resolve(null);
        }));
    }
    const showChamps = topChamps.length > 0 && champIcons.some(Boolean);
    await Promise.race([document.fonts.load('700 26px Orbitron'), wait(1500)]).catch(() => {});

    const W = 1200, ROW_H = 66, FACT_H = 80, HEAD = 170, COL_W = 540;
    const bodyH = Math.max(rows.length * ROW_H + 50, facts.length * FACT_H + 50, 160);
    const H = HEAD + bodyH + (showChamps ? 190 : 20) + 60;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = "'Orbitron', 'Segoe UI', sans-serif";

    // Fond + cadre
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, C.bgA); bg.addColorStop(1, C.bgC);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.border; ctx.lineWidth = 4; roundedRect(ctx, 6, 6, W - 12, H - 12, 14); ctx.stroke();

    // Titre
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gold = ctx.createLinearGradient(0, 40, 0, 100);
    gold.addColorStop(0, C.light); gold.addColorStop(0.5, C.gold); gold.addColorStop(1, C.deep);
    ctx.fillStyle = gold; ctx.font = `900 50px ${FONT}`;
    ctx.fillText(t('recap.img.title'), W / 2, 68);
    ctx.fillStyle = C.muted; ctx.font = `400 20px ${FONT}`;
    ctx.fillText(`${sessionLabel(session)} · 🔵 ${stats.blueWins} — 🔴 ${stats.redWins}`, W / 2, 118);

    // Colonne gauche : classement
    ctx.textAlign = 'left';
    ctx.fillStyle = C.gold; ctx.font = `700 20px ${FONT}`;
    ctx.fillText(t('recap.img.board'), 50, HEAD - 10);
    rows.forEach((r, i) => {
        const y = HEAD + 14 + i * ROW_H, midY = y + (ROW_H - 12) / 2;
        const grad = ctx.createLinearGradient(40, 0, 40 + COL_W, 0);
        grad.addColorStop(0, C.input); grad.addColorStop(1, C.bgA);
        ctx.fillStyle = grad; roundedRect(ctx, 40, y, COL_W, ROW_H - 10, 10); ctx.fill();
        ctx.strokeStyle = i === 0 ? C.gold : C.border; ctx.lineWidth = i === 0 ? 3 : 1.5; roundedRect(ctx, 40, y, COL_W, ROW_H - 10, 10); ctx.stroke();
        // barre du pourcentage de victoires, sous la ligne
        ctx.fillStyle = C.gold; ctx.globalAlpha = 0.55; roundedRect(ctx, 52, y + ROW_H - 18, (COL_W - 24) * r.rate, 4, 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = C.gold; ctx.font = `900 22px ${FONT}`; ctx.fillText(`${i + 1}`, 58, midY);
        ctx.fillStyle = C.light; ctx.font = `700 24px ${FONT}`;
        const icons = badgeIcons(stats.badges.get(r.id));
        ctx.font = `700 24px ${FONT}`; fitText(ctx, r.name, 96, midY, COL_W - 96 - 150 - (icons ? 8 : 0) - (icons ? icons.length * 6 : 0));
        ctx.textAlign = 'right';
        ctx.fillStyle = C.gold; ctx.font = `700 20px ${FONT}`; ctx.fillText(t('recap.img.record', { wins: r.wins, losses: r.losses }), 40 + COL_W - 16, midY);
        if (icons) { ctx.font = `20px ${FONT}`; ctx.fillText(icons, 40 + COL_W - 118, midY); }
        ctx.textAlign = 'left';
    });

    // Colonne droite : faits marquants
    const RX = 620;
    ctx.fillStyle = C.gold; ctx.font = `700 20px ${FONT}`;
    ctx.fillText(t('recap.img.facts'), RX + 10, HEAD - 10);
    if (!facts.length) {
        ctx.fillStyle = C.muted; ctx.font = `400 16px ${FONT}`;
        wrapLines(ctx, t('recap.img.noFacts'), COL_W - 30, 3)
            .forEach((l, i) => ctx.fillText(l, RX + 14, HEAD + 40 + i * 26));
    }
    facts.forEach((f, i) => {
        const y = HEAD + 14 + i * FACT_H;
        ctx.fillStyle = C.input; roundedRect(ctx, RX, y, COL_W, FACT_H - 10, 10); ctx.fill();
        ctx.strokeStyle = C.border; ctx.lineWidth = 1.5; roundedRect(ctx, RX, y, COL_W, FACT_H - 10, 10); ctx.stroke();
        ctx.font = `26px ${FONT}`; ctx.fillStyle = C.gold; ctx.fillText(f.icon.slice(0, 2), RX + 14, y + (FACT_H - 10) / 2);
        ctx.fillStyle = C.light; ctx.font = `400 16px ${FONT}`;
        const lines = wrapLines(ctx, f.text, COL_W - 90, 2);
        lines.forEach((l, k) => ctx.fillText(l, RX + 66, y + (FACT_H - 10) / 2 + (k - (lines.length - 1) / 2) * 22));
    });

    // Champions les plus tirés
    if (showChamps) {
        const y0 = HEAD + bodyH + 10;
        ctx.textAlign = 'center';
        ctx.fillStyle = C.gold; ctx.font = `700 20px ${FONT}`; ctx.fillText(t('recap.img.champions'), W / 2, y0 + 10);
        const size = 84, gap = 46, shown = topChamps.map((c, i) => ({ c, img: champIcons[i] })).filter(x => x.img);
        const total = shown.length * size + (shown.length - 1) * gap, x0 = (W - total) / 2;
        shown.forEach(({ c, img }, i) => {
            const x = x0 + i * (size + gap);
            ctx.drawImage(img, x, y0 + 32, size, size);
            ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.strokeRect(x, y0 + 32, size, size);
            ctx.fillStyle = C.light; ctx.font = `400 14px ${FONT}`; fitText(ctx, c.name, x + size / 2, y0 + 32 + size + 16, size + gap - 6);
            ctx.fillStyle = C.muted; ctx.fillText(`× ${c.games}`, x + size / 2, y0 + 32 + size + 36);
        });
    }

    ctx.textAlign = 'center'; ctx.fillStyle = C.mutedDark; ctx.font = `400 16px ${FONT}`;
    ctx.fillText('LoL Team Randomizer', W / 2, H - 28);
    return canvas;
}

// ── Boutons (mêmes principes que le partage d'un match) ──
async function recapCopyText(btn) {
    flashButton(btn, (await copyToClipboard(buildRecapText(selectedSession()))) ? t('flash.copied') : t('flash.copyFailed'));
}

async function recapImageBlob(btn) {
    flashButton(btn, t('flash.creating'));
    const canvas = await buildRecapCanvas(selectedSession());
    const blob = canvas && await canvasToBlob(canvas);
    if (!blob) flashButton(btn, t('flash.imageFailed'));
    return blob;
}

async function recapCopyImage(btn) {
    const blob = await recapImageBlob(btn);
    if (!blob) return;
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        flashButton(btn, t('flash.imageCopied'));
    } catch (e) { downloadBlob(blob, 'recap'); flashButton(btn, t('flash.savedInstead')); }
}

async function recapSaveImage(btn) {
    const blob = await recapImageBlob(btn);
    if (!blob) return;
    downloadBlob(blob, 'recap');
    flashButton(btn, t('flash.saved'));
}

// Bloc affiché en haut de l'historique : choix de la soirée + boutons
function buildRecapBox() {
    const sessions = groupSessions(matchHistory);
    const box = el('div', 'recap-box');
    box.appendChild(el('h3', 'hist-title', t('recap.title')));
    if (!sessions.length) {
        box.appendChild(el('div', 'hist-empty', t('recap.empty')));
        return box;
    }
    const row = el('div', 'recap-row');
    const select = document.createElement('select');
    select.setAttribute('aria-label', t('recap.select.aria'));
    sessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = String(s.start); opt.textContent = sessionLabel(s);
        select.appendChild(opt);
    });
    const chosen = sessions.find(s => s.start === recapSessionStart) || sessions[0];
    select.value = String(chosen.start);
    select.addEventListener('change', () => { recapSessionStart = Number(select.value); });
    row.appendChild(select);

    [[t('recap.btn.text'), recapCopyText], [t('share.image'), recapCopyImage], [t('share.save'), recapSaveImage]].forEach(([label, fn]) => {
        const b = el('button', 'link-btn recap-btn', label);
        b.type = 'button'; b.dataset.label = label;
        b.addEventListener('click', () => fn(b));
        row.appendChild(b);
    });
    box.appendChild(row);
    return box;
}
