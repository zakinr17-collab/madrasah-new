(function () {
  let scheduled = false;

  function cleanupLegacyArenaArt(root = document) {
    root.querySelectorAll?.(
      '.arena-chibi-v9,.arena-v3-character,.arena-generated-chibi,.arena-sheet-sprite,.arena-character-core,.arena-approved-chibi-v10,.arena-kart-v9,.arena-master-character'
    ).forEach(el => el.remove());

    root.querySelectorAll?.('.arena-character-wrap').forEach(wrap => {
      if (wrap.classList.contains('arena-hd-character') || wrap.classList.contains('arena-hd-kart')) return;
      wrap.classList.remove('arena-chibi-v9-ready', 'arena-approved-v10-ready');
      wrap.removeAttribute('data-arena-v10-side');
      wrap.style.removeProperty('width');
      wrap.style.removeProperty('height');
    });
  }

  function repairAll() {
    scheduled = false;
    document.documentElement.dataset.arenaCharacters = 'hd-vector';
    document.documentElement.style.removeProperty('--arena-master-sheet-image');
    cleanupLegacyArenaArt(document);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(repairAll);
  }

  function injectStyles() {
    if (document.getElementById('arena-publish-guard-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-publish-guard-styles';
    style.textContent = `
      .arena-chibi-v9,
      .arena-v3-character,
      .arena-generated-chibi,
      .arena-sheet-sprite,
      .arena-character-core,
      .arena-approved-chibi-v10,
      .arena-kart-v9,
      .arena-master-character {
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
      .arena-hd-character,
      .arena-hd-kart {
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
      }
      [data-arena-stage="base_battle"] .arena-castle-img {
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    schedule();
    window.addEventListener('resize', schedule, { passive: true });
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
