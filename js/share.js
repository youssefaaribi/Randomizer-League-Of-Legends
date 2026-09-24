// ── Partage du résultat : texte pour Discord, image (copiée ou enregistrée) ──
// Le partage utilise le résultat affiché, donc aussi les échanges et relances faits après le tirage.

function shareInfo() {
    if (!currentAssignment) return null;
    return { a: currentAssignment, mode: currentMode(), date: new Date() };
}

// ── Texte Discord (le gras s'écrit **comme ça**) ──
function buildDiscordText() {
    const info = shareInfo();
    if (!info) return '';
    const { a, mode, date } = info;
    const lines = [t(a.rematch ? 'share.text.rematch' : 'share.text.ready', { mode: mode.label, date: date.toLocaleDateString(LOCALE) }), ''];
    [['blue', '🔵 **TEAM BLUE**'], ['red', '🔴 **TEAM RED**']].forEach(([side, title], idx) => {
        if (idx) lines.push('');
        lines.push(title);
        a[side].forEach((p, i) => {
            if (!a.hasRoles) { lines.push(i === 0 ? t('share.text.captain', { name: p.name }) : `• ${p.name}`); return; }
            const champ = a.champions && a.champions[p.id];
            lines.push(t('share.text.row', { role: roles[i], name: p.name }) + (champ ? ` — ${champ.name}` : ''));
        });
    });
    return lines.join('\n');
}

async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { /* repli ci-dessous (contexte non sécurisé, permission refusée) */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* ignoré */ }
    ta.remove();
    return ok;
}

// ── Image (dessinée sur un canvas) ──
// Une icône qui ne se charge pas (hors ligne, bloquée) est simplement omise : l'image reste valable.
function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // nécessaire pour pouvoir exporter le canvas ensuite
        const timer = setTimeout(() => resolve(null), 5000);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = url;
    });
}

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Écrit `text` en le coupant avec … s'il dépasse maxWidth
function fitText(ctx, text, x, y, maxWidth) {
    let shown = text;
    while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) shown = shown.slice(0, -1);
    ctx.fillText(shown === text ? shown : shown.slice(0, -1) + '…', x, y);
}

