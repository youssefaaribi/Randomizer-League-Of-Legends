// ── Effets sonores générés par le navigateur (Web Audio) : aucun fichier à charger ──
const sfx = (() => {
    let audioCtx = null;
    let enabled = true;
    const MASTER_GAIN = 0.35;
    // Couleur des sons d'un thème : toutes les notes sont multipliées par `pitch`, et certains timbres sont remplacés
    // (ex. waves = { triangle: 'sawtooth' } rend les notes douces plus agressives). Voir js/themes.js.
    let theme = { pitch: 1, waves: {} };

    function ctx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // Une note avec une enveloppe courte (attaque rapide, décroissance exponentielle)
    function tone({ freq, dur = 0.15, type = 'sine', gain = 0.2, delay = 0, slideTo = null }) {
        if (!enabled) return;
        const c = ctx(); if (!c) return;
        const t = c.currentTime + delay;
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = theme.waves[type] || type;
        osc.frequency.setValueAtTime(freq * theme.pitch, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo * theme.pitch, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain * MASTER_GAIN, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(t); osc.stop(t + dur + 0.03);
    }

    return {
        setEnabled(on) { enabled = on; },
        isEnabled() { return enabled; },
        setTheme(profile) { theme = { pitch: profile.pitch || 1, waves: profile.waves || {} }; },
        // À appeler dans un clic : les navigateurs n'autorisent le son qu'après une action de l'utilisateur
        unlock() { ctx(); },

        // Petit "tic" de la roulette, de plus en plus aigu au fil de l'animation (progress de 0 à 1)
        tick(progress) { tone({ freq: 500 + progress * 500, dur: 0.04, type: 'square', gain: 0.12 }); },

        // Pick validé : un choc grave + deux notes (plus aiguës côté Blue, plus graves côté Red)
        lockIn(side) {
            tone({ freq: 140, dur: 0.18, gain: 0.5, slideTo: 50 });
            const notes = side === 'blue' ? [523.25, 783.99] : [392, 587.33];
            notes.forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.3, delay: i * 0.09 }));
        },

        // Champion révélé : petit "ding" brillant
        champion() {
            [988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.25, delay: i * 0.07 }));
        },

        // Jingles des intros spéciales. Renvoie leur durée en ms (0 si aucun, ou si les effets sonores sont coupés).
        jingle(id) {
            if (!enabled) return 0;
            switch (id) {
                case 'fanfare':
                    this.fanfare(); return 1300;
                case 'airhorn':
                    [349, 466, 554].forEach(f => tone({ freq: f, dur: 0.75, type: 'sawtooth', gain: 0.3, slideTo: f * 0.94 }));
                    return 800;
                case 'drumroll':
                    for (let i = 0; i < 28; i++) tone({ freq: 110 + i * 2, dur: 0.06, type: 'square', gain: 0.1 + i * 0.006, delay: i * 0.035 });
                    tone({ freq: 90, dur: 0.45, gain: 0.55, slideTo: 40, delay: 1.05 });
                    tone({ freq: 1400, dur: 0.35, type: 'sawtooth', gain: 0.15, delay: 1.05, slideTo: 600 });
                    return 1500;
                case 'sad':
                    [[233, 220, 0], [220, 208, 0.42], [208, 196, 0.84]].forEach(([f, to, delay]) =>
                        tone({ freq: f, dur: 0.4, type: 'sawtooth', gain: 0.25, delay, slideTo: to }));
                    tone({ freq: 196, dur: 0.9, type: 'sawtooth', gain: 0.28, delay: 1.26, slideTo: 92 });
                    return 2200;
                default: return 0;
            }
        },

        // Début du tour d'un capitaine
        turn() { tone({ freq: 660, dur: 0.25, gain: 0.3 }); },

        countdown(isGo) {
            if (isGo) [523.25, 659.25, 783.99].forEach(f => tone({ freq: f, dur: 0.5, type: 'sawtooth', gain: 0.18 }));
            else tone({ freq: 440, dur: 0.22, type: 'square', gain: 0.2 });
        },

        fanfare() {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
                tone({ freq: f, dur: i === 3 ? 0.9 : 0.25, type: 'sawtooth', gain: 0.22, delay: i * 0.13 }));
        }
    };
})();
