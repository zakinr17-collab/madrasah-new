(function () {
  const BACKGROUNDS = Object.freeze({
    tug_war: '/assets/game-arena-v5/backgrounds/tug-war.webp',
    base_battle: '/assets/game-arena-v5/backgrounds/base-battle.webp',
    battle_royale: '/assets/game-arena-v5/backgrounds/battle-royale.webp',
    quiz_race: '/assets/game-arena-v5/backgrounds/quiz-race.webp',
    laser_duel: '/assets/game-arena-v5/backgrounds/laser-duel.webp'
  });

  const POSITIONS = Object.freeze({
    tug_war: 'center 42%',
    base_battle: 'center 45%',
    battle_royale: 'center center',
    quiz_race: 'center 52%',
    laser_duel: 'center center'
  });

  let scheduled = false;

  function modeOf(stage) {
    return String(stage?.getAttribute('data-arena-stage') || '');
  }

  function effectMarkup(mode) {
    if (mode === 'tug_war') {
      return '<i class="arena-bg-v5-sun"></i><i class="arena-bg-v5-dust dust-left"></i><i class="arena-bg-v5-dust dust-right"></i><i class="arena-bg-v5-tension"></i>';
    }
    if (mode === 'base_battle') {
      return '<i class="arena-bg-v5-baseglow base-blue"></i><i class="arena-bg-v5-baseglow base-red"></i><i class="arena-bg-v5-projectile shot-blue"></i><i class="arena-bg-v5-projectile shot-red"></i><i class="arena-bg-v5-impact"></i>';
    }
    if (mode === 'battle_royale') {
      return '<i class="arena-bg-v5-zone zone-a"></i><i class="arena-bg-v5-zone zone-b"></i><i class="arena-bg-v5-mist mist-a"></i><i class="arena-bg-v5-mist mist-b"></i><i class="arena-bg-v5-loot"></i>';
    }
    if (mode === 'quiz_race') {
      return '<i class="arena-bg-v5-speed speed-a"></i><i class="arena-bg-v5-speed speed-b"></i><i class="arena-bg-v5-speed speed-c"></i><i class="arena-bg-v5-smoke smoke-a"></i><i class="arena-bg-v5-smoke smoke-b"></i><b class="arena-bg-v5-confetti"></b>';
    }
    if (mode === 'laser_duel') {
      return '<i class="arena-bg-v5-neon neon-blue"></i><i class="arena-bg-v5-neon neon-red"></i><i class="arena-bg-v5-energy"></i><i class="arena-bg-v5-spark spark-a"></i><i class="arena-bg-v5-spark spark-b"></i><i class="arena-bg-v5-spark spark-c"></i>';
    }
    return '';
  }

  function ensureAmbient(stage, mode) {
    let ambient = stage.querySelector(':scope > .arena-bg-v5-ambient');
    if (!ambient) {
      ambient = document.createElement('div');
      ambient.className = 'arena-bg-v5-ambient';
      ambient.setAttribute('aria-hidden', 'true');
      stage.prepend(ambient);
    }
    if (ambient.dataset.mode !== mode) {
      ambient.dataset.mode = mode;
      ambient.innerHTML = effectMarkup(mode);
    }
  }

  function decorate(stage) {
    const mode = modeOf(stage);
    const image = BACKGROUNDS[mode];
    if (!image) return;

    stage.classList.add('arena-bg-v5-stage');
    stage.dataset.arenaBackgroundV5 = mode;
    stage.style.setProperty('background-image', `url("${image}")`, 'important');
    stage.style.setProperty('background-size', 'cover', 'important');
    stage.style.setProperty('background-position', POSITIONS[mode] || 'center center', 'important');
    stage.style.setProperty('background-repeat', 'no-repeat', 'important');

    const legacy = stage.querySelector(':scope > .arena-scene-bg');
    if (legacy) {
      legacy.style.setProperty('opacity', '0', 'important');
      legacy.setAttribute('aria-hidden', 'true');
    }

    ensureAmbient(stage, mode);
  }

  function applyAll() {
    scheduled = false;
    document.querySelectorAll('[data-arena-stage]').forEach(decorate);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyAll);
  }

  function injectStyles() {
    if (document.getElementById('arena-generated-backgrounds-v5-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-generated-backgrounds-v5-styles';
    style.textContent = `
      .arena-bg-v5-stage{position:relative!important;background-color:#07162d!important;isolation:isolate}
      .arena-bg-v5-stage>.arena-scene-bg{opacity:0!important}
      .arena-bg-v5-ambient{position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none!important;border-radius:inherit}
      .arena-bg-v5-ambient::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,12,30,.04) 0%,transparent 45%,rgba(2,10,25,.16) 100%);pointer-events:none}

      [data-arena-background-v5="tug_war"] .arena-bg-v5-sun{position:absolute;left:4%;top:7%;width:34%;height:32%;background:radial-gradient(circle at 20% 20%,rgba(255,250,205,.36),rgba(255,232,139,.08) 44%,transparent 70%);filter:blur(5px);animation:arenaV5Sun 4.4s ease-in-out infinite}
      .arena-bg-v5-dust{position:absolute;bottom:24%;width:22%;height:10%;border-radius:50%;background:radial-gradient(ellipse,rgba(238,198,135,.64),rgba(205,151,91,.20) 52%,transparent 72%);filter:blur(5px);opacity:.72;animation:arenaV5Dust 1.25s ease-out infinite}
      .arena-bg-v5-dust.dust-left{left:17%}.arena-bg-v5-dust.dust-right{right:17%;animation-delay:.42s}
      .arena-bg-v5-tension{position:absolute;left:49.6%;top:45%;bottom:16%;width:4px;background:linear-gradient(180deg,transparent,#fff6bf 34%,#fff 58%,transparent);filter:drop-shadow(0 0 7px #fde68a);opacity:.52;animation:arenaV5Tension .72s ease-in-out infinite}

      .arena-bg-v5-baseglow{position:absolute;top:27%;width:29%;height:48%;border-radius:50%;filter:blur(18px);opacity:.22;animation:arenaV5Glow 2.1s ease-in-out infinite}
      .arena-bg-v5-baseglow.base-blue{left:-4%;background:radial-gradient(circle,#60a5fa,transparent 67%)}
      .arena-bg-v5-baseglow.base-red{right:-4%;background:radial-gradient(circle,#fb7185,transparent 67%);animation-delay:.55s}
      .arena-bg-v5-projectile{position:absolute;top:54%;height:5px;width:18%;border-radius:999px;filter:drop-shadow(0 0 7px currentColor);opacity:.82;animation:arenaV5Shot 1.25s ease-in-out infinite}
      .arena-bg-v5-projectile.shot-blue{left:26%;background:linear-gradient(90deg,transparent,#67e8f9,#fff);color:#22d3ee}
      .arena-bg-v5-projectile.shot-red{right:26%;background:linear-gradient(270deg,transparent,#fb7185,#fff);color:#fb7185;animation-delay:.22s}
      .arena-bg-v5-impact{position:absolute;left:50%;top:54%;width:56px;height:56px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff 0 7%,#fde68a 12%,#fb7185 30%,#60a5fa 46%,transparent 70%);filter:drop-shadow(0 0 15px #fff);animation:arenaV5Impact .7s ease-in-out infinite}

      .arena-bg-v5-zone{position:absolute;left:50%;top:51%;border-radius:50%;border:2px solid rgba(103,232,249,.7);transform:translate(-50%,-50%);box-shadow:0 0 16px rgba(34,211,238,.36),inset 0 0 18px rgba(34,211,238,.14);animation:arenaV5Zone 2.4s ease-out infinite}
      .arena-bg-v5-zone.zone-a{width:33%;aspect-ratio:1}.arena-bg-v5-zone.zone-b{width:42%;aspect-ratio:1;animation-delay:1.15s;opacity:.52}
      .arena-bg-v5-mist{position:absolute;bottom:4%;width:46%;height:16%;background:radial-gradient(ellipse,rgba(219,244,255,.34),transparent 70%);filter:blur(8px);animation:arenaV5Mist 5s ease-in-out infinite}.arena-bg-v5-mist.mist-a{left:-6%}.arena-bg-v5-mist.mist-b{right:-6%;animation-delay:1.8s}
      .arena-bg-v5-loot{position:absolute;left:50%;top:49%;width:40px;height:40px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff8b0 0 8%,#facc15 22%,rgba(250,204,21,.18) 58%,transparent 72%);animation:arenaV5Loot 1.15s ease-in-out infinite}

      .arena-bg-v5-speed{position:absolute;left:-28%;width:38%;height:3px;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.92),transparent);filter:drop-shadow(0 0 4px #fff);animation:arenaV5Speed 1.1s linear infinite}
      .arena-bg-v5-speed.speed-a{top:47%}.arena-bg-v5-speed.speed-b{top:60%;animation-delay:.25s}.arena-bg-v5-speed.speed-c{top:73%;animation-delay:.52s}
      .arena-bg-v5-smoke{position:absolute;bottom:17%;width:18%;height:8%;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.46),rgba(220,230,241,.16) 54%,transparent 72%);filter:blur(5px);animation:arenaV5Smoke 1.5s ease-out infinite}.arena-bg-v5-smoke.smoke-a{left:12%}.arena-bg-v5-smoke.smoke-b{left:32%;animation-delay:.65s}
      .arena-bg-v5-confetti{position:absolute;left:15%;right:15%;top:11%;height:20%;opacity:.5;background-image:radial-gradient(circle,#facc15 0 2px,transparent 3px),radial-gradient(circle,#22c55e 0 2px,transparent 3px),radial-gradient(circle,#38bdf8 0 2px,transparent 3px),radial-gradient(circle,#f472b6 0 2px,transparent 3px);background-size:54px 58px,67px 61px,73px 69px,81px 74px;background-position:5px 4px,18px 30px,41px 11px,12px 44px;animation:arenaV5Confetti 3.2s linear infinite}

      .arena-bg-v5-neon{position:absolute;top:14%;bottom:12%;width:38%;filter:blur(18px);opacity:.18;animation:arenaV5Glow 2s ease-in-out infinite}.arena-bg-v5-neon.neon-blue{left:-8%;background:radial-gradient(circle,#38bdf8,transparent 68%)}.arena-bg-v5-neon.neon-red{right:-8%;background:radial-gradient(circle,#f472b6,transparent 68%);animation-delay:.6s}
      .arena-bg-v5-energy{position:absolute;left:50%;top:55%;width:72px;height:72px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff 0 5%,#bae6fd 9%,#d8b4fe 20%,rgba(34,211,238,.4) 38%,transparent 68%);filter:drop-shadow(0 0 22px #67e8f9);animation:arenaV5Energy .72s ease-in-out infinite}
      .arena-bg-v5-spark{position:absolute;left:50%;top:55%;width:5px;height:28px;border-radius:99px;background:#fff;box-shadow:0 0 9px #67e8f9;transform-origin:50% 0;animation:arenaV5Spark .95s ease-out infinite}.arena-bg-v5-spark.spark-a{transform:rotate(42deg);animation-delay:.1s}.arena-bg-v5-spark.spark-b{transform:rotate(132deg);animation-delay:.35s}.arena-bg-v5-spark.spark-c{transform:rotate(255deg);animation-delay:.6s}

      @keyframes arenaV5Sun{0%,100%{opacity:.36;transform:scale(1)}50%{opacity:.58;transform:scale(1.08)}}
      @keyframes arenaV5Dust{0%{opacity:0;transform:translateY(9px) scale(.55)}35%{opacity:.72}100%{opacity:0;transform:translateY(-10px) scale(1.18)}}
      @keyframes arenaV5Tension{0%,100%{opacity:.28;transform:scaleY(.88)}50%{opacity:.76;transform:scaleY(1.07)}}
      @keyframes arenaV5Glow{0%,100%{opacity:.14;transform:scale(.94)}50%{opacity:.31;transform:scale(1.06)}}
      @keyframes arenaV5Shot{0%{opacity:0;transform:scaleX(.15)}35%{opacity:.95}100%{opacity:0;transform:scaleX(1.05)}}
      @keyframes arenaV5Impact{0%,100%{opacity:.42;scale:.72}50%{opacity:1;scale:1.12}}
      @keyframes arenaV5Zone{0%{opacity:.78;scale:.72}100%{opacity:0;scale:1.13}}
      @keyframes arenaV5Mist{0%,100%{opacity:.18;transform:translateX(-3%) scale(1)}50%{opacity:.42;transform:translateX(5%) scale(1.08)}}
      @keyframes arenaV5Loot{0%,100%{opacity:.55;scale:.72}50%{opacity:1;scale:1.22}}
      @keyframes arenaV5Speed{0%{transform:translateX(0);opacity:0}16%{opacity:.8}100%{transform:translateX(360%);opacity:0}}
      @keyframes arenaV5Smoke{0%{opacity:.05;transform:translateX(0) scale(.55)}40%{opacity:.46}100%{opacity:0;transform:translateX(-22px) scale(1.25)}}
      @keyframes arenaV5Confetti{0%{transform:translateY(-8px)}100%{transform:translateY(32px)}}
      @keyframes arenaV5Energy{0%,100%{opacity:.62;scale:.78}50%{opacity:1;scale:1.16}}
      @keyframes arenaV5Spark{0%{opacity:0;scale:.3}35%{opacity:1}100%{opacity:0;translate:0 -42px;scale:1.1}}

      @media(max-width:720px){
        [data-arena-background-v5="tug_war"],[data-arena-background-v5="base_battle"],[data-arena-background-v5="quiz_race"]{background-position:center top!important}
        .arena-bg-v5-projectile{width:20%}.arena-bg-v5-projectile.shot-blue{left:24%}.arena-bg-v5-projectile.shot-red{right:24%}
        .arena-bg-v5-zone.zone-a{width:45%}.arena-bg-v5-zone.zone-b{width:58%}
        .arena-bg-v5-energy{width:52px;height:52px}
      }
      @media(prefers-reduced-motion:reduce){
        .arena-bg-v5-ambient *{animation:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    applyAll();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
