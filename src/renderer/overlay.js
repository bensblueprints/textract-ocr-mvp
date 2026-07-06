'use strict';
(() => {
  const rectEl = document.getElementById('rect');
  const dimsEl = document.getElementById('dims');
  let startX = 0;
  let startY = 0;
  let dragging = false;

  function setRect(x, y, w, h) {
    rectEl.style.left = `${x}px`;
    rectEl.style.top = `${y}px`;
    rectEl.style.width = `${w}px`;
    rectEl.style.height = `${h}px`;
    rectEl.style.display = 'block';
    dimsEl.textContent = `${Math.round(w)} x ${Math.round(h)}`;
  }

  window.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    setRect(startX, startY, 0, 0);
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    setRect(x, y, w, h);
  });

  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    if (width < 4 || height < 4) {
      window.textractOverlay.cancel();
      return;
    }
    window.textractOverlay.submitRegion({ x, y, width, height });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.textractOverlay.cancel();
    }
  });
})();
