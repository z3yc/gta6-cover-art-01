// Vice Coast cover engine: draws a multi-panel GTA-style poster cover onto a
// 2D canvas. Pure drawing code — no network, no DOM input besides the canvas.
// A cover state is { layout, grade, title, subtitle, titleSize, titleStyle,
// grain, vignette, gutters, panels: [{ photo, zoom, x, y }] } and `photos`
// is an array of drawable images (HTMLImageElement or canvas) in tray order.

export const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape' },
};

// Each layout is a name and a function of (w, h) returning panel rects
// {x, y, w, h} in cover pixels. Rects are ordered top-left first.
export const LAYOUTS = {
  hero3: {
    label: 'Hero + 3',
    cells(w, h) {
      const hero = Math.round(w * 0.62);
      const side = w - hero;
      const third = Math.round(h / 3);
      return [
        { x: 0, y: 0, w: hero, h },
        { x: hero, y: 0, w: side, h: third },
        { x: hero, y: third, w: side, h: third },
        { x: hero, y: third * 2, w: side, h: h - third * 2 },
      ];
    },
  },
  grid4: {
    label: 'Four grid',
    cells(w, h) {
      const hw = Math.round(w / 2);
      const hh = Math.round(h / 2);
      return [
        { x: 0, y: 0, w: hw, h: hh },
        { x: hw, y: 0, w: w - hw, h: hh },
        { x: 0, y: hh, w: hw, h: h - hh },
        { x: hw, y: hh, w: w - hw, h: h - hh },
      ];
    },
  },
  full: {
    label: 'Full bleed',
    cells(w, h) {
      return [{ x: 0, y: 0, w, h }];
    },
  },
  grid9: {
    label: 'Nine grid',
    cells(w, h) {
      const cw = Math.round(w / 3);
      const ch = Math.round(h / 3);
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({
            x: c * cw,
            y: r * ch,
            w: c === 2 ? w - c * cw : cw,
            h: r === 2 ? h - r * ch : ch,
          });
        }
      }
      return out;
    },
  },
  duo: {
    label: 'Split duo',
    cells(w, h) {
      const hw = Math.round(w / 2);
      return [
        { x: 0, y: 0, w: hw, h },
        { x: hw, y: 0, w: w - hw, h },
      ];
    },
  },
};

// A grade is a canvas filter for the photo plus two overlay washes drawn
// over it (diagonal colour wash, then a warm bottom glow), each with a
// composite mode and an alpha.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.3) contrast(1.08) brightness(1.02)',
    wash: ['#ff7a18', '#ff2e88'],
    washAlpha: 0.34,
    glow: 'rgba(255, 110, 60, 0.28)',
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.7) contrast(1.12) hue-rotate(-12deg)',
    wash: ['#ff2e88', '#22d3ee'],
    washAlpha: 0.4,
    glow: 'rgba(255, 46, 136, 0.3)',
  },
  vice: {
    label: 'Vice teal-pink',
    filter: 'saturate(1.45) contrast(1.06)',
    wash: ['#2de2c5', '#ff2e88'],
    washAlpha: 0.38,
    glow: 'rgba(45, 226, 197, 0.2)',
  },
  noir: {
    label: 'Noir B&W',
    filter: 'grayscale(1) contrast(1.22) brightness(1.05)',
    wash: ['#888888', '#222222'],
    washAlpha: 0.22,
    glow: 'rgba(255, 255, 255, 0.08)',
  },
  golden: {
    label: 'Golden hour',
    filter: 'saturate(1.35) contrast(1.05) sepia(0.28)',
    wash: ['#ffb347', '#ff6b35'],
    washAlpha: 0.3,
    glow: 'rgba(255, 180, 80, 0.3)',
  },
};

export const TITLE_STYLES = {
  sunset: { fill: ['#ffd166', '#ff7a18', '#ff2e88'], stroke: '#1a0b2e' },
  white: { fill: ['#ffffff', '#f2e9ff'], stroke: '#1a0b2e' },
  neon: { fill: ['#ff9ecf', '#ff2e88'], stroke: '#2b0a3d' },
  gold: { fill: ['#fff3b0', '#ffb347', '#e08a00'], stroke: '#241300' },
};

const PLACEHOLDER_HUES = [268, 318, 190, 24, 150, 205, 340, 90, 45];

function panelCount(layout) {
  return LAYOUTS[layout].cells(100, 100).length;
}

export function blankPanels(layout) {
  return Array.from({ length: 9 }, (_, i) => ({
    photo: -1,
    zoom: 1,
    x: 0,
    y: 0,
    _slot: i,
  })).slice(0, Math.max(panelCount(layout), 1));
}

export function ensurePanels(state) {
  const want = panelCount(state.layout);
  while (state.panels.length < want) {
    state.panels.push({ photo: -1, zoom: 1, x: 0, y: 0 });
  }
  state.panels.length = want;
}

