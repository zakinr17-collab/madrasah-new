(function () {
  const VERSION = 1;
  const PARTS = [0, 1, 2].map(i => `/assets/game-arena-master/part${i}.txt?v=${VERSION}`);
  const EXPECTED_BASE64_LENGTH = 130388;
  const SHEET_W = 384;
  const SHEET_H = 472;
  const COLS = 8;
  const ROWS = 9;

  async function loadMasterSheet() {
    try {
      const chunks = await Promise.all(PARTS.map(async (url) => {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`master part ${response.status}`);
        return (await response.text()).trim();
      }));

      const base64 = chunks.join('');
      if (base64.length !== EXPECTED_BASE64_LENGTH) {
        throw new Error(`master length ${base64.length}`);
      }
      if (!base64.startsWith('UklGR')) throw new Error('master header');

      const sheetUrl = `data:image/webp;base64,${base64}`;
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth === SHEET_W && image.naturalHeight === SHEET_H
          ? resolve()
          : reject(new Error(`master size ${image.naturalWidth}x${image.naturalHeight}`));
        image.onerror = () => reject(new Error('master decode'));
        image.src = sheetUrl;
      });

      document.documentElement.style.setProperty('--arena-master-sheet-image', `url("${sheetUrl}")`);
      document.documentElement.dataset.arenaCharacters = 'master-sheet';
      window.GAME_ARENA_MASTER_CHARACTERS = Object.freeze({
        version: VERSION,
        source: 'user-master-sheet-2026-09-25',
        width: SHEET_W,
        height: SHEET_H,
        cols: COLS,
        rows: ROWS,
        ready: true
      });

      window.dispatchEvent(new CustomEvent('madrasah:game-arena-master-ready', {
        detail: { version: VERSION, source: 'user-master-sheet-2026-09-25' }
      }));
    } catch (error) {
      document.documentElement.style.removeProperty('--arena-master-sheet-image');
      document.documentElement.dataset.arenaCharacters = 'master-error';
      console.error('Game Arena master character sheet gagal dimuat.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMasterSheet, { once: true });
  } else {
    loadMasterSheet();
  }
})();