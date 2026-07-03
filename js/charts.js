/* ===== Nova Budget — gráficas SVG sin dependencias ===== */
const Charts = (() => {

  // Donut / dona con segmentos
  function donut(data, { size = 160, thickness = 26, center } = {}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) {
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${(size - thickness) / 2}" fill="none" stroke="var(--line)" stroke-width="${thickness}"/>
      </svg>`;
    }
    const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    let offset = 0;
    const segs = data.map(d => {
      const frac = d.value / total;
      const len = frac * C;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${thickness}"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    }).join('');
    const mid = center || `<tspan x="${cx}" dy="-2" style="font-size:11px;fill:var(--muted)">Total</tspan>
      <tspan x="${cx}" dy="18" style="font-size:15px;font-weight:800;fill:var(--ink)">${center === undefined ? shorten(total) : ''}</tspan>`;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${segs}
      <text text-anchor="middle" x="${cx}" y="${cy}">${mid}</text>
    </svg>`;
  }

  // Anillo de progreso (salud, ahorro)
  function ring(percent, { size = 96, thickness = 12, color = 'var(--green)', label } = {}) {
    const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, percent));
    const len = (p / 100) * C;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${thickness}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}"
        stroke-dasharray="${len} ${C - len}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
      <text text-anchor="middle" x="${cx}" y="${cy}">
        <tspan x="${cx}" dy="4" style="font-size:${size / 4}px;font-weight:800;fill:var(--ink)">${label != null ? label : Math.round(p)}</tspan>
      </text>
    </svg>`;
  }

  // Barras (tendencia mensual con doble serie: ingreso vs gasto)
  function bars(rows, { height = 150, showIncome = true } = {}) {
    const max = Math.max(1, ...rows.map(r => Math.max(r.spent, showIncome ? r.income : 0)));
    const bw = 100 / rows.length;
    const cols = rows.map((r, i) => {
      const x = i * bw + bw / 2;
      const hS = (r.spent / max) * 100;
      const hI = showIncome ? (r.income / max) * 100 : 0;
      const wIn = 7, gap = 1.5;
      const incBar = showIncome ? `<rect x="${x - wIn - gap / 2}" y="${100 - hI}" width="${wIn}" height="${hI}" rx="2" fill="var(--green)" opacity=".85"/>` : '';
      const spBar = `<rect x="${x + (showIncome ? gap / 2 : -wIn / 2)}" y="${100 - hS}" width="${wIn}" height="${hS}" rx="2" fill="var(--accent)"/>`;
      return `${incBar}${spBar}<text x="${x}" y="112" text-anchor="middle" style="font-size:7px;fill:var(--muted)">${r.label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 100 118" width="100%" height="${height}" preserveAspectRatio="none">${cols}</svg>`;
  }

  // Línea de proyección de ahorro
  function line(points, { height = 150 } = {}) {
    const max = Math.max(1, ...points.map(p => p.value));
    const n = points.length;
    const coords = points.map((p, i) => {
      const x = (i / (n - 1)) * 100;
      const y = 100 - (p.value / max) * 92 - 4;
      return [x, y];
    });
    const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
    const area = path + ` L100 100 L0 100 Z`;
    const dots = coords.filter((_, i) => i % 3 === 0 || i === n - 1)
      .map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="1.6" fill="var(--green)"/>`).join('');
    return `<svg viewBox="0 0 100 100" width="100%" height="${height}" preserveAspectRatio="none">
      <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="var(--green)" stop-opacity=".28"/>
        <stop offset="1" stop-color="var(--green)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#ag)"/>
      <path d="${path}" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  function shorten(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return String(n);
  }

  return { donut, ring, bars, line, shorten };
})();
