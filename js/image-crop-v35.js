/* Inmo Studio PRO v3.5 - marco y foto integrados */
(() => {
  'use strict';

  const bar = document.getElementById('imageModeBar');
  const inspector = document.getElementById('inspector');
  if (!bar || !inspector || typeof canvas === 'undefined') return;

  let photoModeId = null;
  let photoDrag = null;
  let historyStarted = false;

  const selectedImage = () => {
    const layer = typeof findLayer === 'function' ? findLayer(selected) : null;
    return layer && layer.type === 'image' ? layer : null;
  };

  const prepare = layer => {
    if (!layer || layer.type !== 'image') return layer;
    layer.imageScale = Number.isFinite(Number(layer.imageScale)) ? Math.max(1, Math.min(8, Number(layer.imageScale))) : 1;
    layer.imageX = Number.isFinite(Number(layer.imageX)) ? Number(layer.imageX) : 0;
    layer.imageY = Number.isFinite(Number(layer.imageY)) ? Number(layer.imageY) : 0;
    return layer;
  };

  const imageMetrics = layer => {
    prepare(layer);
    const img = layer.image && typeof getImg === 'function' ? getImg(layer.image) : null;
    if (!img || !img.complete || !img.naturalWidth) return null;
    const cover = Math.max(layer.w / img.naturalWidth, layer.h / img.naturalHeight);
    const ratio = cover * layer.imageScale;
    return { img, width: img.naturalWidth * ratio, height: img.naturalHeight * ratio };
  };

  const clampPhoto = layer => {
    const metrics = imageMetrics(layer);
    if (!metrics) return;
    const maxX = Math.max(0, (metrics.width - layer.w) / 2);
    const maxY = Math.max(0, (metrics.height - layer.h) / 2);
    layer.imageX = Math.max(-maxX, Math.min(maxX, Number(layer.imageX) || 0));
    layer.imageY = Math.max(-maxY, Math.min(maxY, Number(layer.imageY) || 0));
  };

  const setPhotoMode = (layer, enabled) => {
    if (!layer || layer.type !== 'image') return;
    if (enabled && layer.locked) {
      if (typeof toast === 'function') toast('Desbloquea la capa para mover la foto');
      return;
    }
    photoModeId = enabled ? layer.id : null;
    selected = layer.id;
    photoDrag = null;
    canvas.style.cursor = enabled ? 'grab' : '';
    if (typeof toast === 'function') toast(enabled ? 'Mover foto activo: arrastra dentro del marco y usa la rueda para zoom' : 'Mover marco activo');
    if (typeof renderAll === 'function') renderAll();
    refreshImageUI();
  };

  const zoomPhoto = (layer, scale) => {
    prepare(layer);
    layer.imageScale = Math.max(1, Math.min(8, Number(scale) || 1));
    clampPhoto(layer);
  };

  // Render de imagen propio: respeta marco, zoom y desplazamiento interno.
  const previousDrawLayer = drawLayer;
  drawLayer = function(layer) {
    if (!layer || layer.type !== 'image') return previousDrawLayer(layer);
    if (!layer.visible) return;
    prepare(layer);
    const metrics = imageMetrics(layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2);
    ctx.rotate((layer.rotation || 0) * Math.PI / 180);
    ctx.translate(-layer.w / 2, -layer.h / 2);
    if (!metrics) {
      placeholder(layer);
      ctx.restore();
      return;
    }
    clampPhoto(layer);
    ctx.save();
    roundRect(ctx, 0, 0, layer.w, layer.h, layer.radius || 0);
    ctx.clip();
    const dx = (layer.w - metrics.width) / 2 + layer.imageX;
    const dy = (layer.h - metrics.height) / 2 + layer.imageY;
    ctx.drawImage(metrics.img, dx, dy, metrics.width, metrics.height);
    ctx.restore();
    ctx.restore();
  };

  const previousDrawSelection = drawSelection;
  drawSelection = function(layer) {
    previousDrawSelection(layer);
    if (!layer || layer.type !== 'image' || photoModeId !== layer.id) return;
    ctx.save();
    ctx.strokeStyle = '#5b5cf0';
    ctx.lineWidth = 8 / zoom;
    ctx.setLineDash([18 / zoom, 10 / zoom]);
    ctx.strokeRect(layer.x, layer.y, layer.w, layer.h);
    ctx.setLineDash([]);
    const label = `MOVER FOTO  ${Math.round((layer.imageScale || 1) * 100)}%`;
    ctx.font = `800 ${19 / zoom}px Inter, Arial`;
    const width = ctx.measureText(label).width + 24 / zoom;
    ctx.fillStyle = '#5b5cf0';
    ctx.fillRect(layer.x, layer.y - 36 / zoom, width, 36 / zoom);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, layer.x + 12 / zoom, layer.y - 18 / zoom);
    ctx.restore();
  };

  function imagePanelMarkup(layer) {
    const editing = photoModeId === layer.id;
    prepare(layer);
    return `
      <section class="crop-v35 ${editing ? 'is-photo' : ''}" id="cropPanelV35">
        <div class="crop-v35-title">
          <div><b>Encuadre de imagen</b><small>El marco y la fotografía se controlan por separado.</small></div>
          <span>${editing ? 'MODO FOTO' : 'MODO MARCO'}</span>
        </div>
        <div class="crop-v35-modes">
          <button type="button" data-v35-mode="frame" class="${editing ? '' : 'active'}"><strong>▣ Mover marco</strong><small>Mueve o cambia el tamaño del bloque</small></button>
          <button type="button" data-v35-mode="photo" class="${editing ? 'active' : ''}"><strong>✥ Mover foto</strong><small>Reencuadra la imagen dentro del bloque</small></button>
        </div>
        <div class="crop-v35-zoom">
          <button type="button" data-v35-act="minus">−</button>
          <input id="cropZoomV35" type="range" min="100" max="800" value="${Math.round(layer.imageScale * 100)}">
          <output>${Math.round(layer.imageScale * 100)}%</output>
          <button type="button" data-v35-act="plus">+</button>
        </div>
        <div class="crop-v35-coords">
          <label>Foto X<input id="cropXV35" type="number" value="${Math.round(layer.imageX)}"></label>
          <label>Foto Y<input id="cropYV35" type="number" value="${Math.round(layer.imageY)}"></label>
        </div>
        <div class="crop-v35-actions">
          <button type="button" data-v35-act="replace">Reemplazar imagen</button>
          <button type="button" data-v35-act="reset">Restablecer encuadre</button>
        </div>
        <p>Doble clic sobre la imagen también cambia entre marco y foto. En modo foto: arrastra para mover y usa la rueda para zoom.</p>
      </section>`;
  }

  const previousRenderInspector = renderInspector;
  renderInspector = function() {
    previousRenderInspector();
    const layer = selectedImage();
    if (!layer) {
      refreshImageUI();
      return;
    }
    inspector.insertAdjacentHTML('afterbegin', imagePanelMarkup(layer));
    const panel = document.getElementById('cropPanelV35');
    panel.querySelector('[data-v35-mode="frame"]').onclick = () => setPhotoMode(layer, false);
    panel.querySelector('[data-v35-mode="photo"]').onclick = () => setPhotoMode(layer, true);
    panel.querySelector('[data-v35-act="minus"]').onclick = () => {
      if (layer.locked) return;
      pushHistory(); zoomPhoto(layer, layer.imageScale / 1.12); renderAll();
    };
    panel.querySelector('[data-v35-act="plus"]').onclick = () => {
      if (layer.locked) return;
      pushHistory(); zoomPhoto(layer, layer.imageScale * 1.12); renderAll();
    };
    panel.querySelector('[data-v35-act="reset"]').onclick = () => {
      if (layer.locked) return;
      pushHistory(); layer.imageScale = 1; layer.imageX = 0; layer.imageY = 0; renderAll();
    };
    panel.querySelector('[data-v35-act="replace"]').onclick = () => {
      selected = layer.id; imageUpload.click();
    };
    const zoomInput = panel.querySelector('#cropZoomV35');
    const xInput = panel.querySelector('#cropXV35');
    const yInput = panel.querySelector('#cropYV35');
    const begin = () => { if (!historyStarted) { pushHistory(); historyStarted = true; } };
    zoomInput.oninput = () => { if (layer.locked) return; begin(); zoomPhoto(layer, Number(zoomInput.value) / 100); renderCanvas(); refreshImageUI(); };
    xInput.oninput = () => { if (layer.locked) return; begin(); layer.imageX = Number(xInput.value) || 0; clampPhoto(layer); renderCanvas(); refreshImageUI(); };
    yInput.oninput = () => { if (layer.locked) return; begin(); layer.imageY = Number(yInput.value) || 0; clampPhoto(layer); renderCanvas(); refreshImageUI(); };
    [zoomInput, xInput, yInput].forEach(input => input.onchange = () => { historyStarted = false; renderInspector(); });
    if (layer.locked) panel.querySelectorAll('button,input').forEach(control => control.disabled = true);
    refreshImageUI();
  };

  function refreshImageUI() {
    const layer = selectedImage();
    if (!layer) {
      bar.classList.add('hidden');
      return;
    }
    prepare(layer);
    bar.classList.remove('hidden');
    bar.querySelector('[data-mode="frame"]')?.classList.toggle('active', photoModeId !== layer.id);
    bar.querySelector('[data-mode="photo"]')?.classList.toggle('active', photoModeId === layer.id);
    const range = bar.querySelector('[data-crop="zoom"]');
    const output = bar.querySelector('[data-crop="value"]');
    if (range) range.value = Math.round(layer.imageScale * 100);
    if (output) output.textContent = `${Math.round(layer.imageScale * 100)}%`;
    bar.querySelectorAll('button,input').forEach(control => control.disabled = Boolean(layer.locked));
  }

  bar.addEventListener('click', event => {
    const layer = selectedImage();
    if (!layer) return;
    const control = event.target.closest('[data-mode],[data-crop]');
    if (!control) return;
    if (control.dataset.mode === 'frame') setPhotoMode(layer, false);
    if (control.dataset.mode === 'photo') setPhotoMode(layer, true);
    if (control.dataset.crop === 'minus') { pushHistory(); zoomPhoto(layer, layer.imageScale / 1.12); renderAll(); }
    if (control.dataset.crop === 'plus') { pushHistory(); zoomPhoto(layer, layer.imageScale * 1.12); renderAll(); }
    if (control.dataset.crop === 'reset') { pushHistory(); layer.imageScale = 1; layer.imageX = 0; layer.imageY = 0; renderAll(); }
  });

  const barRange = bar.querySelector('[data-crop="zoom"]');
  if (barRange) {
    barRange.addEventListener('pointerdown', () => pushHistory());
    barRange.addEventListener('input', () => {
      const layer = selectedImage();
      if (!layer || layer.locked) return;
      zoomPhoto(layer, Number(barRange.value) / 100);
      renderCanvas();
      refreshImageUI();
    });
  }

  canvas.addEventListener('pointerdown', event => {
    const layer = photoModeId && findLayer(photoModeId);
    if (!layer || layer.locked) return;
    const point = localPos(event);
    const hitLayer = hit(point.x, point.y);
    if (!hitLayer || hitLayer.id !== layer.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pushHistory();
    photoDrag = { startX: point.x, startY: point.y, imageX: layer.imageX, imageY: layer.imageY, pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }, true);

  canvas.addEventListener('pointermove', event => {
    if (!photoDrag || !photoModeId) return;
    const layer = findLayer(photoModeId);
    if (!layer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = localPos(event);
    layer.imageX = photoDrag.imageX + point.x - photoDrag.startX;
    layer.imageY = photoDrag.imageY + point.y - photoDrag.startY;
    clampPhoto(layer);
    renderCanvas();
    refreshImageUI();
  }, true);

  const endPhotoDrag = event => {
    if (!photoDrag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    photoDrag = null;
    canvas.style.cursor = 'grab';
    renderInspector();
  };
  canvas.addEventListener('pointerup', endPhotoDrag, true);
  canvas.addEventListener('pointercancel', endPhotoDrag, true);

  canvas.addEventListener('wheel', event => {
    const layer = photoModeId && findLayer(photoModeId);
    if (!layer || layer.locked) return;
    const point = localPos(event);
    const hitLayer = hit(point.x, point.y);
    if (!hitLayer || hitLayer.id !== layer.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    zoomPhoto(layer, layer.imageScale * (event.deltaY < 0 ? 1.08 : 0.92));
    renderCanvas();
    refreshImageUI();
  }, { capture: true, passive: false });

  canvas.addEventListener('dblclick', event => {
    const point = localPos(event);
    const layer = hit(point.x, point.y);
    if (!layer || layer.type !== 'image') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selected = layer.id;
    setPhotoMode(layer, photoModeId !== layer.id);
  }, true);

  const previousRenderAll = renderAll;
  renderAll = function() {
    previousRenderAll();
    if (photoModeId && !findLayer(photoModeId)) photoModeId = null;
    refreshImageUI();
  };

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && photoModeId) {
      event.preventDefault();
      setPhotoMode(findLayer(photoModeId), false);
    }
  }, true);

  window.INMO_STUDIO_VERSION = '3.5.0';
  renderAll();
})();
