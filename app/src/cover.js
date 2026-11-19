// Draws the cover art: multi-panel photos, a colour grade, and bold gradient caption
// lettering. Pure drawing — no DOM, no network — so the editor preview and the PNG
// export call the same function at different sizes.

/** Colour grades: a canvas filter for the photos, a tint wash, caption colours. */
export const GRADES = {
  sunset: {
    filter: 'saturate(1.32) contrast(1.06) brightness(1.02)',
    tintTop: 'rgba(255, 122, 60, 0.20)',
    tintBottom: 'rgba(255, 45, 120, 0.26)',
    captionTop: '#ffd23e',
    captionBottom: '#ff5e62',
    accent: '#ff7a3c',
  },
  neon: {
    filter: 'saturate(1.5) contrast(1.18) hue-rotate(-12deg) brightness(0.98)',
    tintTop: 'rgba(34, 211, 238, 0.26)',
    tintBottom: 'rgba(232, 121, 249, 0.34)',
    captionTop: '#67e8f9',
    captionBottom: '#f472b6',
    accent: '#22d3ee',
  },
  pastel: {
    filter: 'saturate(1.05) contrast(0.98) brightness(1.07)',
    tintTop: 'rgba(253, 230, 138, 0.16)',
    tintBottom: 'rgba(186, 230, 253, 0.20)',
    captionTop: '#fff7cc',
    captionBottom: '#fbcfe8',
    accent: '#fde68a',
  },
};

/** Panel layouts as fractions of the cover: [x, y, width, height] per panel. */
export const LAYOUTS = {
  hero: [
    [0, 0, 0.62, 1],
    [0.62, 0, 0.38, 0.5],
    [0.62, 0.5, 0.38, 0.5],
  ],
  comic: [
    [0, 0, 1, 0.56],
    [0, 0.56, 0.5, 0.44],
    [0.5, 0.56, 0.5, 0.44],
  ],
  mosaic: [
    [0, 0, 0.52, 0.55],
    [0.52, 0, 0.48, 0.45],
    [0, 0.55, 0.52, 0.45],
    [0.52, 0.45, 0.48, 0.55],
  ],
};

/**
 * Panel rectangles in pixels, with a thin gutter between panels.
 * @returns {{x:number,y:number,w:number,h:number}[]}
 */
export function panelRects(layout, w, h) {
  const gap = Math.max(2, Math.round(w * 0.005));
  const half = gap / 2;
  return LAYOUTS[layout].map(([fx, fy, fw, fh]) => ({
    x: fx * w + half,
    y: fy * h + half,
    w: fw * w - gap,
    h: fh * h - gap,
  }));
}

/**
 * Cover-fit placement of an image inside a panel, with a zoom and a pan offset.
 * crop = { zoom, ox, oy }: ox/oy are fractions of the panel size, 0 is centred.
 * Offsets are clamped so the photo always covers the panel — no white bands.
 */
export function placePhoto(panel, img, crop) {
  const base = Math.max(panel.w / img.naturalWidth, panel.h / img.naturalHeight);
  const scale = base * crop.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxOx = Math.max(0, (dw - panel.w) / 2 / panel.w);
  const maxOy = Math.max(0, (dh - panel.h) / 2 / panel.h);
  const ox = Math.max(-maxOx, Math.min(maxOx, crop.ox));
  const oy = Math.max(-maxOy, Math.min(maxOy, crop.oy));
  return {
    dx: panel.x + (panel.w - dw) / 2 + ox * panel.w,
    dy: panel.y + (panel.h - dh) / 2 + oy * panel.h,
    dw,
    dh,
    ox,
    oy,
  };
}

/** Splits a caption into at most two lines that fit maxWidth, shrinking to fit. */
export function fitCaption(ctx, text, maxWidth, startSize) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = startSize;
  let lines = [];
  while (size > 10) {
    ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
    lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidth || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2) return { lines, size };
    size = Math.floor(size * 0.92);
  }
  return { lines: lines.slice(0, 2), size };
}

function drawCaption(ctx, w, h, state, grade) {
  const text = state.caption.trim().toUpperCase();
  const sub = state.subcaption.trim().toUpperCase();
  if (!text && !sub) return;
  const baseSize = Math.min(w, h) * 0.115 * state.captionScale;
  const margin = h * 0.055;
  const maxWidth = w * 0.92;
  const { lines, size } = text
    ? fitCaption(ctx, text, maxWidth, baseSize)
    : { lines: [], size: baseSize };
  const lineHeight = size * 1.04;
  const blockH = lines.length * lineHeight;
  const subSize = Math.max(12, h * 0.032);
  const subH = sub ? subSize * 1.9 : 0;
  const totalH = blockH + subH;
  const top = state.captionPosition === 'top';
  const blockTop = top ? margin : h - margin - totalH;

  // A soft dark scrim behind the lettering so it reads on any photo.
  const scrim = ctx.createLinearGradient(0, top ? 0 : h, 0, top ? totalH + margin * 2 : h - totalH - margin * 2);
  scrim.addColorStop(0, 'rgba(8, 5, 16, 0)');
  scrim.addColorStop(1, 'rgba(8, 5, 16, 0.55)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top ? 0 : h - totalH - margin * 2, w, totalH + margin * 2);

  // Accent bar: above the block at the foot, below it at the top.
  const barW = w * 0.16;
  const barH = Math.max(4, size * 0.09);
  const barY = top ? blockTop + totalH + size * 0.22 : blockTop - barH - size * 0.22;
  ctx.fillStyle = grade.accent;
  roundRect(ctx, (w - barW) / 2, barY, barW, barH, barH / 2);
  ctx.fill();

  if (text) {
    const grad = ctx.createLinearGradient(0, blockTop, 0, blockTop + blockH);
    grad.addColorStop(0, grade.captionTop);
    grad.addColorStop(1, grade.captionBottom);
    ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14101f';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.05;
    lines.forEach((line, i) => {
      const y = blockTop + (i + 1) * lineHeight - size * 0.18;
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, w / 2, y);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (sub) {
    ctx.font = `700 ${subSize}px "Arial Black", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`;
    const y = blockTop + blockH + subSize * 1.25;
    ctx.fillText(sub, w / 2, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws the whole cover onto ctx at the given size.
 * state: { layout, grade, caption, subcaption, captionScale, captionPosition,
 *           panels: [{ photo, zoom, ox, oy }] } — panels[i].photo is an index into images.
 * images: array of HTMLImageElement or null, one per photo slot.
 * selected: index of the panel to outline (preview only), or -1 for a clean export.
 */
export function drawCoverArt(ctx, w, h, state, images, selected = -1) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.save();
  ctx.fillStyle = '#14101c';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    const img = panel ? images[panel.photo] : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      const crop = { zoom: panel.zoom, ox: panel.ox, oy: panel.oy };
      const at = placePhoto(rect, img, crop);
      ctx.filter = grade.filter;
      ctx.drawImage(img, at.dx, at.dy, at.dw, at.dh);
      ctx.filter = 'none';
      const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, grade.tintTop);
      wash.addColorStop(1, grade.tintBottom);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = wash;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = '#241d33';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = `600 ${Math.max(12, h * 0.02)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Add a photo', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.restore();
    if (i === selected) {
      ctx.save();
      ctx.strokeStyle = '#ff5e62';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.restore();
    }
  });

  // Vignette: a gentle darkening at the edges pulls the panels together.
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  );
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  drawCaption(ctx, w, h, state, grade);
  ctx.restore();
}
