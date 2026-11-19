// Fixed scenes for screenshots: ?shot=editor shows the editor with sample photos;
// ?shot=cover shows the cover alone at the export size. Query params pick the layout,
// grade, caption and export size. window.__shotReady is set once painted.
export function applyShot(query, state) {
  const layout = query.get('layout');
  if (layout && ['hero', 'comic', 'mosaic'].includes(layout)) state.layout = layout;
  const grade = query.get('grade');
  if (grade && ['sunset', 'neon', 'pastel'].includes(grade)) state.grade = grade;
  const caption = query.get('caption');
  if (caption !== null) state.caption = caption;
  const sub = query.get('sub');
  if (sub !== null) state.subcaption = sub;
  const size = query.get('size');
  if (size && /^\d+x\d+$/.test(size)) {
    const [w, h] = size.split('x').map(Number);
    state.exportW = w;
    state.exportH = h;
  }
  const position = query.get('position');
  if (position === 'top' || position === 'bottom') state.captionPosition = position;
  return query.get('shot');
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
