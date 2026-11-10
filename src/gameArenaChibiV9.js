(function () {
  const VERSION = 9;
  // CI retrigger after Actions re-enabled.
  const SOURCE_ID = 'uploaded-character-sheet-2026-09-20';
  const PARTS = [0,1,2,3,4].map(i => `/assets/game-arena-v9/chibi-atlas/part${i}.txt?v=${VERSION}`);
  const SHEET_W = 384, SHEET_H = 300, CELL_W = 48, CELL_H = 60;

  // Koordinat sumber asli 1491x1055. Atlas runtime di atas dinormalisasi dari
  // crop ini agar label/judul sheet tidak pernah ikut ter-render.
  const SOURCE_CROPS = Object.freeze({
    tug_war:{A:{idle:[8,100,120,289],pull:[138,100,245,289],strain:[265,100,368,289],victory:[382,100,492,289]},B:{idle:[8,335,120,520],pull:[138,335,245,520],strain:[265,335,368,520],victory:[382,335,492,520]}},
    base_battle:{A:{defend:[505,115,612,289],attack:[628,115,733,289],hit:[754,115,848,289],victory:[866,115,974,289]},B:{defend:[505,335,612,520],attack:[628,335,733,520],hit:[754,335,848,520],victory:[866,335,974,520]}},
    battle_royale:{A:{scout:[982,112,1088,289],attack:[1107,112,1206,289],hit:[1232,112,1336,289],victory:[1360,112,1486,289]},B:{scout:[982,335,1088,520],attack:[1107,335,1206,520],hit:[1232,335,1336,520],victory:[1360,335,1486,520]}},
    quiz_race:{blue:[2,692,136,930],red:[150,692,276,930],green:[292,692,418,930],yellow:[438,692,562,930],celebration:[570,695,895,930]},
    laser_duel:{A:{aim:[910,662,1033,785],fire:[1045,662,1168,785],hit:[1184,662,1308,785],victory:[1326,662,1485,785]},B:{aim:[910,833,1033,955],fire:[1045,833,1168,955],hit:[1184,833,1308,955],victory:[1326,833,1485,955]}}
  });

  const FRAMES = Object.freeze({
    tug_war:{A:{idle:[0,0],pull:[1,0],strain:[2,0],victory:[3,0]},B:{idle:[4,0],pull:[5,0],strain:[6,0],victory:[7,0]}},
    base_battle:{A:{defend:[0,1],attack:[1,1],hit:[2,1],victory:[3,1]},B:{defend:[4,1],attack:[5,1],hit:[6,1],victory:[7,1]}},
    battle_royale:{A:{scout:[0,2],attack:[1,2],hit:[2,2],victory:[3,2]},B:{scout:[4,2],attack:[5,2],hit:[6,2],victory:[7,2]}},
    laser_duel:{A:{aim:[0,3],fire:[1,3],hit:[2,3],victory:[3,3]},B:{aim:[4,3],fire:[5,3],hit:[6,3],victory:[7,3]}},
    quiz_race:{blue:[0,4],red:[1,4],green:[2,4],yellow:[3,4],celebration:[4,4]}
  });

  const ANIMS = Object.freeze({
    tug_war:{poses:['idle','pull','strain','pull'],ms:230},
    base_battle:{poses:['defend','attack','defend','attack'],ms:460},
    battle_royale:{poses:['scout','attack','scout','attack'],ms:620},
    laser_duel:{poses:['aim','aim','fire','aim'],ms:420}
  });

  let sheetUrl='', ready=false, scheduled=false, raf=0, lastTick=0;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function modeOf(node){ return String(node?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage')||''); }
  function hash(v){ let h=0,s=String(v||''); for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0; return Math.abs(h); }
  function sideOf(wrap){
    const preset=String(wrap?.dataset?.arenaV9Side||wrap?.dataset?.arenaGeneratedSide||wrap?.dataset?.arenaV3Side||'');
    if(preset==='A'||preset==='B') return preset;
    if(wrap.closest('.arena-team-a,[data-arena-base-side="A"]')) return 'A';
    if(wrap.closest('.arena-team-b,[data-arena-base-side="B"]')) return 'B';
    const stage=wrap.closest('[data-arena-stage]'); if(!stage)return 'A';
    const wraps=Array.from(stage.querySelectorAll('.arena-character-wrap'));
    if(modeOf(wrap)==='laser_duel') return wraps.indexOf(wrap)<=0?'A':'B';
    const player=wrap.closest('[data-arena-player-id]');
    return hash(player?.getAttribute('data-arena-player-id')||wraps.indexOf(wrap))%2?'B':'A';
  }
  function targetWidth(stage,mode){
    const w=Math.max(280,stage?.getBoundingClientRect?.().width||0), compact=w<=430, mobile=w<=720;
    if(mode==='tug_war') return compact?46:mobile?55:66;
    if(mode==='base_battle') return compact?42:mobile?49:58;
    if(mode==='battle_royale') return compact?42:mobile?50:58;
    if(mode==='laser_duel') return compact?62:mobile?70:80;
    return compact?62:mobile?76:98;
  }
  function applyFrame(el,frame,width){
    if(!ready||!frame||!sheetUrl)return;
    const scale=width/CELL_W,[col,row]=frame;
    el.style.width=`${Math.round(CELL_W*scale)}px`;
    el.style.height=`${Math.round(CELL_H*scale)}px`;
    el.style.backgroundImage=`url("${sheetUrl}")`;
    el.style.backgroundSize=`${Math.round(SHEET_W*scale)}px ${Math.round(SHEET_H*scale)}px`;
    el.style.backgroundPosition=`${Math.round(-col*CELL_W*scale)}px ${Math.round(-row*CELL_H*scale)}px`;
  }
  function frameFor(mode,side,pose){
    const m=FRAMES[mode]; if(!m||mode==='quiz_race')return null;
    const s=m[side]||m.A; return s?.[pose]||s?.[Object.keys(s)[0]]||null;
  }
  function defaultPose(mode){
    if(mode==='tug_war')return 'pull';
    if(mode==='base_battle')return 'defend';
    if(mode==='battle_royale')return 'scout';
    if(mode==='laser_duel')return 'aim';
    return '';
  }
  function setPose(sprite,pose){
    const wrap=sprite?.closest?.('.arena-character-wrap'),stage=sprite?.closest?.('[data-arena-stage]');
    if(!wrap||!stage)return;
    const mode=modeOf(sprite),side=sideOf(wrap),width=targetWidth(stage,mode),frame=frameFor(mode,side,pose);
    if(!frame)return;
    if(sprite.dataset.arenaV9Pose!==pose||sprite.dataset.arenaV9Width!==String(width)){
      applyFrame(sprite,frame,width);
      sprite.dataset.arenaV9Pose=pose; sprite.dataset.arenaV9Width=String(width);
    }
  }
  function enhanceCharacter(wrap){
    if(!ready||!wrap)return;
    const stage=wrap.closest('[data-arena-stage]'); if(!stage)return;
    const mode=modeOf(wrap); if(!FRAMES[mode]||mode==='quiz_race')return;
    const side=sideOf(wrap);
    let sprite=wrap.querySelector(':scope > .arena-chibi-v9');
    if(!sprite){ sprite=document.createElement('span'); sprite.className='arena-chibi-v9'; sprite.setAttribute('aria-hidden','true'); wrap.appendChild(sprite); }
    const width=targetWidth(stage,mode);
    wrap.style.setProperty('width',`${width}px`,'important');
    wrap.style.setProperty('height',`${Math.round(width*CELL_H/CELL_W)}px`,'important');
    wrap.dataset.arenaV9Side=side; wrap.classList.add('arena-chibi-v9-ready');
    sprite.dataset.arenaV9Mode=mode; sprite.dataset.arenaV9Side=side;
    const ident=wrap.closest('[data-arena-player-id]')?.getAttribute('data-arena-player-id')||Array.from(stage.querySelectorAll('.arena-character-wrap')).indexOf(wrap);
    sprite.dataset.arenaV9Phase=mode==='tug_war'?'0':String(hash(ident)%240);
    setPose(sprite,defaultPose(mode));
  }
  function enhanceRace(stage){
    if(!ready)return;
    const colors=['blue','red','green','yellow'], mobile=Math.max(280,stage.getBoundingClientRect().width||0)<=720;
    Array.from(stage.querySelectorAll('.arena-race-car')).forEach((car,index)=>{
      const color=colors[index%colors.length];
      let sprite=car.querySelector(':scope > .arena-kart-v9');
      if(!sprite){sprite=document.createElement('span');sprite.className='arena-kart-v9';sprite.setAttribute('aria-hidden','true');car.appendChild(sprite);}
      applyFrame(sprite,FRAMES.quiz_race[color],mobile?82:102);
      car.dataset.arenaV9Kart=color;
    });
  }
  function enhanceAll(){
    scheduled=false;if(!ready)return;
    document.querySelectorAll('[data-arena-stage] .arena-character-wrap').forEach(enhanceCharacter);
    document.querySelectorAll('[data-arena-stage="quiz_race"]').forEach(enhanceRace);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhanceAll);}
  function animate(ts){
    raf=requestAnimationFrame(animate);
    if(!ready||document.hidden||reduced?.matches||ts-lastTick<100)return;
    lastTick=ts;
    document.querySelectorAll('.arena-chibi-v9-ready>.arena-chibi-v9').forEach(sprite=>{
      const mode=String(sprite.dataset.arenaV9Mode||modeOf(sprite)),anim=ANIMS[mode]; if(!anim)return;
      const until=Number(sprite.dataset.arenaV9ManualUntil||0); if(until>ts)return;
      const phase=Number(sprite.dataset.arenaV9Phase||0),idx=Math.floor((ts+phase)/anim.ms)%anim.poses.length;
      setPose(sprite,anim.poses[idx]);
    });
  }
  function forcePose(target,pose,duration=720){
    const wrap=target?.closest?.('.arena-character-wrap')||target,sprite=wrap?.querySelector?.(':scope>.arena-chibi-v9');
    if(!sprite)return false;setPose(sprite,pose);sprite.dataset.arenaV9ManualUntil=String(performance.now()+Math.max(0,Number(duration)||0));return true;
  }
  function injectStyles(){
    if(document.getElementById('arena-chibi-v9-styles'))return;
    const style=document.createElement('style');style.id='arena-chibi-v9-styles';style.textContent=`
      [data-arena-stage] .arena-character-wrap>.arena-character-core,
      [data-arena-stage] .arena-character-wrap>.arena-sheet-sprite,
      [data-arena-stage] .arena-character-wrap>.arena-v3-character,
      [data-arena-stage] .arena-character-wrap>.arena-generated-chibi{display:none!important;visibility:hidden!important;opacity:0!important}
      [data-arena-stage="quiz_race"] .arena-race-car>img,
      [data-arena-stage="quiz_race"] .arena-race-car>.arena-v3-kart,
      [data-arena-stage="quiz_race"] .arena-race-car>.arena-generated-kart{display:none!important;visibility:hidden!important;opacity:0!important}
      .arena-character-wrap.arena-chibi-v9-ready{position:relative!important;display:block!important;visibility:visible!important;opacity:1!important;overflow:visible!important;z-index:32!important}
      .arena-chibi-v9{position:absolute;left:50%;bottom:0;display:block!important;visibility:visible!important;opacity:1!important;overflow:hidden;background-repeat:no-repeat;background-color:transparent;transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;user-select:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.38));z-index:33;will-change:transform}
      [data-arena-stage="tug_war"] [data-arena-v9-side="A"]>.arena-chibi-v9[data-arena-v9-pose="pull"]{transform:translateX(calc(-50% - 2px)) rotate(-3deg)}
      [data-arena-stage="tug_war"] [data-arena-v9-side="A"]>.arena-chibi-v9[data-arena-v9-pose="strain"]{transform:translateX(calc(-50% - 4px)) rotate(-5deg)}
      [data-arena-stage="tug_war"] [data-arena-v9-side="B"]>.arena-chibi-v9[data-arena-v9-pose="pull"]{transform:translateX(calc(-50% + 2px)) rotate(3deg)}
      [data-arena-stage="tug_war"] [data-arena-v9-side="B"]>.arena-chibi-v9[data-arena-v9-pose="strain"]{transform:translateX(calc(-50% + 4px)) rotate(5deg)}
      [data-arena-stage="laser_duel"] .arena-chibi-v9{transform:translateX(-50%)!important}
      [data-arena-stage="laser_duel"] .arena-chibi-v9[data-arena-v9-pose="fire"]{filter:drop-shadow(0 6px 4px rgba(0,0,0,.4)) drop-shadow(0 0 9px rgba(56,189,248,.45))}
      [data-arena-stage="laser_duel"] [data-arena-v9-side="B"]>.arena-chibi-v9[data-arena-v9-pose="fire"]{filter:drop-shadow(0 6px 4px rgba(0,0,0,.4)) drop-shadow(0 0 9px rgba(244,114,182,.45))}
      .arena-race-car{position:absolute!important;z-index:32!important}
      .arena-kart-v9{position:absolute;left:50%;bottom:-3px;display:block!important;visibility:visible!important;opacity:1!important;overflow:hidden;background-repeat:no-repeat;transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.4));z-index:33;animation:arenaKartV9 .44s ease-in-out infinite}
      @keyframes arenaKartV9{0%,100%{transform:translate(-50%,0) rotate(-.35deg)}50%{transform:translate(-50%,-2px) rotate(.35deg)}}
      @media(prefers-reduced-motion:reduce){.arena-chibi-v9,.arena-kart-v9{animation:none!important;transform:translateX(-50%)!important}}
    `;document.head.appendChild(style);
  }
  async function loadAtlas(){
    try{
      const parts=await Promise.all(PARTS.map(async url=>{const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw new Error(`atlas part ${res.status}`);return (await res.text()).trim();}));
      const base64=parts.join('');
      if(base64.length!==75824)throw new Error(`atlas length ${base64.length}`);
      if(!base64.startsWith('UklGR'))throw new Error('atlas header');
      sheetUrl=`data:image/webp;base64,${base64}`;
      await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.naturalWidth===SHEET_W&&im.naturalHeight===SHEET_H?resolve():reject(new Error(`atlas size ${im.naturalWidth}x${im.naturalHeight}`));im.onerror=()=>reject(new Error('atlas decode'));im.src=sheetUrl;});
      ready=true;
      window.GAME_ARENA_CHIBI_V9=Object.freeze({version:VERSION,sourceId:SOURCE_ID,frames:FRAMES,sourceCrops:SOURCE_CROPS,forcePose,refresh:schedule});
      document.documentElement.dataset.arenaChibi='v9-source-sheet';
      schedule();if(!raf)raf=requestAnimationFrame(animate);
      window.dispatchEvent(new CustomEvent('madrasah:game-arena-chibi-ready',{detail:{version:VERSION,source:SOURCE_ID}}));
    }catch(error){console.error('Game Arena V9 character sheet gagal dimuat.',error);document.documentElement.dataset.arenaChibi='v9-error';}
  }
  function start(){injectStyles();loadAtlas();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',schedule,{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();