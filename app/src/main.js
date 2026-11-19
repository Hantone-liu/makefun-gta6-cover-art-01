// Wires the Cover Studio editor: photo slots, layout and grade picks, caption editing,
// panel selection with drag-to-pan and scroll-to-zoom, and PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCoverArt, panelRects } from './cover.js';
import { applyShot, markShotReady } from './shots.js';

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const SAMPLES = ['samples/boulevard.jpg', 'samples/pier.jpg'];
const EXPORT_SIZES = { '1080x1080': [1080, 1080], '1080x1350': [1080, 1350], '1920x1080': [1920, 1080] };

const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'BOULEVARD QUEEN',
  subcaption: 'SUNSET RUN · SUMMER 26',
  captionScale: 1,
  captionPosition: 'bottom',
  exportW: 1080,
  exportH: 1080,
  // Default crop favours the top of the photo: faces usually sit in the upper
  // third, and a centred crop cuts them off in landscape panels.
  panels: [
    { photo: 0, zoom: 1, ox: 0, oy: 0.35 },
    { photo: 1, zoom: 1, ox: 0, oy: 0.35 },
    { photo: 0, zoom: 1, ox: 0, oy: 0.35 },
    { photo: 1, zoom: 1, ox: 0, oy: 0.35 },
  ],
};

const images = [null, null, null];
let selectedPanel = 0;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function previewSize() {
  const longSide = 720;
  const ratio = state.exportW / state.exportH;
  return ratio >= 1
    ? [longSide, Math.round(longSide / ratio)]
    : [Math.round(longSide * ratio), longSide];
}

function redraw() {
  const [w, h] = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCoverArt(ctx, w, h, state, images, selectedPanel);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function refreshPanelControls() {
  const panel = state.panels[selectedPanel];
  document.querySelectorAll('#panel-photo .choice').forEach((b) => {
    b.classList.toggle('is-active', Number(b.dataset.photo) === panel.photo);
  });
  document.getElementById('panel-zoom').value = Math.round(panel.zoom * 100);
}

async function loadSlot(slot, url, label) {
  try {
    images[slot] = await loadImage(url);
    document.getElementById(`state-${'abc'[slot]}`).textContent = label;
    redraw();
  } catch {
    document.getElementById(`state-${'abc'[slot]}`).textContent = 'Could not load';
  }
}

function wireChoiceGroup(id, key, onPick) {
  document.getElementById(id).addEventListener('click', (e) => {
    const button = e.target.closest('button[data-' + key + ']');
    if (!button) return;
    document.querySelectorAll(`#${id} .choice`).forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    onPick(button.dataset[key]);
    redraw();
  });
}

wireChoiceGroup('layout-choices', 'layout', (v) => { state.layout = v; });
wireChoiceGroup('grade-choices', 'grade', (v) => { state.grade = v; });
wireChoiceGroup('caption-position', 'position', (v) => { state.captionPosition = v; });
wireChoiceGroup('export-size', 'size', (v) => {
  [state.exportW, state.exportH] = EXPORT_SIZES[v];
});
wireChoiceGroup('panel-photo', 'photo', (v) => {
  state.panels[selectedPanel].photo = Number(v);
  refreshPanelControls();
});

document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});
document.getElementById('subcaption').addEventListener('input', (e) => {
  state.subcaption = e.target.value;
  redraw();
});
document.getElementById('caption-size').addEventListener('input', (e) => {
  state.captionScale = Number(e.target.value) / 100;
  redraw();
});
document.getElementById('panel-zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value) / 100;
  redraw();
});
document.getElementById('reset-crop').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  refreshPanelControls();
  redraw();
});

['a', 'b', 'c'].forEach((letter, slot) => {
  document.getElementById(`file-${letter}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await loadSlot(slot, URL.createObjectURL(file), file.name);
  });
  document.getElementById(`sample-${letter}`).addEventListener('click', () => {
    loadSlot(slot, SAMPLES[slot % SAMPLES.length], 'Sample loaded');
  });
});

// Panel picking and cropping on the preview canvas.
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function panelAt(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  return rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit === -1) return;
  selectedPanel = hit;
  refreshPanelControls();
  redraw();
  const panel = state.panels[selectedPanel];
  const start = p;
  const startOx = panel.ox;
  const startOy = panel.oy;
  const rect = panelRects(state.layout, canvas.width, canvas.height)[hit];
  const move = (ev) => {
    const q = canvasPoint(ev);
    panel.ox = startOx + (q.x - start.x) / rect.w;
    panel.oy = startOy + (q.y - start.y) / rect.h;
    redraw();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  refreshPanelControls();
  redraw();
}, { passive: false });

/** Renders the cover at full export size and returns a PNG data URL. */
export function exportPng(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCoverArt(off.getContext('2d'), w, h, state, images, -1);
  return off.toDataURL('image/png');
}

document.getElementById('export').addEventListener('click', () => {
  const url = exportPng(state.exportW, state.exportH);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cover-${state.exportW}x${state.exportH}.png`;
  a.click();
  setStatus(`Saved cover-${state.exportW}x${state.exportH}.png`);
});

// Automation hook for screenshots: the same export the button runs.
window.coverStudio = { exportPng, state, images };

const query = new URLSearchParams(location.search);
const shot = applyShot(query, state);
if (shot === 'cover') document.body.classList.add('shot-cover');

async function boot() {
  await loadSlot(0, SAMPLES[0], 'Sample loaded');
  await loadSlot(1, SAMPLES[1], 'Sample loaded');
  if (shot) {
    // In shot mode the scene is fixed: redraw once and signal readiness.
    redraw();
    markShotReady();
  } else {
    redraw();
  }
  refreshPanelControls();
}

boot();
