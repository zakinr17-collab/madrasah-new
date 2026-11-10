(function(){
  const lastHp=new Map();
  let scheduled=false;

  function parseHp(stage,side){
    const base=stage.querySelector(`[data-arena-base-side="${side}"]`);
    const direct=Number(base?.getAttribute('data-arena-base-hp'));
    if(Number.isFinite(direct)) return Math.max(0,Math.min(100,direct));
    const panels=Array.from(stage.querySelectorAll(':scope > .arena-hud-glass'));
    const panel=panels.find(el=>new RegExp(`Tim\\s*${side}`,'i').test(el.textContent||'')&&/HP\s*\d+\s*\/\s*100/i.test(el.textContent||''));
    const match=(panel?.textContent||'').match(/HP\s*(\d+)\s*\/\s*100/i);
    return match?Math.max(0,Math.min(100,Number(match[1]))):100;
  }
  function parseShield(stage,side){
    const base=stage.querySelector(`[data-arena-base-side="${side}"]`);
    const direct=Number(base?.getAttribute('data-arena-base-shield'));
    if(Number.isFinite(direct)) return Math.max(0,direct);
    const panels=Array.from(stage.querySelectorAll(':scope > .arena-hud-glass'));
    const panel=panels.find(el=>new RegExp(`Tim\\s*${side}`,'i').test(el.textContent||'')&&/Shield\s*\d+/i.test(el.textContent||''));
    const match=(panel?.textContent||'').match(/Shield\s*(\d+)/i);return match?Math.max(0,Number(match[1])):0;
  }
  function damageState(hp){return hp<=0?'destroyed':hp<=25?'critical':hp<=60?'cracked':'intact';}
  function contextKey(stage,side){
    const host=stage.closest('[data-arena-room-id],[data-arena-monitor-room],[data-arena-room]');
    const id=host?.getAttribute('data-arena-room-id')||host?.getAttribute('data-arena-monitor-room')||host?.getAttribute('data-arena-room')||host?.id||'live';
    return `${id}:${side}`;
  }
  function markup(side){
    return `<div class="arena-base-v9-shell" aria-hidden="true">
      <span class="arena-base-v9-glow"></span>
      <span class="arena-base-v9-tower tower-left"><i></i><b></b></span>
      <span class="arena-base-v9-keep"><i></i><b></b><em></em></span>
      <span class="arena-base-v9-tower tower-right"><i></i><b></b></span>
      <span class="arena-base-v9-wall"></span>
      <span class="arena-base-v9-core"></span>
      <span class="arena-base-v9-crack crack-a"></span><span class="arena-base-v9-crack crack-b"></span>
      <span class="arena-base-v9-fire fire-a"></span><span class="arena-base-v9-fire fire-b"></span>
      <span class="arena-base-v9-smoke smoke-a"></span><span class="arena-base-v9-smoke smoke-b"></span>
      <span class="arena-base-v9-rubble rubble-a"></span><span class="arena-base-v9-rubble rubble-b"></span><span class="arena-base-v9-rubble rubble-c"></span>
      <small class="arena-base-v9-label">MARKAS ${side}</small>
    </div>`;
  }
  function decorateSide(stage,side){
    const node=stage.querySelector(`[data-arena-base-side="${side}"]`);if(!node)return;
    const hp=parseHp(stage,side),shield=parseShield(stage,side),state=damageState(hp),key=contextKey(stage,side);
    let structure=node.querySelector(':scope > .arena-base-v9-structure');
    if(!structure){structure=document.createElement('div');structure.className='arena-base-v9-structure';structure.dataset.arenaBaseStructureV9='true';structure.innerHTML=markup(side);const team=node.querySelector(':scope > .arena-base-teamline');node.insertBefore(structure,team||node.firstChild);}
    structure.dataset.side=side;structure.dataset.state=state;structure.dataset.hp=String(hp);structure.dataset.shield=String(shield);
    node.dataset.arenaBaseState=state;node.dataset.arenaBaseHp=String(hp);
    node.style.setProperty('z-index','34','important');
    node.querySelectorAll(':scope > .arena-castle-img').forEach(el=>{el.style.setProperty('display','none','important');el.setAttribute('aria-hidden','true');});
    const prev=lastHp.get(key);
    if(Number.isFinite(prev)&&hp<prev){
      structure.classList.remove('arena-base-v9-hit','arena-base-v9-collapse');void structure.offsetWidth;
      structure.classList.add(hp<=0?'arena-base-v9-collapse':'arena-base-v9-hit');
      setTimeout(()=>structure.classList.remove('arena-base-v9-hit'),520);
    }
    lastHp.set(key,hp);
  }
  function decorate(stage){decorateSide(stage,'A');decorateSide(stage,'B');}
  function applyAll(){scheduled=false;document.querySelectorAll('[data-arena-stage="base_battle"]').forEach(decorate);}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(applyAll);}
  function injectStyles(){
    if(document.getElementById('arena-base-v9-styles'))return;
    const style=document.createElement('style');style.id='arena-base-v9-styles';style.textContent=`
      [data-arena-stage="base_battle"] [data-arena-base-side]{overflow:visible!important;min-width:154px}
      [data-arena-stage="base_battle"] .arena-castle-img{display:none!important}
      .arena-base-v9-structure{--team:#38bdf8;--team2:#1d4ed8;position:relative;width:154px;height:132px;margin:0 auto 2px;z-index:34;transform-origin:50% 100%;filter:drop-shadow(0 9px 7px rgba(0,0,0,.42))}
      .arena-base-v9-structure[data-side="B"]{--team:#fb7185;--team2:#be123c}
      .arena-base-v9-shell{position:absolute;inset:0}
      .arena-base-v9-glow{position:absolute;left:50%;bottom:13px;width:136px;height:52px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,color-mix(in srgb,var(--team) 48%,transparent),transparent 68%);filter:blur(8px);opacity:.65}
      .arena-base-v9-wall{position:absolute;left:21px;right:21px;bottom:20px;height:55px;border:4px solid #101827;border-radius:8px 8px 13px 13px;background:linear-gradient(180deg,var(--team),var(--team2));box-shadow:inset 0 8px rgba(255,255,255,.16),inset 0 -9px rgba(0,0,0,.2)}
      .arena-base-v9-wall:before{content:"";position:absolute;left:8px;right:8px;top:-15px;height:18px;background:repeating-linear-gradient(90deg,var(--team2) 0 16px,transparent 16px 25px);clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}
      .arena-base-v9-tower{position:absolute;bottom:23px;width:34px;height:76px;border:4px solid #101827;border-radius:8px 8px 11px 11px;background:linear-gradient(90deg,var(--team2),var(--team));z-index:2}.tower-left{left:8px}.tower-right{right:8px}
      .arena-base-v9-tower:before{content:"";position:absolute;left:-4px;right:-4px;top:-12px;height:17px;background:var(--team);border:4px solid #101827;border-bottom:0;clip-path:polygon(0 0,27% 0,27% 38%,50% 38%,50% 0,76% 0,76% 38%,100% 38%,100% 100%,0 100%)}
      .arena-base-v9-tower i{position:absolute;left:50%;top:26px;width:11px;height:20px;transform:translateX(-50%);border-radius:8px 8px 2px 2px;background:#061326;border:2px solid rgba(255,255,255,.28)}
      .arena-base-v9-keep{position:absolute;left:50%;bottom:24px;width:66px;height:91px;transform:translateX(-50%);border:4px solid #101827;border-radius:10px 10px 8px 8px;background:linear-gradient(135deg,var(--team),var(--team2));z-index:3;box-shadow:inset 0 9px rgba(255,255,255,.15)}
      .arena-base-v9-keep:before{content:"";position:absolute;left:-4px;right:-4px;top:-13px;height:18px;background:var(--team);border:4px solid #101827;border-bottom:0;clip-path:polygon(0 0,22% 0,22% 38%,39% 38%,39% 0,61% 0,61% 38%,78% 38%,78% 0,100% 0,100% 100%,0 100%)}
      .arena-base-v9-keep i{position:absolute;left:50%;bottom:0;width:24px;height:36px;transform:translateX(-50%);border-radius:15px 15px 0 0;background:#07162d;border:3px solid rgba(255,255,255,.22)}
      .arena-base-v9-keep b{position:absolute;left:10px;top:24px;width:10px;height:16px;border-radius:7px;background:#dff8ff;box-shadow:36px 0 #dff8ff,0 0 12px var(--team),36px 0 12px var(--team)}
      .arena-base-v9-core{position:absolute;left:50%;top:49px;width:19px;height:19px;transform:translateX(-50%) rotate(45deg);border:3px solid #fff;border-radius:5px;background:var(--team);box-shadow:0 0 15px var(--team);z-index:5}
      .arena-base-v9-label{position:absolute;left:50%;bottom:1px;transform:translateX(-50%);white-space:nowrap;padding:2px 7px;border-radius:999px;background:rgba(3,14,31,.88);border:1px solid rgba(255,255,255,.25);font:900 8px/1.25 system-ui;color:#fff;letter-spacing:.05em;z-index:8}
      .arena-base-v9-crack{display:none;position:absolute;z-index:7;width:4px;height:41px;background:#061326;clip-path:polygon(0 0,100% 0,55% 28%,100% 43%,40% 67%,75% 100%,0 100%,28% 69%,0 48%,42% 27%)}.crack-a{left:60px;top:48px;rotate:18deg}.crack-b{right:47px;top:63px;rotate:-25deg;height:31px}
      .arena-base-v9-smoke{display:none;position:absolute;z-index:9;width:27px;height:27px;border-radius:50%;background:radial-gradient(circle,rgba(203,213,225,.8),rgba(71,85,105,.34) 55%,transparent 72%);filter:blur(1px);animation:baseV9Smoke 1.35s ease-out infinite}.smoke-a{left:39px;top:9px}.smoke-b{right:29px;top:24px;animation-delay:.55s}
      .arena-base-v9-fire{display:none;position:absolute;z-index:8;width:20px;height:31px;background:linear-gradient(#fff7ae,#fb923c 47%,#ef4444);clip-path:polygon(50% 0,72% 31%,100% 57%,76% 100%,25% 100%,0 58%,30% 34%);filter:drop-shadow(0 0 8px #fb923c);animation:baseV9Fire .42s ease-in-out infinite}.fire-a{left:32px;top:54px}.fire-b{right:27px;top:67px;animation-delay:.16s}
      .arena-base-v9-rubble{display:none;position:absolute;bottom:16px;width:28px;height:17px;background:var(--team2);border:3px solid #101827;border-radius:5px;z-index:8}.rubble-a{left:22px;rotate:-15deg}.rubble-b{left:64px;rotate:9deg}.rubble-c{right:16px;rotate:19deg}
      .arena-base-v9-structure[data-state="cracked"] .arena-base-v9-crack,.arena-base-v9-structure[data-state="critical"] .arena-base-v9-crack{display:block}
      .arena-base-v9-structure[data-state="cracked"] .arena-base-v9-shell{filter:saturate(.88) brightness(.94)}
      .arena-base-v9-structure[data-state="critical"] .arena-base-v9-smoke,.arena-base-v9-structure[data-state="critical"] .arena-base-v9-fire{display:block}
      .arena-base-v9-structure[data-state="critical"] .arena-base-v9-shell{animation:baseV9Critical .75s ease-in-out infinite}
      .arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-wall,.arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-tower,.arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-keep,.arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-core{opacity:.12;transform:translateY(40px) rotate(7deg);transition:transform .65s cubic-bezier(.2,.8,.2,1),opacity .55s}
      .arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-rubble,.arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-smoke{display:block}
      .arena-base-v9-structure[data-state="destroyed"] .arena-base-v9-glow{opacity:.12}
      .arena-base-v9-hit{animation:baseV9Hit .5s ease-out}
      .arena-base-v9-collapse{animation:baseV9Collapse .72s ease-out}
      @keyframes baseV9Hit{0%,100%{translate:0 0}18%{translate:-5px 1px}36%{translate:5px -1px}54%{translate:-3px 0}72%{translate:2px 0}}
      @keyframes baseV9Critical{0%,100%{filter:brightness(.92) saturate(1.12)}50%{filter:brightness(1.18) saturate(1.38) drop-shadow(0 0 11px #fb7185)}}
      @keyframes baseV9Collapse{0%{transform:translateY(0) scale(1)}42%{transform:translateY(5px) rotate(-2deg) scale(.98)}100%{transform:translateY(14px) scale(.96)}}
      @keyframes baseV9Smoke{0%{opacity:0;transform:translateY(8px) scale(.55)}35%{opacity:.75}100%{opacity:0;transform:translateY(-25px) scale(1.35)}}
      @keyframes baseV9Fire{0%,100%{transform:scale(.85) rotate(-2deg)}50%{transform:scale(1.12) rotate(3deg)}}
      @media(max-width:720px){.arena-base-v9-structure{width:126px;height:112px;transform:scale(.86);transform-origin:center bottom}[data-arena-stage="base_battle"] [data-arena-base-side]{min-width:126px}}
      @media(prefers-reduced-motion:reduce){.arena-base-v9-structure,.arena-base-v9-shell,.arena-base-v9-smoke,.arena-base-v9-fire{animation:none!important}}
    `;document.head.appendChild(style);
  }
  function start(){injectStyles();applyAll();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});window.addEventListener('resize',schedule,{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();