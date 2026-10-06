(function () {
  function start() {
    const api = window.GAME_ARENA_APPROVED_CHARACTERS_V10;
    if (!api?.enabled) {
      document.documentElement.dataset.arenaCharacterSheet = 'core-sheet';
      return;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
