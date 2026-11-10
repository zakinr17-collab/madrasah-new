(function () {
    const A = window.GAME_ARENA_V3_ASSETS || {};
    const META = Object.freeze({
        tug_war: { no:'1.', title:'TARIK TAMBANG', subtitle:'Kekuatan Bersama, Raih Kemenangan!', bg:String(A['background.tug-war']||'') },
        base_battle: { no:'2.', title:'BASE BATTLE', subtitle:'Lindungi Markas, Taklukkan Lawan!', bg:String(A['background.base-battle']||'') },
        battle_royale: { no:'3.', title:'BATTLE ROYALE', subtitle:'Bertahan Hingga Akhir!', bg:String(A['background.battle-royale']||'') },
        quiz_race: { no:'4.', title:'QUIZ RACE', subtitle:'Jawab Cepat, Melaju Hebat!', bg:String(A['background.quiz-race']||'') },
        laser_duel: { no:'5.', title:'LASER DUEL', subtitle:'Tembak, Hindar, Menang!', bg:String(A['background.laser-duel']||'') }
    });
    let scheduled = false;

    function modeOf(stage){ return String(stage?.getAttribute('data-arena-stage') || ''); }
    function widthOf(stage){ return Math.max(280, stage?.getBoundingClientRect?.().width || 0); }

    function ensureBanner(stage, meta){
        let banner = stage.querySelector(':scope > .arena-v2-banner,:scope > .arena-v3-banner');
        if (!banner){ banner = document.createElement('div'); stage.appendChild(banner); }
        banner.className = 'arena-v3-banner';
        banner.innerHTML = `<span class="arena-v3-number">${meta.no}</span><span class="arena-v3-copy"><b>${meta.title}</b><small>${meta.subtitle}</small></span>`;
    }

    function ensureFx(stage, mode){
        let fx = stage.querySelector(':scope > .arena-v3-fx-layer');
        if (!fx){ fx = document.createElement('div'); fx.className = 'arena-v3-fx-layer'; stage.appendChild(fx); }
        if (fx.dataset.mode === mode) return;
        fx.dataset.mode = mode;
        if (mode === 'laser_duel') fx.innerHTML = '<i class="arena-v3-laser blue"></i><i class="arena-v3-laser red"></i><b class="arena-v3-clash"></b>';
        else if (mode === 'tug_war') fx.innerHTML = '<i class="arena-v3-rope"></i><b class="arena-v3-knot"></b><span class="arena-v3-dust dust-a"></span><span class="arena-v3-dust dust-b"></span>';
        else if (mode === 'base_battle') fx.innerHTML = '<i class="arena-v3-shot shot-a"></i><i class="arena-v3-shot shot-b"></i><b class="arena-v3-impact"></b>';
        else if (mode === 'quiz_race') fx.innerHTML = '<i class="arena-v3-speed speed-1"></i><i class="arena-v3-speed speed-2"></i><i class="arena-v3-speed speed-3"></i><i class="arena-v3-speed speed-4"></i>';
        else fx.innerHTML = '<b class="arena-v3-loot-pulse"></b>';
    }

    function replaceScene(stage, meta){
        const scene = stage.querySelector(':scope > .arena-scene-bg');
        if (scene && meta.bg && scene.getAttribute('src') !== meta.bg){ scene.setAttribute('src', meta.bg); scene.setAttribute('alt', `${meta.title} arena`); }
    }

    function removeLegacyVisuals(stage){
        stage.querySelectorAll('img.arena-fx-img').forEach(el => el.style.display = 'none');
        stage.querySelectorAll('.arena-laser-impact-ref,.arena-pulse-ring,.arena-smoke-puff').forEach(el => el.style.display = 'none');
    }

    function layoutLaser(stage, desktop){
        const anchors = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-character-wrap'));
        anchors.forEach((el,index)=>{
            el.style.bottom = desktop ? '34%' : '17%';
            if (index === 0){ el.style.left = desktop ? '12%' : '5%'; el.style.right = ''; }
            else { el.style.right = desktop ? '12%' : '5%'; el.style.left = ''; }
        });
    }

    function layoutTug(stage, desktop){
        const groups = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-team-a,.arena-team-b'));
        groups.forEach((group,index)=>{
            group.style.bottom = desktop ? '35%' : '17%';
            if(index===0){group.style.left=desktop?'7%':'2%';group.style.right='';}
            else{group.style.right=desktop?'7%':'2%';group.style.left='';}
        });
        stage.querySelectorAll('.arena-team-a,.arena-team-b').forEach(team=>{
            team.style.gap='0';
            Array.from(team.children).forEach((child,i)=> child.style.marginLeft = i ? (desktop?'-13px':'-10px') : '0');
        });
    }

    function layoutBase(stage, desktop){
        Array.from(stage.querySelectorAll('[data-arena-base-side]')).forEach(side=>{
            side.style.top = desktop ? '49%' : '50%';
            side.style.transform = 'translateY(-50%)';
            if(side.getAttribute('data-arena-base-side')==='A'){side.style.left=desktop?'6%':'2%';side.style.right='';}
            else{side.style.right=desktop?'6%':'2%';side.style.left='';}
        });
        stage.querySelectorAll('.arena-base-teamline').forEach(line=>{line.style.marginTop='0';line.style.gap='0';});
    }

    function layoutBattle(stage, desktop){
        const coordsDesktop=[[17,28],[34,24],[53,29],[75,23],[27,47],[48,45],[69,49],[83,43],[18,64],[38,62],[60,65],[79,62]];
        const coordsMobile=[[20,25],[45,23],[72,27],[30,43],[58,42],[80,46],[20,60],[48,59],[75,62]];
        const coords=desktop?coordsDesktop:coordsMobile;
        Array.from(stage.querySelectorAll('[data-arena-player-id]')).forEach((p,i)=>{ const c=coords[i%coords.length]; p.style.left=`${c[0]}%`; p.style.top=`${c[1]}%`; });
    }

    function layoutRace(stage, desktop){
        const rank=stage.querySelector('.arena-race-rank');
        if(rank){rank.style.top=desktop?'74px':'62px';rank.style.width=desktop?'28%':'42%';}
        Array.from(stage.querySelectorAll('.arena-race-car')).forEach((car,i)=>{car.style.filter='none';car.style.zIndex=String(28+i);});
    }

    function decorateStage(stage){
        const mode=modeOf(stage); const meta=META[mode]; if(!meta) return;
        const desktop=widthOf(stage)>720;
        stage.classList.add('arena-v3-stage'); replaceScene(stage,meta); ensureBanner(stage,meta); ensureFx(stage,mode); removeLegacyVisuals(stage);
        if(mode==='laser_duel') layoutLaser(stage,desktop);
        if(mode==='tug_war') layoutTug(stage,desktop);
        if(mode==='base_battle') layoutBase(stage,desktop);
        if(mode==='battle_royale') layoutBattle(stage,desktop);
        if(mode==='quiz_race') layoutRace(stage,desktop);
    }

    function decoratePanels(){
        document.querySelectorAll('.arena-ref-bottom').forEach(bottom=>bottom.classList.add('arena-v3-bottom'));
        document.querySelectorAll('.arena-answer-option').forEach(btn=>btn.classList.add('arena-v3-answer'));
        document.querySelectorAll('.arena-action-tile').forEach(btn=>btn.classList.add('arena-v3-action'));
    }

    function injectStyles(){
        if(document.getElementById('arena-v3-master-styles')) return;
        const style=document.createElement('style'); style.id='arena-v3-master-styles';
        style.textContent=`
        .arena-ref-shell{background:#05172f!important;border:2px solid #5fc7ff!important;border-radius:18px!important;overflow:hidden!important;box-shadow:0 20px 58px rgba(1,12,29,.46)!important}
        .arena-ref-wrap{background:#05172f!important}
        .arena-ref-wrap>[data-arena-stage]{min-height:660px!important;padding-bottom:232px!important;border-radius:0!important}
        .arena-v3-stage{position:relative!important;background:#071c38!important;color:#fff!important;overflow:hidden!important}
        .arena-v3-stage>.arena-scene-bg{object-fit:cover!important;filter:saturate(1.08) contrast(1.02)!important}
        .arena-v3-banner{position:absolute;left:12px;top:10px;z-index:88;display:flex;align-items:center;gap:9px;max-width:49%;padding:7px 12px 7px 7px;border-radius:14px;background:linear-gradient(180deg,rgba(3,30,65,.98),rgba(2,17,38,.95));border:1px solid rgba(112,205,255,.85);box-shadow:0 7px 20px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.15);backdrop-filter:blur(8px)}
        .arena-v3-number{display:grid;place-items:center;min-width:40px;height:40px;border-radius:999px;background:#0b2d58;border:2px solid #79d3ff;font-size:22px;font-weight:1000;line-height:1}
        .arena-v3-copy{display:flex;flex-direction:column;line-height:1.03;min-width:0}.arena-v3-copy b{font-size:20px;font-weight:1000;white-space:nowrap;letter-spacing:-.025em}.arena-v3-copy small{font-size:9px;font-weight:900;color:#e5f5ff;margin-top:4px;white-space:nowrap}
        .arena-v3-stage>.absolute.inset-x-3.top-3{top:64px!important;left:12px!important;right:12px!important}
        [data-arena-stage="battle_royale"]>.absolute.top-3.left-3.right-3{top:63px!important}
        [data-arena-stage="quiz_race"]>.absolute.top-3.left-3.right-3{top:12px!important;left:auto!important;right:12px!important;width:auto!important}
        .arena-hud-glass,.arena-score-pill{background:linear-gradient(180deg,rgba(4,37,77,.96),rgba(2,21,49,.94))!important;border:1px solid rgba(114,205,255,.7)!important;color:#fff!important;box-shadow:0 7px 20px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.15)!important}
        .arena-hud-bar{height:17px!important;background:#06162e!important;border:1px solid rgba(255,255,255,.72)!important;box-shadow:0 4px 13px rgba(0,0,0,.28)!important}
        .arena-avatar-tag{background:#061a34!important;border:1px solid rgba(255,255,255,.76)!important;border-radius:5px!important;font-size:9px!important;max-width:92px!important;padding:3px 7px!important;text-shadow:0 1px 2px #000;box-shadow:0 3px 9px rgba(0,0,0,.35)!important}
        .arena-v3-bottom{left:14px!important;right:14px!important;bottom:12px!important;gap:7px!important;z-index:96!important}
        .arena-v3-bottom>div{border-radius:15px!important;background:linear-gradient(180deg,rgba(8,53,96,.99),rgba(4,28,61,.99))!important;border:1px solid #67c8ff!important;color:#fff!important;box-shadow:0 9px 26px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.12)!important}
        .arena-v3-bottom .grid.grid-cols-2{grid-template-columns:repeat(4,minmax(0,1fr))!important}
        .arena-v3-answer{background:linear-gradient(180deg,#fff,#eef5ff)!important;color:#102c50!important;border:1px solid #b5c8dc!important;border-radius:9px!important;min-height:42px!important;box-shadow:0 2px 7px rgba(0,0,0,.15)!important}
        .arena-v3-answer span{background:#e6eef8!important;color:#173b63!important}
        .arena-v3-answer:hover,.arena-v3-answer:focus-visible,.arena-v3-answer.arena-v3-selected{background:linear-gradient(180deg,#4ade80,#22c55e)!important;color:#fff!important;border-color:#bdf9d0!important;box-shadow:0 0 0 2px rgba(255,255,255,.55),0 5px 14px rgba(34,197,94,.38)!important}
        .arena-v3-answer:hover span,.arena-v3-answer.arena-v3-selected span{background:rgba(255,255,255,.22)!important;color:#fff!important}
        .arena-v3-action{background:linear-gradient(180deg,#143f73,#08284e)!important;border:1px solid rgba(115,204,255,.72)!important;border-radius:10px!important}
        .arena-v3-fx-layer{position:absolute;inset:0;z-index:24;pointer-events:none;overflow:hidden}
        .arena-v3-rope{position:absolute;left:16%;right:16%;top:61%;height:10px;border-radius:999px;background:repeating-linear-gradient(90deg,#7c4b20 0 14px,#d39a50 14px 27px);box-shadow:0 3px 4px rgba(0,0,0,.35);transform:rotate(-1deg)}
        .arena-v3-knot{position:absolute;left:50%;top:59%;width:32px;height:42px;transform:translateX(-50%);border-radius:45%;background:repeating-linear-gradient(45deg,#a56323 0 7px,#e3ad62 7px 14px);box-shadow:0 4px 8px rgba(0,0,0,.34)}
        .arena-v3-dust{position:absolute;top:64%;width:70px;height:24px;border-radius:50%;background:radial-gradient(ellipse,rgba(248,223,181,.7),rgba(211,158,96,.2) 60%,transparent 72%);filter:blur(2px);animation:arenaV3Dust 1.1s ease-out infinite}.dust-a{left:22%}.dust-b{right:22%;animation-delay:.35s}
        .arena-v3-laser{position:absolute;top:58%;height:8px;width:42%;border-radius:99px;filter:drop-shadow(0 0 7px currentColor) drop-shadow(0 0 15px currentColor);animation:arenaV3Beam .55s ease-in-out infinite}.arena-v3-laser.blue{left:18%;background:linear-gradient(90deg,#1d4ed8,#fff);color:#22d3ee;transform:rotate(-1deg)}.arena-v3-laser.red{right:18%;background:linear-gradient(270deg,#ef4444,#fff);color:#fb7185;transform:rotate(1deg)}
        .arena-v3-clash{position:absolute;left:50%;top:55%;width:82px;height:82px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0 8%,#fde68a 9% 18%,#f0abfc 24%,#22d3ee 37%,transparent 68%);filter:drop-shadow(0 0 20px #fff);animation:arenaV3Clash .5s ease-in-out infinite}
        .arena-v3-shot{position:absolute;top:56%;height:7px;width:25%;border-radius:99px;filter:drop-shadow(0 0 8px currentColor);animation:arenaV3Shot .8s ease-in-out infinite}.shot-a{left:26%;background:#67e8f9;color:#22d3ee}.shot-b{right:26%;background:#fb7185;color:#fb7185;animation-delay:.25s}.arena-v3-impact{position:absolute;left:50%;top:56%;width:50px;height:50px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0 10%,#fbbf24 18%,#fb7185 38%,transparent 70%);animation:arenaV3Clash .65s ease-in-out infinite}
        .arena-v3-loot-pulse{position:absolute;left:50%;top:49%;width:120px;height:120px;transform:translate(-50%,-50%);border:3px solid rgba(125,211,252,.7);border-radius:50%;animation:arenaV3Pulse 1.35s ease-out infinite}
        .arena-v3-speed{position:absolute;left:8%;width:18%;height:6px;border-radius:99px;filter:blur(.3px);animation:arenaV3Speed .55s linear infinite}.speed-1{top:48%;background:linear-gradient(90deg,transparent,#38bdf8)}.speed-2{top:55%;background:linear-gradient(90deg,transparent,#fb7185)}.speed-3{top:62%;background:linear-gradient(90deg,transparent,#4ade80)}.speed-4{top:69%;background:linear-gradient(90deg,transparent,#fbbf24)}
        @keyframes arenaV3Dust{0%{opacity:0;transform:scale(.5)}50%{opacity:.8}100%{opacity:0;transform:scale(1.25) translateY(-8px)}}
        @keyframes arenaV3Beam{0%,100%{opacity:.72}50%{opacity:1;height:11px}}
        @keyframes arenaV3Clash{0%,100%{scale:.86;opacity:.8}50%{scale:1.15;opacity:1}}
        @keyframes arenaV3Shot{0%{transform:translateX(-20px);opacity:.2}50%{opacity:1}100%{transform:translateX(20px);opacity:.25}}
        @keyframes arenaV3Pulse{0%{scale:.4;opacity:.8}100%{scale:1.7;opacity:0}}
        @keyframes arenaV3Speed{0%{transform:translateX(-25px);opacity:.25}100%{transform:translateX(80px);opacity:.9}}
        @media(max-width:720px){
          .arena-ref-wrap>[data-arena-stage]{min-height:500px!important;padding-bottom:12px!important}
          .arena-v3-banner{left:8px;top:8px;max-width:64%;padding:5px 8px 5px 5px;border-radius:10px}.arena-v3-number{min-width:31px;height:31px;font-size:16px}.arena-v3-copy b{font-size:13px}.arena-v3-copy small{font-size:7px;white-space:normal}
          .arena-v3-stage>.absolute.inset-x-3.top-3{top:50px!important;left:8px!important;right:8px!important}
          [data-arena-stage="battle_royale"]>.absolute.top-3.left-3.right-3{top:49px!important}
          .arena-v3-bottom{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;padding:8px!important;background:#05172f!important}
          .arena-v3-bottom .grid.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .arena-v3-answer{min-height:40px!important;padding:9px 10px!important;font-size:10px!important}
          .arena-v3-rope{top:66%}.arena-v3-knot{top:64%}.arena-v3-dust{top:68%}.arena-v3-laser{top:63%}.arena-v3-clash{top:60%}.arena-v3-shot,.arena-v3-impact{top:61%}
        }
        @media(prefers-reduced-motion:reduce){.arena-v3-fx-layer *{animation:none!important}}
        `;
        document.head.appendChild(style);
    }

    function enhance(){ scheduled=false; document.querySelectorAll('[data-arena-stage]').forEach(decorateStage); decoratePanels(); }
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance);}
    function start(){
        injectStyles(); schedule();
        new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
        window.addEventListener('resize',schedule,{passive:true});
        document.addEventListener('click',event=>{
            const target=event.target instanceof Element?event.target.closest('.arena-v3-answer'):null;
            if(!target)return;
            target.closest('.arena-v3-bottom')?.querySelectorAll('.arena-v3-answer').forEach(el=>el.classList.remove('arena-v3-selected'));
            target.classList.add('arena-v3-selected');
        },true);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();