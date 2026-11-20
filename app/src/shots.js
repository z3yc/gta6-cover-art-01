// Fixed scenes for screenshots: ?shot=cover shows the finished cover alone,
// ?shot=editor shows the editor with photos loaded. Query knobs:
//   photo=boulevard|pier, layout=hero3|grid4|full|grid9|duo,
//   grade=sunset|neon|vice|noir|golden, size=1080x1080|1080x1350|1920x1080,
//   title=..., subtitle=..., grain=0|1, vignette=0|1.
import { ensurePanels } from './cover.js';

export async function runShot(shot, query, state, photos, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const layout = query.get('layout') || (shot === 'cover' ? 'hero3' : 'grid4');
  const grade = query.get('grade') || 'sunset';
  const size = query.get('size') || '1920x1080';
  const title = query.get('title') || 'VICE COAST';
  const subtitle = query.get('subtitle') || 'one last ride';

  state.layout = layout;
  state.grade = grade;
  state.size = size;
  state.title = title;
  state.subtitle = subtitle;
  state.grain = query.get('grain') !== '0';
  state.vignette = query.get('vignette') !== '0';
  ensurePanels(state);

  const first = query.get('photo') || 'pier';
  const second = first === 'pier' ? 'boulevard' : 'pier';
  await api.addPhotoUrl(`samples/${first}.jpg`, `${first}.jpg`);
  await api.addPhotoUrl(`samples/${second}.jpg`, `${second}.jpg`);
  // Alternate the two photos across panels so the cover reads as a set.
  state.panels.forEach((p, i) => {
    p.photo = i % 2 === 0 ? 0 : 1;
    p.zoom = 1;
    p.x = 0;
    p.y = 0;
  });
  api.syncControls();
  api.redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  // Let the vendored fonts arrive before the screenshot is taken.
  await document.fonts.ready;
  api.redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
