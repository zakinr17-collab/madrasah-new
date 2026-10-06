(function () {
  const SHEET_URL = '/assets/game-arena-v6/chibi-models-v6.webp?v=8';
  // Atlas V6 asli adalah 1536x1120: 8 kolom x 5 baris.
  // Nilai lama 960x700 membuat background-position salah, sehingga frame terlihat
  // seperti kotak yang bergetar atau jatuh ke area transparan.
  const SHEET_W = 1536;
  const SHEET_H = 1120;
  const CELL_W = 192;
  const CELL_H = 224;

  const FRAMES = Object.freeze({
    tug_war: {
      A: { idle: [0, 0], pull: [1, 0], strain: [2, 0], victory: [3, 0] },
      B: { idle: [4, 0], pull: [5, 0], strain: [6, 0], victory: [7, 0] }
    },
    base_battle: {
      A: { defend: [0, 1], attack: [1, 1], hit: [2, 1], victory: [3, 1] },
      B: { defend: [4, 1], attack: [5, 1], hit: [6, 1], victory: [7, 1] }
    },
    battle_royale: {
      A: { scout: [0, 2], attack: [1, 2], hit: [2, 2], victory: [3, 2] },
      B: { scout: [4, 2], attack: [5, 2], hit: [6, 2], victory: [7, 2] }
    },
    laser_duel: {
      A: { aim: [0, 3], fire: [1, 3], hit: [2, 3], victory: [3, 3] },
      B: { aim: [4, 3], fire: [5, 3], hit: [6, 3], victory: [7, 3] }
    },
    quiz_race: {
      blue: [0, 4], red: [1, 4], green: [2, 4], yellow: [3, 4]
    }
  });

  const ANIMATIONS = Object.freeze({
    tug_war: { poses: ['idle', 'pull', 'strain', 'pull'], duration: 230 },
    base_battle: { poses: ['defend', 'attack', 'attack', 'defend'], duration: 460 },
    battle_royale: { poses: ['scout', 'attack', 'scout', 'attack'], duration: 620 },
    // Laser dibuat lebih tenang: fire hanya sesekali, tanpa scale-shake antar-frame.
    laser_duel: { poses: ['aim', 'aim', 'fire', 'aim'], duration: 390 }
  });

  let sheetReady = true;
  let scheduled = false;
  let animationFrame = 0;
  let lastAnimationTick = 0;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function modeOf(node) {
    return String(node?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage') || '');
  }

  function hash(value) {
    const text = String(value || '');
    let out = 0;
    for (let i = 0; i < text.length; i++) out = ((out << 5) - out + text.charCodeAt(i)) | 0;
    return Math.abs(out);
  }

  function sideOf(wrap) {
    const current = String(wrap?.dataset?.arenaV3Side || wrap?.dataset?.arenaGeneratedSide || '');
    if (current === 'A' || current === 'B') return current;
    if (wrap.closest('.arena-team-a,[data-arena-base-side="A"]')) return 'A';
    if (wrap.closest('.arena-team-b,[data-arena-base-side="B"]')) return 'B';
    const stage = wrap.closest('[data-arena-stage]');
    if (!stage) return 'A';
    const mode = modeOf(wrap);
    const wraps = Array.from(stage.querySelectorAll('.arena-character-wrap'));
    if (mode === 'laser_duel') return wraps.indexOf(wrap) <= 0 ? 'A' : 'B';
    const player = wrap.closest('[data-arena-player-id]');
    const seed = player?.getAttribute('data-arena-player-id') || wraps.indexOf(wrap);
    return hash(seed) % 2 ? 'B' : 'A';
  }

  function targetWidth(stage, mode) {
    const width = Math.max(280, stage?.getBoundingClientRect?.().width || 0);
    const compact = width <= 430;
    const mobile = width <= 720;
    if (mode === 'tug_war') return compact ? 46 : mobile ? 54 : 64;
    if (mode === 'base_battle') return compact ? 40 : mobile ? 46 : 54;
    if (mode === 'battle_royale') return compact ? 41 : mobile ? 48 : 56;
    if (mode === 'laser_duel') return compact ? 60 : mobile ? 68 : 78;
    return compact ? 44 : mobile ? 50 : 58;
  }

  function applyFrame(el, frame, width) {
    if (!sheetReady || !frame) return;
    const scale = width / CELL_W;
    const [col, row] = frame;
    el.style.width = `${Math.round(CELL_W * scale)}px`;
    el.style.height = `${Math.round(CELL_H * scale)}px`;
    el.style.backgroundImage = `url("${SHEET_URL}")`;
    el.style.backgroundSize = `${Math.round(SHEET_W * scale)}px ${Math.round(SHEET_H * scale)}px`;
    el.style.backgroundPosition = `${Math.round(-col * CELL_W * scale)}px ${Math.round(-row * CELL_H * scale)}px`;
  }

  function frameFor(mode, side, pose) {
    const modeFrames = FRAMES[mode];
    if (!modeFrames || mode === 'quiz_race') return null;
    const sideFrames = modeFrames[side] || modeFrames.A;
    return sideFrames?.[pose] || sideFrames?.[Object.keys(sideFrames)[0]] || null;
  }

  function defaultPose(mode) {
    if (mode === 'tug_war') return 'pull';
    if (mode === 'base_battle') return 'attack';
    if (mode === 'battle_royale') return 'scout';
    if (mode === 'laser_duel') return 'aim';
    return '';
  }

  function setSpritePose(sprite, pose) {
    if (!sprite) return;
    const wrap = sprite.closest('.arena-character-wrap');
    const stage = sprite.closest('[data-arena-stage]');
    if (!wrap || !stage) return;
    const mode = modeOf(sprite);
    const side = sideOf(wrap);
    const width = targetWidth(stage, mode);
    const frame = frameFor(mode, side, pose);
    if (!frame) return;
    if (sprite.dataset.arenaPose !== pose || sprite.dataset.arenaWidth !== String(width)) {
      applyFrame(sprite, frame, width);
      sprite.dataset.arenaPose = pose;
      sprite.dataset.arenaWidth = String(width);
    }
  }

  function enhanceCharacter(wrap) {
    if (!sheetReady || !wrap) return;
    const stage = wrap.closest('[data-arena-stage]');
    if (!stage) return;
    const mode = modeOf(wrap);
    if (!FRAMES[mode] || mode === 'quiz_race') return;
    const side = sideOf(wrap);
    let sprite = wrap.querySelector(':scope > .arena-generated-chibi');
    if (!sprite) {
      sprite = document.createElement('span');
      sprite.className = 'arena-generated-chibi';
      sprite.setAttribute('aria-hidden', 'true');
      wrap.appendChild(sprite);
    }
    const width = targetWidth(stage, mode);
    wrap.style.width = `${width}px`;
    wrap.style.height = `${Math.round(width * CELL_H / CELL_W)}px`;
    wrap.dataset.arenaGeneratedSide = side;
    wrap.classList.add('arena-generated-chibi-ready');
    sprite.dataset.arenaMode = mode;
    sprite.dataset.arenaSide = side;
    const identity = wrap.closest('[data-arena-player-id]')?.getAttribute('data-arena-player-id') ||
      Array.from(stage.querySelectorAll('.arena-character-wrap')).indexOf(wrap);
    sprite.dataset.arenaPhase = mode === 'tug_war' ? '0' : String(hash(identity) % 220);
    setSpritePose(sprite, defaultPose(mode));
  }

  function enhanceRace(stage) {
    if (!sheetReady || !stage) return;
    const colors = ['blue', 'red', 'green', 'yellow'];
    const mobile = Math.max(280, stage.getBoundingClientRect().width || 0) <= 720;
    Array.from(stage.querySelectorAll('.arena-race-car')).forEach((car, index) => {
      const color = colors[index % colors.length];
      let sprite = car.querySelector(':scope > .arena-generated-kart');
      if (!sprite) {
        sprite = document.createElement('span');
        sprite.className = 'arena-generated-kart';
        sprite.setAttribute('aria-hidden', 'true');
        car.appendChild(sprite);
      }
      applyFrame(sprite, FRAMES.quiz_race[color], mobile ? 82 : 102);
      car.dataset.arenaGeneratedKart = color;
    });
  }

  function enhanceAll() {
    scheduled = false;
    if (!sheetReady) return;
    document.querySelectorAll('.arena-character-wrap').forEach(enhanceCharacter);
    document.querySelectorAll('[data-arena-stage="quiz_race"]').forEach(enhanceRace);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhanceAll);
  }

  function animateSprites(timestamp) {
    animationFrame = requestAnimationFrame(animateSprites);
    if (!sheetReady || document.hidden || reduceMotion?.matches) return;
    if (timestamp - lastAnimationTick < 105) return;
    lastAnimationTick = timestamp;
    document.querySelectorAll('.arena-generated-chibi-ready > .arena-generated-chibi').forEach(sprite => {
      const mode = String(sprite.dataset.arenaMode || modeOf(sprite));
      const animation = ANIMATIONS[mode];
      if (!animation) return;
      const manualUntil = Number(sprite.dataset.arenaManualUntil || 0);
      if (manualUntil > timestamp) return;
      const phase = Number(sprite.dataset.arenaPhase || 0);
      const index = Math.floor((timestamp + phase) / animation.duration) % animation.poses.length;
      setSpritePose(sprite, animation.poses[index]);
    });
  }

  function forcePose(target, pose, duration = 720) {
    const wrap = target?.closest?.('.arena-character-wrap') || target;
    const sprite = wrap?.querySelector?.(':scope > .arena-generated-chibi');
    if (!sprite) return false;
    setSpritePose(sprite, pose);
    sprite.dataset.arenaManualUntil = String(performance.now() + Math.max(0, Number(duration) || 0));
    return true;
  }

  function injectStyles() {
    if (document.getElementById('arena-generated-chibi-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-generated-chibi-styles';
    style.textContent = `
      /* Sheet-only mode: legacy hero SVG/V3/LaserV4 must never render inside live mini games. */
      [data-arena-stage] .arena-character-wrap>.arena-character-core,
      [data-arena-stage] .arena-character-wrap>.arena-sheet-sprite,
      [data-arena-stage] .arena-character-wrap>.arena-v3-character{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important
      }
      [data-arena-stage="quiz_race"] .arena-race-car>img{
        visibility:hidden!important
      }
      .arena-character-wrap.arena-generated-chibi-ready{
        position:relative!important;
        overflow:visible!important;
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        z-index:12!important
      }
      .arena-generated-chibi{
        position:absolute;
        left:50%;
        bottom:0;
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        overflow:hidden;
        background-color:transparent;
        background-repeat:no-repeat;
        background-origin:border-box;
        background-clip:border-box;
        transform:translateX(-50%);
        transform-origin:50% 100%;
        pointer-events:none;
        user-select:none;
        filter:drop-shadow(0 6px 4px rgba(0,0,0,.36));
        z-index:13;
        will-change:transform
      }
      [data-arena-stage="tug_war"] [data-arena-generated-side="A"]>.arena-generated-chibi[data-arena-pose="idle"]{transform:translateX(-50%) rotate(-1deg)}
      [data-arena-stage="tug_war"] [data-arena-generated-side="A"]>.arena-generated-chibi[data-arena-pose="pull"]{transform:translateX(calc(-50% - 2px)) rotate(-3deg)}
      [data-arena-stage="tug_war"] [data-arena-generated-side="A"]>.arena-generated-chibi[data-arena-pose="strain"]{transform:translateX(calc(-50% - 5px)) rotate(-6deg) scale(.99)}
      [data-arena-stage="tug_war"] [data-arena-generated-side="B"]>.arena-generated-chibi[data-arena-pose="idle"]{transform:translateX(-50%) rotate(1deg)}
      [data-arena-stage="tug_war"] [data-arena-generated-side="B"]>.arena-generated-chibi[data-arena-pose="pull"]{transform:translateX(calc(-50% + 2px)) rotate(3deg)}
      [data-arena-stage="tug_war"] [data-arena-generated-side="B"]>.arena-generated-chibi[data-arena-pose="strain"]{transform:translateX(calc(-50% + 5px)) rotate(6deg) scale(.99)}
      [data-arena-stage="tug_war"] .arena-generated-chibi[data-arena-pose="victory"],
      [data-arena-stage="base_battle"] .arena-generated-chibi[data-arena-pose="victory"],
      [data-arena-stage="battle_royale"] .arena-generated-chibi[data-arena-pose="victory"],
      [data-arena-stage="laser_duel"] .arena-generated-chibi[data-arena-pose="victory"]{transform:translate(-50%,-5px) scale(1.03)}
      [data-arena-stage="base_battle"] .arena-generated-chibi[data-arena-pose="attack"],
      [data-arena-stage="battle_royale"] .arena-generated-chibi[data-arena-pose="attack"]{transform:translate(-50%,-2px) scale(1.01)}
      [data-arena-stage="laser_duel"] .arena-generated-chibi{transform:translateX(-50%)!important}
      [data-arena-stage="laser_duel"] .arena-generated-chibi[data-arena-pose="fire"]{transform:translateX(-50%)!important;filter:drop-shadow(0 6px 4px rgba(0,0,0,.4)) drop-shadow(0 0 9px rgba(96,165,250,.45))}
      [data-arena-stage="laser_duel"] [data-arena-generated-side="B"]>.arena-generated-chibi[data-arena-pose="fire"]{filter:drop-shadow(0 6px 4px rgba(0,0,0,.4)) drop-shadow(0 0 9px rgba(248,113,113,.45))}
      [data-arena-stage="quiz_race"] .arena-race-car>.arena-v3-kart,
      [data-arena-stage="quiz_race"] .arena-race-car>img[src*="/vehicles/"]{display:none!important;visibility:hidden!important}
      .arena-race-car{position:absolute!important;z-index:12!important}
      .arena-generated-kart{position:absolute;left:50%;bottom:-3px;display:block!important;visibility:visible!important;opacity:1!important;overflow:hidden;background-repeat:no-repeat;transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.4));z-index:13;animation:arenaGeneratedKartV6 .42s ease-in-out infinite;will-change:transform}
      @keyframes arenaGeneratedKartV6{0%,100%{transform:translate(-50%,0) rotate(-.4deg)}50%{transform:translate(-50%,-2px) rotate(.4deg)}}
      @media(prefers-reduced-motion:reduce){.arena-generated-chibi,.arena-generated-kart{animation:none!important;transform:translateX(-50%)!important}}
    `;
    document.head.appendChild(style);
  }

  async function verifySheet() {
    try {
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          if (image.naturalWidth !== SHEET_W || image.naturalHeight !== SHEET_H) {
            reject(new Error(`unexpected chibi atlas size ${image.naturalWidth}x${image.naturalHeight}; expected ${SHEET_W}x${SHEET_H}`));
            return;
          }
          resolve();
        };
        image.onerror = () => reject(new Error('invalid generated chibi V6 sheet'));
        image.src = SHEET_URL;
      });
      window.dispatchEvent(new CustomEvent('madrasah:game-arena-chibi-ready', { detail: { version: 8, verified: true } }));
    } catch (error) {
      console.error('Game Arena character sheet gagal diverifikasi.', error);
      document.documentElement.dataset.arenaGeneratedChibi = 'v8-error';
    }
  }

  function start() {
    // Render langsung dari atlas sheet. Jangan tunggu preload supaya legacy asset
    // tidak sempat mengambil alih karakter pada render pertama.
    sheetReady = true;
    window.GAME_ARENA_GENERATED_CHIBI_SHEET = SHEET_URL;
    window.GAME_ARENA_GENERATED_CHIBI_FRAMES = FRAMES;
    window.GAME_ARENA_CHIBI_V8 = Object.freeze({ frames: FRAMES, forcePose, refresh: schedule });
    document.documentElement.dataset.arenaGeneratedChibi = 'v8-sheet-only';
    injectStyles();
    schedule();
    if (!animationFrame) animationFrame = requestAnimationFrame(animateSprites);
    verifySheet();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
