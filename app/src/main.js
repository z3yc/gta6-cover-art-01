// Vice Coast Cover Studio — page wiring: photos, layout and grade buttons,
// panel dragging and zooming, lettering controls, undo/redo and PNG export.
// Photos are read with FileReader and stay on this machine; nothing uploads.
import { drawCover, renderExport, hitPanel, LAYOUTS, GRADES, EXPORT_SIZES, blankPanels, ensurePanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const state = {
  layout: 'hero3',
  grade: 'sunset',
  title: 'VICE COAST',
  subtitle: 'one last ride',
  titleSize: 100,
  titleStyle: 'sunset',
  grain: true,
  vignette: true,
  gutters: true,
  size: '1920x1080',
  panels: blankPanels('hero3'),
};
const photos = []; // { name, img } in tray order; img is an HTMLImageElement
let selectedPhoto = -1;
let selectedPanel = -1;
let history = [];
let future = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    titleSize: state.titleSize,
    titleStyle: state.titleStyle,
    grain: state.grain,
    vignette: state.vignette,
    gutters: state.gutters,
    panels: state.panels,
    selectedPanel,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  ensurePanels(state);
  selectedPanel = s.selectedPanel ?? -1;
  syncControls();
  redraw();
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  syncUndoButtons();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  syncUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  $('undoBtn').disabled = history.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

function previewSize() {
  const size = EXPORT_SIZES[state.size];
  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch {
    // Fall back to system fonts if a vendored font fails to load.
  }
}

let redrawQueued = false;
function redraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(async () => {
    redrawQueued = false;
    const { w, h } = previewSize();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    await ensureFonts();
    drawCover(canvas, state, photos.map((p) => p.img));
    drawSelection();
  });
}

// A teal outline around the selected panel, drawn over the preview.
function drawSelection() {
  if (selectedPanel < 0) return;
  const ctx = canvas.getContext('2d');
  const cells = LAYOUTS[state.layout].cells(canvas.width, canvas.height);
  const c = cells[selectedPanel];
  if (!c) return;
  ctx.save();
  ctx.strokeStyle = '#2de2c5';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
  ctx.restore();
}

