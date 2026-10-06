(function () {
    const META = Object.freeze({
        tug_war: { no: '1.', title: 'TARIK TAMBANG', subtitle: 'Kekuatan Bersama, Raih Kemenangan!', bg: '/assets/game-arena-v2/backgrounds/tug-war.svg' },
        base_battle: { no: '2.', title: 'BASE BATTLE', subtitle: 'Lindungi Markas, Taklukkan Lawan!', bg: '/assets/game-arena-v2/backgrounds/base-battle.svg' },
        battle_royale: { no: '3.', title: 'BATTLE ROYALE', subtitle: 'Bertahan Hingga Akhir!', bg: '/assets/game-arena-v2/backgrounds/battle-royale.svg' },
        quiz_race: { no: '4.', title: 'QUIZ RACE', subtitle: 'Jawab Cepat, Melaju Hebat!', bg: '/assets/game-arena-v2/backgrounds/quiz-race.svg' },
        laser_duel: { no: '5.', title: 'LASER DUEL', subtitle: 'Tembak, Hindar, Menang!', bg: '/assets/game-arena-v2/backgrounds/laser-duel.svg' }
    });
    let scheduled = false;

    function modeOf(stage) { return String(stage?.getAttribute('data-arena-stage') || ''); }

    function ensureBanner(stage, meta) {
        if (stage.querySelector(':scope > .arena-v2-banner')) return;
        const banner = document.createElement('div');
        banner.className = 'arena-v2-banner';
        banner.innerHTML = `<span class="arena-v2-number">${meta.no}</span><span class="arena-v2-banner-copy"><b>${meta.title}</b><small>${meta.subtitle}</small></span>`;
        stage.appendChild(banner);
    }

    function replaceScene(stage, meta) {
        const scene = stage.querySelector(':scope > .arena-scene-bg');
        if (!scene) return;
        if (scene.getAttribute('src') !== meta.bg) scene.setAttribute('src', meta.bg);
        scene.setAttribute('alt', `${meta.title} arena`);
    }

    function decorateMode(stage, mode) {
        const width = Math.max(280, stage.getBoundingClientRect().width || 0);
        const desktop = width > 720;
        stage.classList.add('arena-v2-stage');

        if (mode === 'laser_duel') {
            const anchors = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-character-wrap'));
            anchors.forEach((anchor, index) => {
                anchor.style.bottom = desktop ? '29%' : '17%';
                if (index === 0) anchor.style.left = desktop ? '12%' : '6%';
                else anchor.style.right = desktop ? '12%' : '6%';
            });
        }

        if (mode === 'tug_war') {
            const groups = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-team-a, .arena-team-b'));
            groups.forEach((group, index) => {
                group.style.bottom = desktop ? '27%' : '16%';
                if (index === 0) group.style.left = desktop ? '7%' : '2%';
                else group.style.right = desktop ? '7%' : '2%';
            });
        }

        if (mode === 'base_battle') {
            stage.querySelectorAll('.arena-castle-img').forEach(el => { el.style.display = 'none'; });
            stage.querySelectorAll('[data-arena-base-side]').forEach(side => {
                side.style.top = desktop ? '47%' : '49%';
                side.style.transform = 'translateY(-50%)';
            });
            stage.querySelectorAll('.arena-base-teamline').forEach(line => {
                line.style.marginTop = '0';
                line.style.gap = '0';
            });
        }

        if (mode === 'battle_royale') {
            const players = Array.from(stage.querySelectorAll('[data-arena-player-id]'));
            players.forEach((player, index) => {
                if (desktop) {
                    const coords = [[18,28],[34,24],[54,29],[76,24],[27,48],[49,46],[70,50],[84,44],[18,67],[38,65],[61,68],[80,65]];
                    const c = coords[index % coords.length];
                    player.style.left = `${c[0]}%`;
                    player.style.top = `${c[1]}%`;
                }
            });
        }

        if (mode === 'quiz_race') {
            const rank = stage.querySelector('.arena-race-rank');
            if (rank) {
                rank.style.top = desktop ? '76px' : '68px';
                rank.style.width = desktop ? '28%' : '39%';
            }
            stage.querySelectorAll('.arena-race-car').forEach(car => { car.style.filter = 'drop-shadow(0 7px 4px rgba(0,0,0,.38))'; });
        }
    }

    function decorateStage(stage) {
        const mode = modeOf(stage);
        const meta = META[mode];
        if (!meta) return;
        replaceScene(stage, meta);
        ensureBanner(stage, meta);
        decorateMode(stage, mode);
    }

    function decorateQuestionPanels() {
        document.querySelectorAll('.arena-ref-bottom').forEach(bottom => bottom.classList.add('arena-v2-bottom'));
        document.querySelectorAll('.arena-answer-option').forEach(option => option.classList.add('arena-v2-answer'));
        document.querySelectorAll('.arena-action-tile').forEach(tile => tile.classList.add('arena-v2-action'));
    }

    function injectStyles() {
        if (document.getElementById('game-arena-v2-master-styles')) return;
        const style = document.createElement('style');
        style.id = 'game-arena-v2-master-styles';
        style.textContent = `
          .arena-ref-shell{background:#071b34!important;border:2px solid #4bb8ff!important;border-radius:18px!important;box-shadow:0 18px 50px rgba(2,15,35,.42)!important}
          .arena-ref-wrap{background:#071b34!important}
          .arena-ref-wrap>[data-arena-stage]{min-height:660px!important;border-radius:0!important;padding-bottom:230px!important}
          .arena-v2-stage{background:#0a1f3d!important;color:white;overflow:hidden!important}
          .arena-v2-stage .arena-scene-bg{object-fit:cover!important;filter:saturate(1.08) contrast(1.03)}
          .arena-v2-banner{position:absolute;left:12px;top:10px;z-index:72;display:flex;align-items:center;gap:9px;max-width:48%;padding:7px 12px 7px 8px;border-radius:14px;background:linear-gradient(180deg,rgba(4,27,57,.96),rgba(2,17,38,.92));border:1px solid rgba(121,202,255,.7);box-shadow:0 6px 18px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.14);backdrop-filter:blur(7px)}
          .arena-v2-number{display:grid;place-items:center;min-width:38px;height:38px;border-radius:999px;background:#09264c;border:2px solid #78ceff;color:white;font-size:21px;font-weight:1000;line-height:1}
          .arena-v2-banner-copy{display:flex;flex-direction:column;min-width:0;line-height:1.04}.arena-v2-banner-copy b{font-size:19px;font-weight:1000;letter-spacing:-.02em;white-space:nowrap}.arena-v2-banner-copy small{font-size:9px;font-weight:800;color:#e6f5ff;margin-top:4px;white-space:nowrap}
          .arena-v2-stage>.absolute.inset-x-3.top-3{top:62px!important;left:12px!important;right:12px!important}
          [data-arena-stage="battle_royale"]>.absolute.top-3.left-3.right-3{top:61px!important}
          [data-arena-stage="quiz_race"]>.absolute.top-3.left-3.right-3{top:12px!important;left:auto!important;right:12px!important;width:auto!important;justify-content:flex-end!important}
          .arena-hud-glass,.arena-score-pill{background:linear-gradient(180deg,rgba(4,33,67,.94),rgba(2,19,42,.91))!important;border:1px solid rgba(122,205,255,.56)!important;color:#fff!important;box-shadow:0 7px 18px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.13)!important}
          .arena-hud-bar{height:16px!important;border:1px solid rgba(255,255,255,.64)!important;background:#05152d!important;box-shadow:0 4px 12px rgba(0,0,0,.25)!important}
          .arena-avatar-tag{background:#07172e!important;border:1px solid rgba(255,255,255,.7)!important;border-radius:5px!important;font-size:9px!important;max-width:92px!important;padding:3px 7px!important;text-shadow:0 1px 2px #000;box-shadow:0 3px 8px rgba(0,0,0,.35)!important}
          .arena-v2-bottom{left:14px!important;right:14px!important;bottom:12px!important;gap:7px!important}
          .arena-v2-bottom>div{border-radius:14px!important;background:linear-gradient(180deg,rgba(8,48,88,.98),rgba(5,29,59,.98))!important;border:1px solid #62bdff!important;color:#fff!important;box-shadow:0 8px 24px rgba(0,0,0,.28)!important}
          .arena-v2-answer{background:linear-gradient(180deg,#fff,#edf5ff)!important;color:#0c2445!important;border:1px solid #a6bdd8!important;border-radius:9px!important;box-shadow:0 2px 6px rgba(0,0,0,.14)!important;text-align:left!important;min-height:42px!important}
          .arena-v2-answer span{background:#e6eef8!important;color:#18385d!important}
          .arena-v2-answer:hover,.arena-v2-answer:focus-visible,.arena-v2-answer.arena-v2-selected{background:linear-gradient(180deg,#4ade80,#22c55e)!important;color:#fff!important;border-color:#b9f6ce!important;box-shadow:0 0 0 2px rgba(255,255,255,.6),0 5px 12px rgba(34,197,94,.35)!important}
          .arena-v2-answer.arena-v2-selected span,.arena-v2-answer:hover span{background:rgba(255,255,255,.22)!important;color:#fff!important}
          .arena-v2-action{border-radius:10px!important;background:linear-gradient(180deg,#123d70,#08284f)!important;border:1px solid rgba(115,199,255,.65)!important;min-height:44px!important}
          [data-arena-stage="base_battle"] .arena-shield-fx{opacity:.38!important}
          [data-arena-stage="base_battle"] .arena-base-teamline{transform:scale(1.03)}
          [data-arena-stage="laser_duel"] .arena-laser-impact-ref{filter:drop-shadow(0 0 18px #fff) drop-shadow(0 0 32px #f0abfc)!important}
          [data-arena-stage="quiz_race"] .arena-race-rank{background:rgba(5,31,61,.93)!important}
          @media(max-width:720px){
            .arena-ref-wrap>[data-arena-stage]{min-height:500px!important;padding-bottom:12px!important}
            .arena-v2-banner{left:8px;top:8px;max-width:62%;padding:5px 8px 5px 5px;border-radius:10px}.arena-v2-number{min-width:30px;height:30px;font-size:16px}.arena-v2-banner-copy b{font-size:13px}.arena-v2-banner-copy small{font-size:7px;white-space:normal}
            .arena-v2-stage>.absolute.inset-x-3.top-3{top:50px!important;left:8px!important;right:8px!important}
            [data-arena-stage="battle_royale"]>.absolute.top-3.left-3.right-3{top:49px!important}
            .arena-v2-bottom{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;padding:8px!important;background:#071b34!important}
            .arena-v2-bottom>div{border-radius:12px!important}.arena-v2-answer{min-height:40px!important;padding:9px 10px!important;font-size:10px!important}
            [data-arena-stage="battle_royale"] .arena-avatar-tag{max-width:55px!important;font-size:7px!important}
          }
          @media(prefers-reduced-motion:reduce){.arena-v2-stage *{scroll-behavior:auto!important}}
        `;
        document.head.appendChild(style);
    }

    function enhance() {
        scheduled = false;
        document.querySelectorAll('[data-arena-stage]').forEach(decorateStage);
        decorateQuestionPanels();
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(enhance);
    }

    function start() {
        injectStyles();
        schedule();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', schedule, { passive: true });
        document.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target.closest('.arena-v2-answer') : null;
            if (!target) return;
            target.closest('.arena-v2-bottom')?.querySelectorAll('.arena-v2-answer').forEach(el => el.classList.remove('arena-v2-selected'));
            target.classList.add('arena-v2-selected');
        }, true);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