async function buildShareCanvas() {
    const info = shareInfo();
    if (!info) return null;
    const { a, mode, date } = info;

    // Icônes des rôles et des champions, chargées en parallèle
    const roleImgs = {}, champImgs = {};
    const jobs = [];
    if (a.hasRoles) roles.forEach(r => jobs.push(loadImage(roleIconUrls[r]).then(img => { roleImgs[r] = img; })));
    if (a.champions) Object.entries(a.champions).forEach(([id, c]) => jobs.push(loadImage(championIconUrl(c)).then(img => { champImgs[id] = img; })));
    jobs.push(Promise.race([document.fonts.load('700 26px Orbitron'), wait(1500)]).catch(() => {}));
    await Promise.all(jobs);

    const W = 1200, ROW_H = 76, GAP = 10, TOP = 160, COL_W = 500;
    const H = TOP + TEAM_SIZE * (ROW_H + GAP) + 60;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = "'Orbitron', 'Segoe UI', sans-serif";
    const C = themePalette(); // couleurs du thème actuel : l'image suit le thème choisi

    // Fond + cadre doré
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, C.bgA); bg.addColorStop(1, C.bgC);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.border; ctx.lineWidth = 4; roundedRect(ctx, 6, 6, W - 12, H - 12, 14); ctx.stroke();

    // Titre
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gold = ctx.createLinearGradient(0, 40, 0, 100);
    gold.addColorStop(0, C.light); gold.addColorStop(0.5, C.gold); gold.addColorStop(1, C.deep);
    ctx.fillStyle = gold; ctx.font = `900 54px ${FONT}`;
    ctx.fillText(a.rematch ? t('versus.rematch') : t('versus.ready'), W / 2, 72);
    ctx.fillStyle = C.muted; ctx.font = `400 20px ${FONT}`;
    ctx.fillText(`${mode.label} · ${date.toLocaleDateString(LOCALE)}`, W / 2, 122);

    // Deux colonnes
    ctx.textAlign = 'left';
    [['blue', 40, '#0088cc', 'rgba(0,136,204,0.28)'], ['red', W - 40 - COL_W, '#cc3300', 'rgba(204,51,0,0.28)']].forEach(([side, x, color, tint]) => {
        a[side].forEach((p, i) => {
            const y = TOP + i * (ROW_H + GAP), midY = y + ROW_H / 2;
            const grad = ctx.createLinearGradient(x, 0, x + COL_W, 0);
            grad.addColorStop(0, tint); grad.addColorStop(1, C.input);
            ctx.fillStyle = grad; roundedRect(ctx, x, y, COL_W, ROW_H, 10); ctx.fill();
            ctx.strokeStyle = color; ctx.lineWidth = 2; roundedRect(ctx, x, y, COL_W, ROW_H, 10); ctx.stroke();

            // Rôle (icône) ou 👑 / numéro en mode Capitaines
            let textX = x + 20;
            if (a.hasRoles) {
                if (roleImgs[roles[i]]) ctx.drawImage(roleImgs[roles[i]], x + 16, midY - 18, 36, 36);
                else { ctx.fillStyle = C.gold; ctx.font = `700 16px ${FONT}`; ctx.fillText(roles[i], x + 16, midY); }
                textX = x + 68;
            } else {
                ctx.fillStyle = C.gold; ctx.font = `700 20px ${FONT}`;
                ctx.fillText(i === 0 ? '👑' : `#${i + 1}`, x + 18, midY);
                textX = x + 72;
            }

            // Champion (icône à droite + nom)
            const champ = a.champions && a.champions[p.id];
            let rightEdge = x + COL_W - 16;
            if (champ) {
                if (champImgs[p.id]) { ctx.drawImage(champImgs[p.id], rightEdge - 56, midY - 28, 56, 56); rightEdge -= 66; }
                ctx.fillStyle = C.gold; ctx.font = `400 15px ${FONT}`; ctx.textAlign = 'right';
                fitText(ctx, champ.name, rightEdge, midY, 152); ctx.textAlign = 'left';
                rightEdge -= 162;
            }

            ctx.fillStyle = C.light; ctx.font = `700 27px ${FONT}`;
            fitText(ctx, p.name, textX, midY, rightEdge - textX);
        });
    });

    // VS + pied de page
    ctx.textAlign = 'center';
    ctx.fillStyle = gold; ctx.font = `900 46px ${FONT}`;
    ctx.fillText('VS', W / 2, TOP + (TEAM_SIZE * (ROW_H + GAP)) / 2 - 8);
    ctx.fillStyle = C.mutedDark; ctx.font = `400 16px ${FONT}`;
    ctx.fillText('LoL Team Randomizer', W / 2, H - 28);
    return canvas;
}

function canvasToBlob(canvas) { return new Promise(resolve => canvas.toBlob(resolve, 'image/png')); }

function downloadBlob(blob, prefix = 'match') {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Boutons ──
// Affiche un message court sur le bouton, puis remet son texte
function flashButton(btn, message) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = message;
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 2200);
}

async function shareCopyText(btn) {
    flashButton(btn, (await copyToClipboard(buildDiscordText())) ? t('flash.copied') : t('flash.copyFailed'));
}

async function shareCopyImage(btn) {
    flashButton(btn, t('flash.creating'));
    const canvas = await buildShareCanvas();
    const blob = canvas && await canvasToBlob(canvas);
    if (!blob) { flashButton(btn, t('flash.imageFailed')); return; }
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        flashButton(btn, t('flash.imageCopied'));
    } catch (e) { // copie d'image refusée par le navigateur : on enregistre le fichier à la place
        downloadBlob(blob);
        flashButton(btn, t('flash.savedInstead'));
    }
}

async function shareSaveImage(btn) {
    flashButton(btn, t('flash.creating'));
    const canvas = await buildShareCanvas();
    const blob = canvas && await canvasToBlob(canvas);
    if (!blob) { flashButton(btn, t('flash.imageFailed')); return; }
    downloadBlob(blob);
    flashButton(btn, t('flash.saved'));
}

// Les mêmes boutons existent sur l'écran final et sous le résultat : on les branche par classe
function initShare() {
    document.querySelectorAll('.share-text-btn').forEach(b => b.addEventListener('click', () => shareCopyText(b)));
    document.querySelectorAll('.share-image-btn').forEach(b => b.addEventListener('click', () => shareCopyImage(b)));
    document.querySelectorAll('.share-save-btn').forEach(b => b.addEventListener('click', () => shareSaveImage(b)));
}
