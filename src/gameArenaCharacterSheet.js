(function () {
    const A = window.GAME_ARENA_V3_ASSETS || {};
    const POSES = ['idle','run','attack','hit','win'];
    const asset = key => String(A[key] || '');
    const ALL_ASSETS = Object.values(A).filter(value => /^data:image\//.test(String(value || '')));
    let ready = false;
    let scheduled = false;

    function hash(value) {
        const s = String(value || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function modeOf(wrap) {
        return String(wrap?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage') || '');
    }

    function sideOf(wrap) {
        if (wrap.closest('.arena-team-a,[data-arena-base-side="A"]')) return 'A';
        if (wrap.closest('.arena-team-b,[data-arena-base-side="B"]')) return 'B';
        const stage = wrap.closest('[data-arena-stage]');
        if (!stage) return '';
        const wrappers = Array.from(stage.querySelectorAll('.arena-character-wrap'));
        const index = wrappers.indexOf(wrap);
        if (modeOf(wrap) === 'laser_duel') return index <= 0 ? 'A' : 'B';
        const player = wrap.closest('[data-arena-player-id]');
        return hash(player?.getAttribute('data-arena-player-id') || index) % 2 ? 'B' : 'A';
    }

    function poseOf(wrap, mode) {
        if (mode === 'tug_war') return 'run';
        if (mode === 'base_battle') return 'attack';
        if (mode === 'battle_royale') {
            const player = wrap.closest('[data-arena-player-id]');
            if (player?.classList.contains('opacity-45') || player?.classList.contains('grayscale')) return 'hit';
            return 'attack';
        }
        return 'idle';
    }

    function assetFor(wrap) {
        const mode = modeOf(wrap);
        const side = sideOf(wrap);
        if (mode === 'laser_duel') return asset(`modechar.laser-${side === 'B' ? 'red' : 'blue'}`);
        const gender = side === 'B' ? 'female' : 'male';
        return asset(`character.${gender}-${poseOf(wrap, mode)}`);
    }

    function sizeFor(stage, mode) {
        const w = Math.max(280, stage.getBoundingClientRect().width || 0);
        const mobile = w <= 720;
        const compact = w <= 430;
        if (mode === 'laser_duel') return compact ? [108,126] : mobile ? [122,142] : [154,178];
        if (mode === 'tug_war') return compact ? [46,58] : mobile ? [54,66] : [66,80];
        if (mode === 'base_battle') return compact ? [38,48] : mobile ? [44,55] : [52,64];
        if (mode === 'battle_royale') return compact ? [40,50] : mobile ? [46,57] : [54,66];
        return compact ? [44,54] : mobile ? [52,62] : [60,72];
    }

    function enhanceCharacter(wrap) {
        if (!ready || !wrap) return;
        const stage = wrap.closest('[data-arena-stage]');
        if (!stage) return;
        const mode = modeOf(wrap);
        let img = wrap.querySelector(':scope > .arena-v3-character');
        if (!img) {
            img = document.createElement('img');
            img.className = 'arena-v3-character';
            img.alt = '';
            img.setAttribute('aria-hidden', 'true');
            wrap.appendChild(img);
        }
        const src = assetFor(wrap);
        if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
        const [width,height] = sizeFor(stage, mode);
        wrap.style.width = `${width}px`;
        wrap.style.height = `${height}px`;
        wrap.classList.add('arena-v3-character-ready');
        wrap.querySelectorAll(':scope > .arena-character-core,:scope > .arena-sheet-sprite').forEach(el => {
            el.style.display = 'none';
            el.setAttribute('aria-hidden','true');
        });
        const side = sideOf(wrap);
        img.style.transform = (side === 'B' && mode !== 'laser_duel' && mode !== 'battle_royale') ? 'scaleX(-1)' : '';
        wrap.dataset.arenaV3Side = side;
        wrap.dataset.arenaV3Pose = poseOf(wrap, mode);
    }

    function enhanceRace(stage) {
        const cars = Array.from(stage.querySelectorAll('.arena-race-car'));
        const colors = ['blue','red','green','yellow'];
        cars.forEach((car,index) => {
            const color = colors[index % colors.length];
            const vehicle = car.querySelector('img[src*="/vehicles/"], img.arena-race-vehicle');
            if (vehicle) {
                vehicle.src = asset(`vehicle.kart-${color}`);
                vehicle.classList.add('arena-v3-kart');
                vehicle.style.width = stage.getBoundingClientRect().width <= 720 ? '86px' : '118px';
                vehicle.style.height = 'auto';
                vehicle.style.visibility = 'visible';
            }
            car.querySelectorAll('img[src$="speed-lines.svg"]').forEach(el => el.style.display = 'none');
            car.dataset.arenaV3Kart = color;
        });
    }

    function enhanceAll() {
        scheduled = false;
        if (!ready) return;
        document.querySelectorAll('.arena-character-wrap').forEach(enhanceCharacter);
        document.querySelectorAll('[data-arena-stage="quiz_race"]').forEach(enhanceRace);
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(enhanceAll);
    }

    function injectStyles() {
        if (document.getElementById('arena-v3-character-styles')) return;
        const style = document.createElement('style');
        style.id = 'arena-v3-character-styles';
        style.textContent = `
          .arena-character-wrap > .arena-character-core{visibility:hidden!important}
          [data-arena-stage="quiz_race"] .arena-race-car img[src*="/vehicles/"]{visibility:hidden!important}
          .arena-character-wrap.arena-v3-character-ready{position:relative!important;display:block!important;overflow:visible!important}
          .arena-v3-character{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 7px 4px rgba(0,0,0,.38));pointer-events:none;user-select:none;transform-origin:50% 100%}
          [data-arena-stage="tug_war"] [data-arena-v3-side="A"] .arena-v3-character{animation:arenaV3PullA .78s ease-in-out infinite}
          [data-arena-stage="tug_war"] [data-arena-v3-side="B"] .arena-v3-character{animation:arenaV3PullB .78s ease-in-out infinite}
          [data-arena-stage="base_battle"] .arena-v3-character{animation:arenaV3Combat .9s ease-in-out infinite}
          [data-arena-stage="battle_royale"] .arena-v3-character{animation:arenaV3Scout 1.5s ease-in-out infinite}
          [data-arena-stage="laser_duel"] .arena-v3-character{animation:arenaV3Combat .8s ease-in-out infinite}
          .arena-v3-kart{object-fit:contain!important;filter:drop-shadow(0 7px 4px rgba(0,0,0,.42))!important;animation:arenaV3KartBounce .42s ease-in-out infinite}
          @keyframes arenaV3PullA{0%,100%{transform:translateX(0) rotate(-3deg)}50%{transform:translateX(-4px) rotate(-8deg)}}
          @keyframes arenaV3PullB{0%,100%{transform:scaleX(-1) translateX(0) rotate(-3deg)}50%{transform:scaleX(-1) translateX(-4px) rotate(-8deg)}}
          @keyframes arenaV3Combat{0%,100%{translate:0 0}50%{translate:0 -3px}}
          @keyframes arenaV3Scout{0%,100%{translate:0 0}50%{translate:0 -2px}}
          @keyframes arenaV3KartBounce{0%,100%{translate:0 0}50%{translate:0 -2px}}
          @media(prefers-reduced-motion:reduce){.arena-v3-character,.arena-v3-kart{animation:none!important}}
        `;
        document.head.appendChild(style);
    }

    function preload() {
        let remaining = ALL_ASSETS.length;
        let success = 0;
        if (!remaining) { ready = true; schedule(); return; }
        ALL_ASSETS.forEach(src => {
            const image = new Image();
            image.onload = () => { success++; if (--remaining === 0) { ready = success > 0; schedule(); } };
            image.onerror = () => { if (--remaining === 0) { ready = success > 0; schedule(); } };
            image.src = src;
        });
    }

    function start() {
        injectStyles();
        preload();
        new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
        window.addEventListener('resize',schedule,{passive:true});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
})();