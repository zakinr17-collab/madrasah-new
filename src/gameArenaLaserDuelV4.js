(function () {
  const svgData = svg => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  const LASER_BG = svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
    <defs>
      <radialGradient id="wall" cx="50%" cy="34%" r="72%"><stop stop-color="#172f68"/><stop offset=".52" stop-color="#081b42"/><stop offset="1" stop-color="#030817"/></radialGradient>
      <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#102b59"/><stop offset="1" stop-color="#050d22"/></linearGradient>
      <linearGradient id="blueGlow"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
      <linearGradient id="pinkGlow"><stop stop-color="#f0abfc"/><stop offset="1" stop-color="#db2777"/></linearGradient>
      <filter id="cyan"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="pink"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow"><feDropShadow dy="9" stdDeviation="7" flood-opacity=".42"/></filter>
    </defs>
    <rect width="1200" height="700" fill="url(#wall)"/>
    <path d="M0 0h300l118 112v210L300 418H0Z" fill="#071832" stroke="#13366f" stroke-width="14"/>
    <path d="M1200 0H900L782 112v210l118 96h300Z" fill="#071832" stroke="#3c1765" stroke-width="14"/>
    <path d="M0 86h214l105 94v106L214 374H0" fill="none" stroke="#22d3ee" stroke-width="8" opacity=".88" filter="url(#cyan)"/>
    <path d="M1200 86H986l-105 94v106l105 88h214" fill="none" stroke="#d946ef" stroke-width="8" opacity=".9" filter="url(#pink)"/>
    <g opacity=".9">
      <rect x="42" y="136" width="17" height="104" rx="8" fill="#38bdf8" filter="url(#cyan)"/><rect x="92" y="105" width="12" height="66" rx="6" fill="#2563eb"/>
      <rect x="1141" y="136" width="17" height="104" rx="8" fill="#f472b6" filter="url(#pink)"/><rect x="1096" y="105" width="12" height="66" rx="6" fill="#a855f7"/>
      <rect x="196" y="244" width="12" height="72" rx="6" fill="#22d3ee"/><rect x="992" y="244" width="12" height="72" rx="6" fill="#e879f9"/>
    </g>
    <g transform="translate(600 198)" filter="url(#shadow)">
      <polygon points="0,-132 112,-68 112,68 0,132 -112,68 -112,-68" fill="#0b1d49" stroke="#6d28d9" stroke-width="15"/>
      <polygon points="0,-96 82,-48 82,48 0,96 -82,48 -82,-48" fill="#132d67" stroke="#22d3ee" stroke-opacity=".72" stroke-width="7"/>
      <polygon points="0,-68 58,-34 58,34 0,68 -58,34 -58,-34" fill="#26185e" stroke="#d946ef" stroke-width="5"/>
      <text x="0" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="900" font-style="italic" fill="#f0abfc" stroke="#7e22ce" stroke-width="2" filter="url(#pink)">VS</text>
    </g>
    <path d="M0 370h1200v330H0Z" fill="url(#floor)"/>
    <path d="M600 374 150 700M600 374 335 700M600 374 500 700M600 374 700 700M600 374 865 700M600 374 1050 700" stroke="#1e4b8a" stroke-width="4" opacity=".7"/>
    <path d="M0 452h1200M0 535h1200M0 625h1200" stroke="#16396f" stroke-width="4" opacity=".6"/>
    <g transform="translate(600 408)" filter="url(#shadow)">
      <ellipse rx="230" ry="88" fill="#0a1c42" stroke="#7c3aed" stroke-width="9"/>
      <ellipse rx="172" ry="59" fill="#102d5b" stroke="#22d3ee" stroke-opacity=".78" stroke-width="5"/>
      <ellipse rx="105" ry="33" fill="#172c55" stroke="#f472b6" stroke-opacity=".7" stroke-width="4"/>
      <path d="M-210 0h420" stroke="#93c5fd" stroke-opacity=".22" stroke-width="3"/>
    </g>
    <g filter="url(#shadow)">
      <g transform="translate(86 354)"><rect width="126" height="116" rx="8" fill="#7b5335" stroke="#c38a56" stroke-width="6"/><path d="M12 12 114 104M114 12 12 104" stroke="#4b3225" stroke-width="8"/><path d="M0 44h126M44 0v116M84 0v116" stroke="#a96f42" stroke-width="4"/></g>
      <g transform="translate(988 354)"><rect width="126" height="116" rx="8" fill="#7b5335" stroke="#c38a56" stroke-width="6"/><path d="M12 12 114 104M114 12 12 104" stroke="#4b3225" stroke-width="8"/><path d="M0 44h126M44 0v116M84 0v116" stroke="#a96f42" stroke-width="4"/></g>
      <g transform="translate(28 500)"><rect width="98" height="70" rx="10" fill="#0b234d" stroke="#2563eb" stroke-width="5"/><rect x="18" y="18" width="22" height="34" rx="4" fill="#22d3ee" opacity=".85"/></g>
      <g transform="translate(1074 500)"><rect width="98" height="70" rx="10" fill="#281546" stroke="#a855f7" stroke-width="5"/><rect x="58" y="18" width="22" height="34" rx="4" fill="#f472b6" opacity=".85"/></g>
    </g>
    <g opacity=".75"><circle cx="312" cy="385" r="7" fill="#22d3ee"/><circle cx="888" cy="385" r="7" fill="#f472b6"/><circle cx="600" cy="408" r="11" fill="#fff"/></g>
  </svg>`);

  function fighter(side) {
    const red = side === 'red';
    const main = red ? '#ef4444' : '#2563eb';
    const dark = red ? '#7f1d1d' : '#143b8f';
    const light = red ? '#fb7185' : '#60a5fa';
    const accent = red ? '#f472b6' : '#22d3ee';
    const mirror = red ? 'translate(176 0) scale(-1 1)' : '';
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 216">
      <defs>
        <linearGradient id="armor" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".48" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
        <filter id="glow"><feDropShadow dy="5" stdDeviation="4" flood-color="${accent}" flood-opacity=".5"/></filter>
      </defs>
      <g transform="${mirror}" filter="url(#glow)">
        <ellipse cx="82" cy="201" rx="49" ry="9" fill="#020617" opacity=".35"/>
        <path d="M67 150 48 190c-5 11 6 18 18 14l24-39 21 39c12 4 24-2 18-14l-17-42Z" fill="${dark}" stroke="#081225" stroke-width="5"/>
        <path d="M52 108c7-24 24-37 46-37 24 0 42 13 50 38l-8 57c-14 12-28 18-44 18-17 0-33-6-48-20Z" fill="url(#armor)" stroke="#081225" stroke-width="5"/>
        <path d="M67 119h57l-8 34H74Z" fill="#dbeafe" opacity=".2"/><path d="M96 105v54" stroke="#fff" stroke-opacity=".5" stroke-width="4"/>
        <ellipse cx="96" cy="67" rx="39" ry="38" fill="#efc09b" stroke="#081225" stroke-width="5"/>
        <path d="M54 66c1-37 18-57 43-57 27 0 45 18 49 53l-15-7v-9H72v10Z" fill="url(#armor)" stroke="#081225" stroke-width="6"/>
        <path d="M66 39c16-17 43-22 64-8" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="5" stroke-linecap="round"/>
        <circle cx="58" cy="68" r="14" fill="${dark}" stroke="${light}" stroke-width="4"/><circle cx="144" cy="68" r="14" fill="${dark}" stroke="${light}" stroke-width="4"/>
        <ellipse cx="84" cy="72" rx="5" ry="6" fill="#111827"/><ellipse cx="109" cy="72" rx="5" ry="6" fill="#111827"/><circle cx="82" cy="70" r="1.7" fill="#fff"/><circle cx="107" cy="70" r="1.7" fill="#fff"/>
        <path d="M88 89c6 5 12 5 18 0" fill="none" stroke="#9f1239" stroke-width="3" stroke-linecap="round"/>
        <path d="M59 117c-20 5-31 17-33 33-1 9 5 14 13 13 9-2 12-11 22-17Z" fill="url(#armor)" stroke="#081225" stroke-width="5"/>
        <path d="M133 116c18-3 31-1 39 5l-3 17-32 2-20-11Z" fill="url(#armor)" stroke="#081225" stroke-width="5"/>
        <path d="M158 116h17l-5 9 6 8-18 1Z" fill="#07152f" stroke="${accent}" stroke-width="3"/>
        <path d="M172 121h18" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="150" cy="127" r="4" fill="#fff"/><circle cx="150" cy="127" r="9" fill="${accent}" opacity=".35"/>
        <path d="M63 169h25M108 169h26" stroke="${light}" stroke-width="5" stroke-linecap="round"/>
      </g>
    </svg>`);
  }

  const BLUE = fighter('blue');
  const RED = fighter('red');
  let scheduled = false;

  function enhance(stage) {
    if (!stage) return;
    stage.classList.add('arena-laser-v4');

    const wraps = Array.from(stage.querySelectorAll('.arena-character-wrap'));
    wraps.forEach((wrap, index) => {
      const side = index === 0 ? 'A' : 'B';
      wrap.dataset.arenaV3Side = side;
      let img = wrap.querySelector(':scope > .arena-v3-character');
      if (!img) {
        img = document.createElement('img');
        img.className = 'arena-v3-character';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        wrap.appendChild(img);
      }
      const src = side === 'B' ? RED : BLUE;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.classList.add('arena-laser-v4-character');
      wrap.querySelectorAll(':scope > .arena-character-core,:scope > .arena-sheet-sprite').forEach(el => { el.style.display='none'; el.setAttribute('aria-hidden','true'); });
    });

    const desktop = Math.max(280, stage.getBoundingClientRect().width || 0) > 720;
    const anchors = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-character-wrap'));
    anchors.forEach((anchor, index) => {
      anchor.style.bottom = desktop ? '34%' : '9%';
      if (index === 0) { anchor.style.left = desktop ? '13.5%' : '7%'; anchor.style.right = ''; }
      else { anchor.style.right = desktop ? '13.5%' : '7%'; anchor.style.left = ''; }
    });
  }

  function enhanceAll() {
    scheduled = false;
    document.querySelectorAll('[data-arena-stage="laser_duel"]').forEach(enhance);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhanceAll);
  }

  function injectStyles() {
    if (document.getElementById('arena-laser-v4-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-laser-v4-styles';
    style.textContent = `
      [data-arena-stage="laser_duel"].arena-laser-v4{background-image:url("${LASER_BG}")!important;background-size:cover!important;background-position:center center!important;background-repeat:no-repeat!important}
      [data-arena-stage="laser_duel"].arena-laser-v4>.arena-scene-bg{opacity:0!important}
      [data-arena-stage="laser_duel"] .arena-character-wrap{width:106px!important;height:126px!important}
      [data-arena-stage="laser_duel"] .arena-v3-character{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center bottom!important;filter:drop-shadow(0 6px 4px rgba(0,0,0,.42)) drop-shadow(0 0 8px rgba(56,189,248,.22))!important}
      [data-arena-stage="laser_duel"] [data-arena-v3-side="B"] .arena-v3-character{filter:drop-shadow(0 6px 4px rgba(0,0,0,.42)) drop-shadow(0 0 8px rgba(244,114,182,.22))!important}
      [data-arena-stage="laser_duel"] .arena-v3-laser{top:56.5%!important;width:27%!important;height:6px!important}
      [data-arena-stage="laser_duel"] .arena-v3-laser.blue{left:23.5%!important;right:auto!important;background:linear-gradient(90deg,#0ea5e9,#dffbff,#fff)!important;color:#22d3ee!important}
      [data-arena-stage="laser_duel"] .arena-v3-laser.red{right:23.5%!important;left:auto!important;background:linear-gradient(270deg,#ef4444,#ffe4ef,#fff)!important;color:#fb7185!important}
      [data-arena-stage="laser_duel"] .arena-v3-clash{left:50%!important;top:56.5%!important;width:58px!important;height:58px!important;background:radial-gradient(circle,#fff 0 10%,#fde68a 11% 19%,#f9a8d4 25%,#22d3ee 42%,transparent 70%)!important;filter:drop-shadow(0 0 12px #fff) drop-shadow(0 0 24px #e879f9)!important}
      [data-arena-stage="laser_duel"] .arena-avatar-tag{transform:translateY(-2px)!important}
      @media(max-width:720px){
        [data-arena-stage="laser_duel"] .arena-character-wrap{width:88px!important;height:104px!important}
        [data-arena-stage="laser_duel"] .arena-v3-laser{top:76%!important;width:27%!important;height:5px!important}
        [data-arena-stage="laser_duel"] .arena-v3-clash{top:76%!important;width:48px!important;height:48px!important}
      }
      @media(max-width:430px){
        [data-arena-stage="laser_duel"] .arena-character-wrap{width:76px!important;height:90px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    schedule();
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',schedule,{passive:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
