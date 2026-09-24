const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [], confettiAnimId = null;
// Les deux premières couleurs suivent le thème (voir themeColor dans js/themes.js) ; les autres sont fixes
const confettiFixed = ['#0088cc', '#cc3300', '#ffcc00', '#38ef7d', '#ff6b6b', '#a855f7', '#3b82f6', '#ef4444'];
let confettiColors = confettiFixed;

function resizeCanvas() { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }

function spawnBurst(count, startY, spreadX, spreadVy) {
    for (let i = 0; i < count; i++) confettiParticles.push({
        x: Math.random() * confettiCanvas.width, y: startY + (Math.random() - 0.5) * 100,
        w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        vx: (Math.random() - 0.5) * spreadX, vy: Math.random() * spreadVy + 1.5,
        rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10, opacity: 1
    });
}

function animateConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); let alive = false;
    confettiParticles.forEach(p => {
        if (p.opacity <= 0) return; alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.rotSpeed;
        if (p.y > confettiCanvas.height * 0.75) p.opacity -= 0.015;
        confettiCtx.save(); confettiCtx.translate(p.x, p.y); confettiCtx.rotate((p.rot * Math.PI) / 180);
        confettiCtx.globalAlpha = Math.max(0, p.opacity); confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); confettiCtx.restore();
    });
    if (alive) confettiAnimId = requestAnimationFrame(animateConfetti);
    else { confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); confettiAnimId = null; }
}

function launchConfetti() {
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    confettiColors = [themeColor('--gold'), themeColor('--gold-light'), ...confettiFixed];
    confettiParticles = []; spawnBurst(200, -100, 4, 3); animateConfetti();
    setTimeout(() => spawnBurst(120, -50, 6, 2), 500);
    setTimeout(() => spawnBurst(80, -30, 5, 2.5), 1000);
}

function stopConfetti() {
    if (confettiAnimId) { cancelAnimationFrame(confettiAnimId); confettiAnimId = null; }
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}