// A deterministic stand-in for an empty panel: a sunset gradient with a
// palm-ish silhouette arc and a soft sun, so the cover looks finished
// before any photo is loaded.
function drawPlaceholder(ctx, rect, index) {
  const hue = PLACEHOLDER_HUES[index % PLACEHOLDER_HUES.length];
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, `hsl(${hue}, 70%, 42%)`);
  g.addColorStop(0.55, `hsl(${(hue + 40) % 360}, 80%, 55%)`);
  g.addColorStop(1, `hsl(${(hue + 80) % 360}, 85%, 62%)`);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.22;
  ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w * 0.68, rect.y + rect.h * 0.34, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 6, 40, 0.55)';
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w * 0.35, rect.y + rect.h * 0.62);
  ctx.lineTo(rect.x + rect.w * 0.62, rect.y + rect.h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w * 0.6, rect.y + rect.h * 0.72);
  ctx.lineTo(rect.x + rect.w * 0.34, rect.y + rect.h);
  ctx.closePath();
  ctx.fill();
}

function drawPhotoInto(ctx, img, rect, panel, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (panel.zoom || 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const cx = rect.x + rect.w / 2 + (panel.x || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (panel.y || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  // Diagonal colour wash in overlay mode, then a warm glow from below.
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const glow = ctx.createLinearGradient(0, rect.y + rect.h * 0.45, 0, rect.y + rect.h);
  glow.addColorStop(0, 'rgba(0,0,0,0)');
  glow.addColorStop(1, grade.glow);
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

let noisePattern = null;
function getNoise(ctx) {
  if (noisePattern) return noisePattern;
  const n = document.createElement('canvas');
  n.width = 140;
  n.height = 140;
  const nctx = n.getContext('2d');
  const data = nctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  noisePattern = ctx.createPattern(n, 'repeat');
  return noisePattern;
}

function fitFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 16 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawLettering(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const bandH = h * 0.24;
  const bandY = h - bandH;
  // Dark scrim so lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, bandY - h * 0.06, 0, h);
  scrim.addColorStop(0, 'rgba(10, 2, 24, 0)');
  scrim.addColorStop(0.45, 'rgba(10, 2, 24, 0.55)');
  scrim.addColorStop(1, 'rgba(10, 2, 24, 0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - h * 0.06, w, bandH + h * 0.06);

  ctx.save();
  ctx.translate(w / 2, h - h * 0.125);
  ctx.rotate(-0.022);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    const style = TITLE_STYLES[state.titleStyle] || TITLE_STYLES.sunset;
    const baseSize = h * 0.115 * ((state.titleSize || 100) / 100);
    const size = fitFont(ctx, title, w * 0.92, baseSize);
    const grad = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
    style.fill.forEach((c, i) => grad.addColorStop(i / Math.max(style.fill.length - 1, 1), c));
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeStyle = style.stroke;
    ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(title, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillText(title, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  if (subtitle) {
    const subSize = Math.max(14, h * 0.038 * ((state.titleSize || 100) / 100));
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff9ecf';
    ctx.shadowColor = 'rgba(255, 46, 136, 0.9)';
    ctx.shadowBlur = subSize * 0.5;
    const y = title ? h * 0.072 : 0;
    ctx.fillText(subtitle, 0, y);
  }
  ctx.restore();
}

/** Draws the whole cover for `state` onto `canvas` (its width/height are the output size). */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#150829';
  ctx.fillRect(0, 0, w, h);
  const grade = GRADES[state.grade] || GRADES.sunset;
  const cells = LAYOUTS[state.layout].cells(w, h);
  const gutter = state.gutters ? Math.max(3, Math.round(Math.min(w, h) * 0.008)) : 0;
  const half = gutter / 2;
  cells.forEach((cell, i) => {
    // Inset each side by half a gutter; the dark background shows through.
    const rect = {
      x: cell.x + half,
      y: cell.y + half,
      w: cell.w - gutter,
      h: cell.h - gutter,
    };
    const panel = state.panels[i] || { photo: -1, zoom: 1, x: 0, y: 0 };
    const img = panel.photo >= 0 ? photos[panel.photo] : null;
    if (img) drawPhotoInto(ctx, img, rect, panel, grade);
    else drawPlaceholder(ctx, rect, i);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.0012));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  drawLettering(ctx, w, h, state);

  if (state.vignette) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8, 2, 18, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain) {
    const pattern = getNoise(ctx);
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // Thin neon frame, the poster's edge.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** Renders `state` at an export size onto a fresh canvas and returns it. */
export function renderExport(state, photos, sizeKey) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES['1920x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, photos);
  return canvas;
}

/** Finds which panel cell (index) contains cover point (x, y), or -1. */
export function hitPanel(state, w, h, x, y) {
  const cells = LAYOUTS[state.layout].cells(w, h);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return i;
  }
  return -1;
}