function syncControls() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleSize').value = state.titleSize;
  $('titleStyle').value = state.titleStyle;
  $('grainChk').checked = state.grain;
  $('vignetteChk').checked = state.vignette;
  $('gutterChk').checked = state.gutters;
  $('sizeSelect').value = state.size;
  document.querySelectorAll('#layoutBtns button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeBtns button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  const panel = state.panels[selectedPanel];
  $('panelHint').textContent = panel
    ? `Panel ${selectedPanel + 1} of ${state.panels.length} selected — drag it, scroll to zoom, or use the slider.`
    : 'No panel selected yet — click a panel on the cover.';
  $('zoomRange').value = panel ? Math.round((panel.zoom || 1) * 100) : 100;
  renderTray();
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  if (!photos.length) {
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = 'No photos yet — add your own or load the samples.';
    tray.appendChild(span);
    return;
  }
  photos.forEach((p, i) => {
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    img.title = p.name;
    if (i === selectedPhoto) img.classList.add('selected');
    img.addEventListener('click', () => {
      selectedPhoto = i;
      if (selectedPanel >= 0) {
        pushHistory();
        state.panels[selectedPanel].photo = i;
        redraw();
      }
      syncControls();
    });
    tray.appendChild(img);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhotoFile(file) {
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await loadImage(url);
  photos.push({ name: file.name || 'photo', img });
  selectedPhoto = photos.length - 1;
  return photos.length - 1;
}

async function addPhotoUrl(url, name) {
  const img = await loadImage(url);
  photos.push({ name, img });
  selectedPhoto = photos.length - 1;
  return photos.length - 1;
}

function fillPanelsWith(photoIndex) {
  pushHistory();
  state.panels.forEach((p) => {
    p.photo = photoIndex;
    p.zoom = 1;
    p.x = 0;
    p.y = 0;
  });
  redraw();
}

// --- layout and grade buttons ---------------------------------------------

function buildChoiceButtons() {
  const layoutBox = $('layoutBtns');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = key;
    const cells = def.cells(3, 3);
    const cols = Math.max(...cells.map((c) => c.x + c.w));
    const rows = Math.max(...cells.map((c) => c.y + c.h));
    const mini = document.createElement('span');
    mini.className = 'mini';
    mini.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    mini.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    cells.forEach((c) => {
      const cell = document.createElement('i');
      cell.style.gridColumn = `${c.x + 1} / span ${c.w}`;
      cell.style.gridRow = `${c.y + 1} / span ${c.h}`;
      mini.appendChild(cell);
    });
    b.appendChild(mini);
    b.appendChild(document.createTextNode(def.label));
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      pushHistory();
      state.layout = key;
      ensurePanels(state);
      selectedPanel = -1;
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = $('gradeBtns');
  const swatches = {
    sunset: 'linear-gradient(135deg,#ffd166,#ff7a18,#ff2e88)',
    neon: 'linear-gradient(135deg,#ff2e88,#7b2ff7,#22d3ee)',
    vice: 'linear-gradient(135deg,#2de2c5,#ff2e88)',
    noir: 'linear-gradient(135deg,#ffffff,#777777,#111111)',
    golden: 'linear-gradient(135deg,#fff3b0,#ffb347,#ff6b35)',
  };
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = key;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = swatches[key] || '#888';
    b.appendChild(sw);
    b.appendChild(document.createTextNode(def.label));
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      pushHistory();
      state.grade = key;
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  });
}

// --- events -----------------------------------------------------------------

$('photoInput').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  pushHistory();
  for (const file of files) await addPhotoFile(file);
  if (state.panels.every((p) => p.photo < 0)) fillPanelsWith(0);
  syncControls();
  redraw();
  statusEl.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} loaded — kept on this device.`;
  e.target.value = '';
});

$('sampleBtn').addEventListener('click', async () => {
  pushHistory();
  if (!photos.some((p) => p.name === 'boulevard.jpg')) {
    await addPhotoUrl('samples/boulevard.jpg', 'boulevard.jpg');
  }
  if (!photos.some((p) => p.name === 'pier.jpg')) {
    await addPhotoUrl('samples/pier.jpg', 'pier.jpg');
  }
  if (state.panels.every((p) => p.photo < 0)) {
    state.panels.forEach((p, i) => {
      p.photo = i % photos.length;
    });
  }
  syncControls();
  redraw();
  statusEl.textContent = 'Sample photos loaded.';
});

$('fillAllBtn').addEventListener('click', () => {
  if (selectedPhoto < 0) {
    statusEl.textContent = 'Load or pick a photo first.';
    return;
  }
  fillPanelsWith(selectedPhoto);
  statusEl.textContent = 'Every panel now uses the selected photo.';
});

$('titleInput').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
$('titleInput').addEventListener('change', () => pushHistory());
$('subtitleInput').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
$('subtitleInput').addEventListener('change', () => pushHistory());
$('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value);
  redraw();
});
$('titleSize').addEventListener('change', () => pushHistory());
$('titleStyle').addEventListener('change', (e) => {
  pushHistory();
  state.titleStyle = e.target.value;
  redraw();
});
$('grainChk').addEventListener('change', (e) => {
  pushHistory();
  state.grain = e.target.checked;
  redraw();
});
$('vignetteChk').addEventListener('change', (e) => {
  pushHistory();
  state.vignette = e.target.checked;
  redraw();
});
$('gutterChk').addEventListener('change', (e) => {
  pushHistory();
  state.gutters = e.target.checked;
  redraw();
});
$('sizeSelect').addEventListener('change', (e) => {
  state.size = e.target.value;
  redraw();
});
$('zoomRange').addEventListener('input', (e) => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Number(e.target.value) / 100;
  redraw();
});
$('zoomRange').addEventListener('change', () => pushHistory());
$('centerBtn').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  pushHistory();
  panel.x = 0;
  panel.y = 0;
  panel.zoom = 1;
  syncControls();
  redraw();
});
$('clearPanelBtn').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  pushHistory();
  panel.photo = -1;
  panel.zoom = 1;
  panel.x = 0;
  panel.y = 0;
  redraw();
});
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
});

$('exportBtn').addEventListener('click', async () => {
  statusEl.textContent = 'Rendering PNG…';
  await ensureFonts();
  const out = renderExport(state, photos.map((p) => p.img), state.size);
  out.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed — try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-coast-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved vice-coast-${state.size}.png (${EXPORT_SIZES[state.size].w} × ${EXPORT_SIZES[state.size].h}).`;
  }, 'image/png');
});

// --- canvas interaction: click to select, drag to pan, wheel to zoom -------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const idx = hitPanel(state, canvas.width, canvas.height, p.x, p.y);
  if (idx < 0) return;
  selectedPanel = idx;
  const panel = state.panels[idx];
  if (selectedPhoto >= 0 && panel.photo < 0) {
    pushHistory();
    panel.photo = selectedPhoto;
  } else if (e.pointerType === 'mouse') {
    pushHistory();
  }
  drag = { startX: p.x, startY: p.y, x: panel.x, y: panel.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
  syncControls();
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  const dx = (p.x - drag.startX) / canvas.width;
  const dy = (p.y - drag.startY) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  panel.x = Math.max(-0.6, Math.min(0.6, drag.x + dx));
  panel.y = Math.max(-0.6, Math.min(0.6, drag.y + dy));
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag && !drag.moved) {
    // A plain click only selected the panel; drop the history entry.
    history.pop();
    syncUndoButtons();
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const idx = hitPanel(state, canvas.width, canvas.height, p.x, p.y);
  if (idx < 0) return;
  selectedPanel = idx;
  const panel = state.panels[idx];
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.92)));
  syncControls();
  redraw();
}, { passive: false });

// --- boot -------------------------------------------------------------------

buildChoiceButtons();
syncControls();
syncUndoButtons();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, photos, { addPhotoUrl, fillPanelsWith, syncControls, redraw, pushHistory });
} else {
  redraw();
}
