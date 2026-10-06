(function () {
  let scheduled = false;

  function cleanupStaleV10() {
    scheduled = false;
    document.querySelectorAll('[data-arena-stage] .arena-character-wrap').forEach(wrap => {
      wrap.classList.remove('arena-approved-v10-ready');
      wrap.removeAttribute('data-arena-v10-side');
      wrap.querySelectorAll(':scope > .arena-approved-chibi-v10').forEach(el => el.remove());
      wrap.style.removeProperty('width');
      wrap.style.removeProperty('height');
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(cleanupStaleV10);
  }

  function start() {
    document.documentElement.dataset.arenaCharacterSheet = 'core-sheet';
    window.GAME_ARENA_APPROVED_CHARACTERS_V10 = Object.freeze({
      version: 10,
      enabled: false,
      source: 'core-character-sheet',
      refresh: schedule
    });
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
