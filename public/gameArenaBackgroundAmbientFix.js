(function () {
  if (document.getElementById('arena-bg-v5-ambient-fix')) return;
  const style = document.createElement('style');
  style.id = 'arena-bg-v5-ambient-fix';
  style.textContent = `
    .arena-bg-v5-stage > .arena-bg-v5-ambient {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 3 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
})();
